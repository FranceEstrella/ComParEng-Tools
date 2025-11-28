"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { parseCurriculumHtml } from "@/lib/curriculum-import"
import { registerExternalCourses } from "@/lib/course-data"
import { saveCourseStatuses } from "@/lib/course-storage"
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Calendar,
  CalendarDays,
  Download,
  HelpCircle,
  Moon,
  Palette,
  PartyPopper,
  PlugZap,
  RefreshCw,
  Rocket,
  Sparkles,
  Sun,
  Target,
  Upload,
  GraduationCap,
} from "lucide-react"

type OnboardingCompletionOptions = {
  deferWhatsNew?: boolean
}

export type OnboardingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (options?: OnboardingCompletionOptions) => void
  hasCompletedOnce?: boolean
}

type SlideId =
  | "welcome"
  | "mission"
  | "course-tracker"
  | "schedule-maker"
  | "academic-planner"
  | "extension"
  | "live-data"
  | "theme"
  | "cpe-check"
  | "wrap-up"

type Slide = {
  id: SlideId
  label: string
  title: string
  description: string
  icon: ReactNode
}

const slideAccentClasses: Partial<Record<SlideId, string>> = {
  "course-tracker": "text-blue-600 dark:text-blue-300",
  "schedule-maker": "text-purple-600 dark:text-purple-300",
  "academic-planner": "text-emerald-600 dark:text-emerald-300",
}

const slides: Slide[] = [
  {
    id: "welcome",
    label: "Start",
    title: "Welcome to ComParEng Tools",
    description: "A quick walkthrough so you can make the most out of the Course Tracker, Schedule Maker, and Academic Planner.",
    icon: <PartyPopper className="h-10 w-10 text-emerald-600 animate-bounce" />,
  },
  {
    id: "mission",
    label: "Overview",
    title: "Three tools, one workspace",
    description: "Plan terms, keep tabs on prerequisites, and build conflict-free schedules without switching tabs.",
    icon: <Target className="h-10 w-10 text-sky-600 animate-pulse" />,
  },
  {
    id: "course-tracker",
    label: "Course Tracker",
    title: "Stay ahead of prerequisites",
    description: "Color-coded statuses, curriculum imports, and requirement hints help you see what's blocking your next subject.",
    icon: <BookOpen className="h-10 w-10 text-blue-600 animate-pulse" />,
  },
  {
    id: "schedule-maker",
    label: "Schedule Maker",
    title: "Compare live sections in seconds",
    description: "Pull the latest SOLAR sections, auto-highlight open slots, and export a polished ICS calendar.",
    icon: <Calendar className="h-10 w-10 text-purple-600 animate-pulse" />,
  },
  {
    id: "academic-planner",
    label: "Academic Planner",
    title: "Map your entire journey",
    description: "Drag terms, set unit caps, and keep electives organized so you always know what's next.",
    icon: <GraduationCap className="h-10 w-10 text-emerald-600 animate-pulse" />,
  },
  {
    id: "extension",
    label: "Extension",
    title: "Install the Course Data Extractor",
    description: "Schedule Maker and Academic Planner rely on the Chrome extension to receive fresh section data from SOLAR.",
    icon: <PlugZap className="h-10 w-10 text-rose-600 animate-pulse" />,
  },
  {
    id: "live-data",
    label: "Live Data",
    title: "Fresh data with safety nets",
    description: "Uploads expire automatically, signatures prevent mix-ups, and you can re-import anytime for cleaner schedules. Everything stays on your device—no cloud uploads.",
    icon: <RefreshCw className="h-10 w-10 text-cyan-600 animate-spin" />,
  },
  {
    id: "theme",
    label: "Theme",
    title: "Pick a vibe",
    description: "Light or dark, the UI adapts instantly. Try the mini preview below - it's a safe sandbox for the real toggle up top.",
    icon: <Palette className="h-10 w-10 text-pink-600 animate-pulse" />,
  },
  {
    id: "cpe-check",
    label: "You",
    title: "Are you a Computer Engineering student?",
    description: "We deliver CpE defaults out of the box, but other programs can still import their curricula.",
    icon: <HelpCircle className="h-10 w-10 text-slate-600 animate-pulse" />,
  },
  {
    id: "wrap-up",
    label: "Finish",
    title: "You're ready!",
    description: "Start using ComParEng Tools to plan your academic journey with confidence.",
    icon: <Rocket className="h-10 w-10 text-emerald-600 animate-bounce" />,
  },
]

const lightPreview = "bg-white text-slate-900 border-slate-200 shadow-sm"
const darkPreview = "bg-slate-900 text-white border-white/10"

export default function OnboardingDialog({ open, onOpenChange, onComplete, hasCompletedOnce }: OnboardingDialogProps) {
  const { setTheme: setGlobalTheme } = useTheme()
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [themePreview, setThemePreview] = useState<"light" | "dark">("light")
  const [cpeAnswer, setCpeAnswer] = useState<"yes" | "no" | null>(null)
  const curriculumFileInputRef = useRef<HTMLInputElement>(null)
  const [curriculumImportState, setCurriculumImportState] = useState<"idle" | "pending" | "success" | "error">("idle")
  const [curriculumImportMessage, setCurriculumImportMessage] = useState<string | null>(null)
  const [showCurriculumHow, setShowCurriculumHow] = useState(false)
  const [hasCustomCurriculum, setHasCustomCurriculum] = useState(false)

  useEffect(() => {
    const monitor = () => setIsMobileLayout(window.innerWidth < 640)
    monitor()
    window.addEventListener("resize", monitor)
    return () => window.removeEventListener("resize", monitor)
  }, [])

  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setThemePreview("light")
      setCpeAnswer(null)
      setCurriculumImportState("idle")
      setCurriculumImportMessage(null)
      setShowCurriculumHow(false)
      setHasCustomCurriculum(false)
      if (curriculumFileInputRef.current) {
        curriculumFileInputRef.current.value = ""
      }
    }
  }, [open])

  const activeSlide = slides[currentIndex]
  const progressValue = useMemo(() => ((currentIndex + 1) / slides.length) * 100, [currentIndex])
  const needsCustomUpload = activeSlide.id === "cpe-check" && cpeAnswer === "no" && !hasCustomCurriculum
  const isWelcomeSlide = activeSlide.id === "welcome"

  const nextDisabled = activeSlide.id === "cpe-check" && (cpeAnswer === null || needsCustomUpload)
  const isLastSlide = currentIndex === slides.length - 1

  const finishOnboarding = (options?: OnboardingCompletionOptions) => {
    onComplete(options)
    onOpenChange(false)
  }

  const goNext = () => {
    if (activeSlide.id === "cpe-check") {
      if (cpeAnswer === null) return
      if (cpeAnswer === "no" && !hasCustomCurriculum) {
        setCurriculumImportMessage((prev) => prev ?? "Upload your curriculum first to continue.")
        return
      }
    }
    if (activeSlide.id === "theme") {
      setGlobalTheme(themePreview)
    }
    if (isLastSlide) {
      finishOnboarding()
      return
    }
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1))
  }

  const goPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0))

  const handleSkip = () => {
    if (activeSlide.id === "cpe-check") {
      const proceed = typeof window === "undefined" || window.confirm("We'll keep the default CpE curriculum unless you import a new one later inside Course Tracker. Continue?")
      if (!proceed) return
    }
    finishOnboarding()
  }

  const handleCurriculumImport = (file: File) => {
    setCurriculumImportState("pending")
    setCurriculumImportMessage("Parsing curriculum…")

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const html = event.target?.result as string
        const parsed = parseCurriculumHtml(html)

        if (!parsed.length) {
          setCurriculumImportState("error")
          setCurriculumImportMessage("No courses found in that HTML file.")
          return
        }

        registerExternalCourses(parsed)
        saveCourseStatuses(parsed)
        setCurriculumImportState("success")
        setCurriculumImportMessage("Curriculum imported! Open Course Tracker to see it applied.")
        setHasCustomCurriculum(true)
      } catch (error) {
        console.error(error)
        setCurriculumImportState("error")
        setCurriculumImportMessage("We couldn't parse that file. Try exporting again from SOLAR.")
      } finally {
        if (curriculumFileInputRef.current) {
          curriculumFileInputRef.current.value = ""
        }
      }
    }
    reader.onerror = () => {
      setCurriculumImportState("error")
      setCurriculumImportMessage("Upload interrupted. Please try again.")
      if (curriculumFileInputRef.current) {
        curriculumFileInputRef.current.value = ""
      }
    }
    reader.readAsText(file)
  }

  const handleCurriculumFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    handleCurriculumImport(file)
  }

  const handleOpenCourseTracker = () => {
    finishOnboarding({ deferWhatsNew: true })
    router.push("/course-tracker")
  }

  const renderSlideContent = (slideId: SlideId) => {
    switch (slideId) {
      case "mission":
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Course Tracker",
                body: "Set statuses, view prereqs, and stay aligned with your curriculum.",
                icon: <BookOpen className="h-6 w-6 text-blue-600" />,
                accent: "from-blue-600/10 to-blue-400/10",
              },
              {
                title: "Schedule Maker",
                body: "Filter live sections, catch conflicts, and export polished schedules.",
                icon: <Calendar className="h-6 w-6 text-purple-600" />,
                accent: "from-purple-600/10 to-purple-400/10",
              },
              {
                title: "Academic Planner",
                body: "Lay out future terms, balance units, and keep electives organized.",
                icon: <GraduationCap className="h-6 w-6 text-emerald-600" />,
                accent: "from-emerald-600/10 to-emerald-400/10",
              },
            ].map((item) => (
              <Card key={item.title} className="border border-dashed">
                <CardHeader className="space-y-1 pb-2">
                  <div className={cn("inline-flex rounded-full bg-gradient-to-r p-2", item.accent)}>
                    {item.icon}
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
              </Card>
            ))}
          </div>
        )
      case "course-tracker":
        return (
          <div className="space-y-3">
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" variant="secondary">
              Auto-sync statuses
            </Badge>
            <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
              <li>Track completed, in-progress, and remaining subjects with colors you set.</li>
              <li>Import SOLAR curriculum HTML to mirror your exact flow.</li>
              <li>Hover to view prerequisites and dependent courses instantly.</li>
            </ul>
          </div>
        )
      case "schedule-maker":
        return (
          <div className="space-y-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
              Live section feed
            </Badge>
            <p className="text-sm text-muted-foreground">
              Each upload stays fresh for a short window and refreshes automatically so you can watch slots open up without reloading.
            </p>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-muted-foreground">
                <span className="font-medium text-slate-800 dark:text-slate-100">COExxxx | 7:30-9:00</span>
                <span className="text-emerald-600 dark:text-emerald-300">3 slots left</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-muted-foreground">
                <span className="font-medium text-slate-800 dark:text-slate-100">ELExxxx | 10:00-12:00</span>
                <span className="text-rose-600 dark:text-rose-300">For petition</span>
              </div>
            </div>
          </div>
        )
      case "academic-planner":
        return (
          <div className="space-y-3">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200">
              Long-range view
            </Badge>
            <p className="text-sm text-muted-foreground">
              Outline every remaining term, balance units, and drag electives into future slots to avoid overload later.
            </p>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              {["Term 1", "Term 2"].map((term, idx) => (
                <div key={term} className="rounded-xl border border-dashed p-3">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-100">
                    <span className="font-medium">{term}</span>
                    <span>{idx === 0 ? "21" : "19"} units</span>
                  </div>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>Core subjects</p>
                    <p>Elective placeholder</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case "extension":
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                Install the <span className="font-semibold">ComParEng Course Data Extractor</span> from the Chrome Web Store, then log in to SOLAR before uploading sections.
              </p>
              <Button
                className="mt-3 flex items-center gap-2"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open(
                      "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                      "_blank"
                    )
                  }
                }}
              >
                <Download className="h-4 w-4" /> Open Chrome Web Store
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              No Chrome? Export CSV from another browser, then import inside the Schedule Maker.
            </p>
          </div>
        )
      case "live-data":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {["Auto-expiring uploads", "Curriculum signatures", "Manual refresh"].map((item, idx) => (
                <Card key={item}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      {item}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {idx === 0 && "Old section data clears out after a short time so you never plan around stale slots."}
                    {idx === 1 && "We tag every upload with a fingerprint and clear conflicting plans when you switch curricula."}
                    {idx === 2 && "Need instant updates? Press Refresh inside Schedule Maker and we'll fetch the latest payload."}
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Privacy note: nothing you import is uploaded to our servers. Section payloads and planner data stay inside your browser's local storage.
            </p>
          </div>
        )
      case "theme":
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Preview themes:</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={themePreview === "light" ? "default" : "outline"}
                  onClick={() => setThemePreview("light")}
                  className="flex items-center gap-2"
                >
                  <Sun className="h-4 w-4" /> Light
                </Button>
                <Button
                  size="sm"
                  variant={themePreview === "dark" ? "default" : "outline"}
                  onClick={() => setThemePreview("dark")}
                  className="flex items-center gap-2"
                >
                  <Moon className="h-4 w-4" /> Dark
                </Button>
              </div>
            </div>
            <div
              className={cn(
                "rounded-2xl border p-5 transition-all duration-300",
                themePreview === "light" ? lightPreview : darkPreview
              )}
            >
              <p className="text-sm opacity-80">This sandbox only changes the card below.</p>
              <div className="mt-3 rounded-xl border border-dashed p-4">
                <p className="text-xs uppercase tracking-wide opacity-70">Course Tracker preview</p>
                <p className="text-lg font-semibold">Fundamentals of Mixed Signals and Sensors</p>
                <p className="text-sm opacity-80">Prerequisites: CPE0011 | Status: Ready for enrollment</p>
              </div>
            </div>
          </div>
        )
      case "cpe-check":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "ComParEng ako Boss!", value: "yes", helper: "We'll pre-load the FEU Tech BS CpE curriculum." },
                { label: "Nope.", value: "no", helper: "Import your program's HTML and everything still works." },
              ].map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all",
                    cpeAnswer === option.value
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "hover:border-emerald-300"
                  )}
                  onClick={() => setCpeAnswer(option.value as "yes" | "no")}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.helper}</p>
                </button>
              ))}
            </div>
            {cpeAnswer === "no" && (
              <div className="rounded-xl border border-dashed bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
                <p className="font-semibold mb-1">From another program?</p>
                <p>
                  Grab your curriculum from SOLAR, save the HTML file, then upload it here. We'll tag it so Course Tracker, Schedule Maker, and Planner understand your custom course codes.
                </p>
                {showCurriculumHow && (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                    <li>Sign in to SOLAR and open Program Curriculum.</li>
                    <li>Press Ctrl+S (or right-click → Save as) to save the page as an HTML file.</li>
                    <li>Click the button below and upload the file.</li>
                  </ol>
                )}
                {needsCustomUpload && curriculumImportState !== "pending" && (
                  <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-100">
                    Upload your program's curriculum to continue.
                  </p>
                )}
                <input
                  type="file"
                  ref={curriculumFileInputRef}
                  onChange={handleCurriculumFileChange}
                  accept=".html,.htm"
                  className="hidden"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    className="gap-2"
                    onClick={() => curriculumFileInputRef.current?.click()}
                    disabled={curriculumImportState === "pending"}
                  >
                    <Upload className="h-4 w-4" />
                    {curriculumImportState === "pending" ? "Importing…" : "Upload curriculum now"}
                  </Button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-emerald-700 underline decoration-dotted hover:text-emerald-800 dark:text-emerald-200"
                    onClick={() => setShowCurriculumHow((prev) => !prev)}
                  >
                    {showCurriculumHow ? "Hide steps" : "Show me how"}
                  </button>
                </div>
                {curriculumImportMessage && (
                  <p
                    className={cn(
                      "mt-2 text-sm",
                      curriculumImportState === "success"
                        ? "text-emerald-700 dark:text-emerald-200"
                        : curriculumImportState === "error"
                          ? "text-rose-700 dark:text-rose-200"
                          : "text-amber-700 dark:text-amber-200"
                    )}
                  >
                    {curriculumImportMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      case "wrap-up":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Start with Course Tracker so your statuses and curriculum are ready. Once your courses look right, jump over to Schedule Maker and Academic Planner from inside the tool.
            </p>
            <div className="grid gap-3 sm:grid-cols-1">
              <Button variant="outline" className="justify-center gap-2" onClick={handleOpenCourseTracker}>
                <BookOpenCheck className="h-4 w-4" />
                Open Course Tracker
              </Button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "border-none bg-transparent p-0 shadow-none",
          isMobileLayout
            ? "left-0 top-0 h-screen w-full max-w-none translate-x-0 translate-y-0 rounded-none"
            : "max-w-3xl"
        )}
      >
        <DialogTitle className="sr-only">ComParEng onboarding</DialogTitle>
        <div
          className={cn(
            "relative flex h-full max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900",
            isMobileLayout && "h-screen max-h-none overflow-y-auto rounded-none border-none"
          )}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-blue-400 to-amber-400" />
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 text-sm font-medium uppercase tracking-wide dark:border-white/10">
            <span>Guided onboarding</span>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip tour
            </Button>
          </div>
          <div className="px-6 pb-4 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className={slideAccentClasses[activeSlide.id] ?? "text-emerald-600 dark:text-emerald-300"}>{activeSlide.label}</span>
                <span className="text-muted-foreground">{currentIndex + 1} / {slides.length}</span>
              </div>
              {hasCompletedOnce && (
                <Badge variant="outline" className="text-xs">
                  Replay
                </Badge>
              )}
            </div>
            <Progress value={progressValue} className="mb-5 h-2" />
            <div
              key={activeSlide.id}
              className={cn(
                "space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300",
                isWelcomeSlide && "flex flex-col items-center justify-center text-center min-h-[55vh]"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3",
                  (isMobileLayout || isWelcomeSlide) && "flex-col items-center text-center gap-2"
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white",
                    (isMobileLayout || isWelcomeSlide) && "mb-1"
                  )}
                  aria-hidden
                >
                  {activeSlide.icon}
                </div>
                <div className={cn("text-left", (isMobileLayout || isWelcomeSlide) && "text-center")}
                >
                  <h2 className="text-2xl font-semibold leading-tight">{activeSlide.title}</h2>
                  <p className="text-sm text-muted-foreground">{activeSlide.description}</p>
                </div>
              </div>
              {renderSlideContent(activeSlide.id)}
            </div>
          </div>
          <div className="mt-auto border-t border-slate-100 px-6 py-4 dark:border-white/10">
            <div
              className={cn(
                "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                isMobileLayout && "items-center text-center"
              )}
            >
              <div className={cn("flex gap-2", isMobileLayout && "flex-col w-full")}
              >
                {currentIndex > 0 && (
                  <Button
                    variant="ghost"
                    onClick={goPrev}
                    className={cn(isMobileLayout && "w-full justify-center py-3 text-base")}
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={goNext}
                  disabled={nextDisabled}
                  className={cn(isMobileLayout && "w-full justify-center py-3 text-base")}
                >
                  {isLastSlide ? "Finish" : "Next"}
                </Button>
              </div>
              <p className={cn("text-xs text-muted-foreground", isMobileLayout && "text-center")}
              >
                Tip: Reopen this tour anytime using the Start Onboarding button on the homepage.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
