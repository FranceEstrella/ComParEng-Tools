"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { parseCurriculumHtml } from "@/lib/curriculum-import"
import { registerExternalCourses } from "@/lib/course-data"
import { saveCourseStatuses } from "@/lib/course-storage"
import { RECOMMENDED_UNITS_MIN, RECOMMENDED_UNITS_MAX } from "@/lib/config"
import OnboardingSchedulePreview from "@/components/onboarding/schedule-preview"
import OnboardingCourseTrackerPreview from "@/components/onboarding/course-tracker-preview"
import OnboardingAcademicPlannerPreview from "@/components/onboarding/academic-planner-preview"
import OnboardingRewardProfilePreview from "@/components/onboarding/reward-profile-preview"
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Calendar,
  Download,
  GraduationCap,
  Laptop,
  MessageSquare,
  Moon,
  Palette,
  PlugZap,
  RefreshCw,
  Repeat2,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  Upload,
} from "lucide-react"

type OnboardingCompletionOptions = {
  deferWhatsNew?: boolean
  source?: "finish" | "jump" | "skip"
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
  | "reward-system"
  | "profile-summary"
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

const CREDIT_LIMITS_STORAGE_KEY = "planner.creditLimits"
const WELCOME_ICON_SIZE_PX =180
const WELCOME_ICON_WRAPPER_SIZE_PX = 180

const slideAccentClasses: Partial<Record<SlideId, string>> = {
  "course-tracker": "text-blue-600 dark:text-blue-300",
  "schedule-maker": "text-purple-600 dark:text-purple-300",
  "academic-planner": "text-emerald-600 dark:text-emerald-300",
  "reward-system": "text-amber-400",
  "profile-summary": "text-violet-600 dark:text-violet-300",
}

const slides: Slide[] = [
  {
    id: "welcome",
    label: "Start",
    title: "Welcome to ComParEng Tools",
    description: "A quick walkthrough of your three-tool workspace: Course Tracker, Schedule Maker, and Academic Planner.",
    icon: (
      <Image
        src="/welcome-neebot.png"
        alt="ComParEng robot"
        width={WELCOME_ICON_SIZE_PX}
        height={WELCOME_ICON_SIZE_PX}
        className="object-contain"
        style={{ width: WELCOME_ICON_SIZE_PX, height: WELCOME_ICON_SIZE_PX }}
        priority
      />
    ),
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
    id: "reward-system",
    label: "Rewards",
    title: "Earn XP and track milestones",
    description: "Complete terms to unlock animated reward moments with XP gains, levels, and milestone badges.",
    icon: <Trophy className="h-10 w-10 text-white animate-pulse" />,
  },
  {
    id: "profile-summary",
    label: "Profile",
    title: "See your academic summary",
    description: "Open Profile to view completion, rank progress, graduation estimate, and earned rewards in one place.",
    icon: <Sparkles className="h-10 w-10 text-violet-600 animate-pulse" />,
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
    title: "What every student should know",
    description: "Your imports stay private, power every tool, and are easy to share or refresh when plans change.",
    icon: <ShieldCheck className="h-10 w-10 text-emerald-600 animate-pulse" />,
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
    icon: (
      <Image
        src="/android-icon-192x192.png"
        alt="ComParEng Tools logo"
        width={48}
        height={48}
        className="h-10 w-10 rounded-full animate-bounce"
        priority
      />
    ),
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

const ToolPill = ({ label, className }: { label: string; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
      className
    )}
  >
    {label}
  </span>
)

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
  const [extensionConfirmOpen, setExtensionConfirmOpen] = useState(false)
  const [extensionConfirmAction, setExtensionConfirmAction] = useState<"next" | "skip" | null>(null)
  const [cpeSkipPromptOpen, setCpeSkipPromptOpen] = useState(false)
  const [cpeSkipPromptContext, setCpeSkipPromptContext] = useState<"missing-upload" | "confirm">("missing-upload")
  const [generalSkipPromptOpen, setGeneralSkipPromptOpen] = useState(false)
  const [skipImporting, setSkipImporting] = useState(false)
  const [skipImportStatusOpen, setSkipImportStatusOpen] = useState(false)
  const [skipImportStatus, setSkipImportStatus] = useState<"loading" | "success" | "error">("loading")
  const [skipImportStatusMessage, setSkipImportStatusMessage] = useState("Importing all tools data...")
  const [creditLimitDialogOpen, setCreditLimitDialogOpen] = useState(false)
  const [creditLimitMin, setCreditLimitMin] = useState(RECOMMENDED_UNITS_MIN)
  const [creditLimitMax, setCreditLimitMax] = useState(RECOMMENDED_UNITS_MAX)
  const [creditLimitError, setCreditLimitError] = useState<string | null>(null)
  const unifiedBackupInputRef = useRef<HTMLInputElement>(null)
  const skipImportStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipImportCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSkipImportTimers = useCallback(() => {
    if (skipImportStatusTimeoutRef.current) {
      clearTimeout(skipImportStatusTimeoutRef.current)
      skipImportStatusTimeoutRef.current = null
    }
    if (skipImportCompleteTimeoutRef.current) {
      clearTimeout(skipImportCompleteTimeoutRef.current)
      skipImportCompleteTimeoutRef.current = null
    }
  }, [])

  const showSkipImportStatus = useCallback(
    (status: "loading" | "success" | "error", message: string, autoCloseMs?: number) => {
      if (skipImportStatusTimeoutRef.current) {
        clearTimeout(skipImportStatusTimeoutRef.current)
        skipImportStatusTimeoutRef.current = null
      }

      setSkipImportStatus(status)
      setSkipImportStatusMessage(message)
      setSkipImportStatusOpen(true)

      if (typeof autoCloseMs === "number" && autoCloseMs > 0) {
        skipImportStatusTimeoutRef.current = setTimeout(() => {
          setSkipImportStatusOpen(false)
          skipImportStatusTimeoutRef.current = null
        }, autoCloseMs)
      }
    },
    [],
  )

  const shouldIncludeUnifiedDataKey = useCallback((key: string): boolean => {
    const staticKeys = new Set([
      "courseStatuses",
      "courseTrackerPreferences",
      "trackerPreferences",
      "courseCodeAliases",
      "feedbackHistory",
      "scheduleMakerData",
      "planner.lastRegenerateResult",
      "planner.autoSaveEnabled",
      "planner.creditLimits",
      "planner.savedPlan",
    ])

    if (staticKeys.has(key)) return true

    return (
      key.startsWith("courseTracker") ||
      key.startsWith("courseTracker.") ||
      key.startsWith("scheduleMaker") ||
      key.startsWith("planner.") ||
      key.startsWith("compareng.")
    )
  }, [])

  const syncCreditLimitsFromStorage = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(CREDIT_LIMITS_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (typeof parsed?.min === "number" && Number.isFinite(parsed.min)) {
        setCreditLimitMin(Math.max(0, parsed.min))
      }
      if (typeof parsed?.max === "number" && Number.isFinite(parsed.max)) {
        setCreditLimitMax(Math.max(0, parsed.max))
      }
    } catch (error) {
      console.error("Failed to load credit limits:", error)
    }
  }, [])

  useEffect(() => {
    const monitor = () => setIsMobileLayout(window.innerWidth < 640)
    monitor()
    window.addEventListener("resize", monitor)
    return () => window.removeEventListener("resize", monitor)
  }, [])

  useEffect(() => {
    syncCreditLimitsFromStorage()
  }, [syncCreditLimitsFromStorage])

  useEffect(() => {
    if (open) {
      clearSkipImportTimers()
      setCurrentIndex(0)
      setThemePreview("light")
      setCpeAnswer(null)
      setCurriculumImportState("idle")
      setCurriculumImportMessage(null)
      setSkipImporting(false)
      setSkipImportStatusOpen(false)
      setSkipImportStatus("loading")
      setSkipImportStatusMessage("Importing all tools data...")
      setShowCurriculumHow(false)
      setHasCustomCurriculum(false)
      setCreditLimitDialogOpen(false)
      setCreditLimitError(null)
      syncCreditLimitsFromStorage()
      if (curriculumFileInputRef.current) {
        curriculumFileInputRef.current.value = ""
      }
    }
  }, [clearSkipImportTimers, open, syncCreditLimitsFromStorage])

  useEffect(() => {
    return () => {
      clearSkipImportTimers()
    }
  }, [clearSkipImportTimers])

  const activeSlide = slides[currentIndex]
  const progressValue = useMemo(() => ((currentIndex + 1) / slides.length) * 100, [currentIndex])
  const needsCustomUpload = activeSlide.id === "cpe-check" && cpeAnswer === "no" && !hasCustomCurriculum
  const isWelcomeSlide = activeSlide.id === "welcome"
  const isScheduleMakerSlide = activeSlide.id === "schedule-maker"
  const isRewardThemeSlide = activeSlide.id === "reward-system"

  const nextDisabled = activeSlide.id === "cpe-check" && (cpeAnswer === null || needsCustomUpload)
  const isLastSlide = currentIndex === slides.length - 1

  const finishOnboarding = (options?: OnboardingCompletionOptions) => {
    onComplete(options)
    onOpenChange(false)
  }

  const promptExtensionConfirmation = (action: "next" | "skip") => {
    setExtensionConfirmAction(action)
    setExtensionConfirmOpen(true)
  }

  const goNext = () => {
    if (activeSlide.id === "extension") {
      promptExtensionConfirmation("next")
      return
    }
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
      finishOnboarding({ source: "finish" })
      return
    }
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1))
  }

  const goPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0))

  const handleSkip = () => {
    if (activeSlide.id === "extension") {
      promptExtensionConfirmation("skip")
      return
    }
    const generalSkipSlides: SlideId[] = ["welcome", "course-tracker", "schedule-maker", "academic-planner", "reward-system", "profile-summary", "live-data", "theme"]
    if (generalSkipSlides.includes(activeSlide.id)) {
      setGeneralSkipPromptOpen(true)
      return
    }
    if (activeSlide.id === "cpe-check") {
      if (cpeAnswer === "no" && !hasCustomCurriculum) {
        setCpeSkipPromptContext("missing-upload")
        setCpeSkipPromptOpen(true)
        return
      }
      setCpeSkipPromptContext("confirm")
      setCpeSkipPromptOpen(true)
      return
    }
    finishOnboarding({ source: "skip" })
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
        setCreditLimitError(null)
        setCreditLimitDialogOpen(true)
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
    finishOnboarding({ deferWhatsNew: true, source: "jump" })
    router.push("/course-tracker")
  }

  const handleExtensionConfirm = () => {
    if (extensionConfirmAction === "next") {
      setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1))
    } else if (extensionConfirmAction === "skip") {
      finishOnboarding({ source: "skip" })
    }
    setExtensionConfirmOpen(false)
    setExtensionConfirmAction(null)
  }

  const handleExtensionCancel = () => {
    setExtensionConfirmOpen(false)
    setExtensionConfirmAction(null)
  }

  const handleGeneralSkipStay = () => {
    setGeneralSkipPromptOpen(false)
  }

  const openUnifiedBackupPicker = () => {
    if (skipImporting) return
    unifiedBackupInputRef.current?.click()
  }

  const handleUnifiedBackupImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || skipImporting) return

    setSkipImporting(true)
    showSkipImportStatus("loading", "Importing all tools data...")

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = String(reader.result || "")
        const parsed = JSON.parse(raw)
        const incoming = parsed?.localStorage

        if (!incoming || typeof incoming !== "object") {
          throw new Error("Invalid backup format")
        }

        let importedCount = 0
        Object.entries(incoming as Record<string, unknown>).forEach(([key, value]) => {
          if (!shouldIncludeUnifiedDataKey(key)) return
          if (typeof value !== "string") return
          window.localStorage.setItem(key, value)
          importedCount += 1
        })

        window.dispatchEvent(new CustomEvent("compareng:unified-data-imported"))

        const successStatusDurationMs = 1800
        setGeneralSkipPromptOpen(false)
        showSkipImportStatus("success", `Import complete. Restored ${importedCount} entries.`, successStatusDurationMs)

        if (skipImportCompleteTimeoutRef.current) {
          clearTimeout(skipImportCompleteTimeoutRef.current)
        }
        skipImportCompleteTimeoutRef.current = setTimeout(() => {
          try {
            window.localStorage.removeItem("whatsNew.seenVersion")
          } catch {
            // ignore storage failures
          }
          setSkipImportStatusOpen(false)
          finishOnboarding({ source: "skip" })
        }, successStatusDurationMs + 150)
      } catch (error) {
        console.error("Failed to import all tools data from onboarding", error)
        showSkipImportStatus("error", "Import failed. Invalid backup file.", 2200)
      } finally {
        setSkipImporting(false)
      }
    }

    reader.onerror = () => {
      showSkipImportStatus("error", "Import failed. Could not read backup file.", 2200)
      setSkipImporting(false)
    }

    reader.readAsText(file)
    event.target.value = ""
  }

  const handleGeneralSkipConfirm = () => {
    setGeneralSkipPromptOpen(false)
    finishOnboarding({ source: "skip" })
  }

  const handleCpeSkipPrimaryAction = () => {
    if (cpeSkipPromptContext === "missing-upload") {
      curriculumFileInputRef.current?.click()
    }
    setCpeSkipPromptOpen(false)
  }

  const handleCpeSkipContinue = () => {
    setCpeSkipPromptOpen(false)
    finishOnboarding({ source: "skip" })
  }

  const persistCreditLimits = (minValue: number, maxValue: number) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        CREDIT_LIMITS_STORAGE_KEY,
        JSON.stringify({ min: minValue, max: maxValue }),
      )
    } catch (error) {
      console.error("Failed to save credit limits:", error)
    }
  }

  const handleCreditLimitSave = () => {
    if (!Number.isFinite(creditLimitMin) || !Number.isFinite(creditLimitMax)) {
      setCreditLimitError("Enter numeric values for both fields.")
      return
    }
    if (creditLimitMin < 0 || creditLimitMax < 0) {
      setCreditLimitError("Credits can't be negative.")
      return
    }
    if (creditLimitMax <= creditLimitMin) {
      setCreditLimitError("Maximum credits must be greater than the minimum.")
      return
    }
    persistCreditLimits(creditLimitMin, creditLimitMax)
    setCreditLimitDialogOpen(false)
    setCreditLimitError(null)
    setCurriculumImportMessage((prev) =>
      prev ? `${prev} Saved your per-term credit limits.` : "Saved your per-term credit limits.",
    )
  }

  const handleCreditLimitSkip = () => {
    setCreditLimitDialogOpen(false)
    setCreditLimitError(null)
  }


  const renderSlideContent = (slideId: SlideId) => {
    switch (slideId) {
      case "welcome":
      case "mission":
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Start with the tool you need now, then switch anytime as your term plan evolves.
            </p>
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
                <CardHeader className="space-y-1 pb-2 text-center">
                  <div className={cn("mx-auto inline-flex rounded-full bg-gradient-to-r p-2", item.accent)}>
                    {item.icon}
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
              </Card>
            ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Note: The mascot is a property of the Computer Engineering Organization - FEU Tech.
            </p>
          </div>
        )
      case "course-tracker":
        return (
          <div className="space-y-2">
            <Card className="border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
              <CardContent className="space-y-2 p-3">
                <Badge className="h-5 bg-emerald-100 px-2 text-[10px] text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" variant="secondary">
                  Progress visibility
                </Badge>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-base">
                    Track prerequisites in card and table views.
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Use Card view for quick checks and Table view for detailed status + last-taken review.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Card view</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Prerequisites, units, and status at a glance.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Table view + Save Grade Attempts</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Add grade attempts, review last taken terms, and save a transcript of grades.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Synced progress</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Both views stay synced with imported curriculum and saved progress.</p>
                  </div>
                  <div className="rounded-lg border border-blue-300 bg-blue-50/90 px-2 py-1.5 dark:border-blue-400/40 dark:bg-blue-500/10">
                    <p className="font-semibold text-blue-800 dark:text-blue-100">Tip</p>
                    <p className="mt-0.5 text-[10px] text-blue-700 dark:text-blue-200">
                      Use Table view for grade attempts and transcript export, while Card view stays focused on prerequisite and status checks.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 dark:border-white/10 dark:bg-slate-900/60">
              <OnboardingCourseTrackerPreview />
            </div>
          </div>
        )
      case "schedule-maker":
        return (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start">
            <Card className="border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-rose-50/40 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
              <CardContent className="space-y-2.5 p-3.5">
                <Badge variant="secondary" className="h-6 bg-blue-100 text-[11px] text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
                  Tools in action
                </Badge>
                <div>
                  <h3 className="text-base font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-lg">
                    Plan with live section data and a visual timetable.
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Import sections from SOLAR using the extractor, compare options in one place, then shape your final layout in Schedule View.
                  </p>
                </div>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                  <li className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
                    Available Courses and Selected Courses let you filter, compare, and pick real section combinations.
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
                    Schedule View highlights overlaps so you can adjust meeting times before enrollment.
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
                    Export your finalized schedule as .ics, image, CSV, or JSON for sharing and backup.
                  </li>
                </ul>
                <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100">
                  Tip: Switch to "Version 2" to see a conflict example, then drag blocks to create a conflict-free version.
                </div>
              </CardContent>
            </Card>
            <OnboardingSchedulePreview />
          </div>
        )
      case "academic-planner":
        return (
          <div className="space-y-2">
            <Card className="border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
              <CardContent className="space-y-2 p-3">
                <Badge variant="secondary" className="h-5 bg-purple-100 px-2 text-[10px] text-purple-800 dark:bg-purple-500/20 dark:text-purple-200">
                  Long-range planning
                </Badge>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-base">
                    Compare strategy modes and project your graduation timeline.
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Academic Planner helps you regenerate terms with different priorities while keeping unit limits and prerequisite flow in view.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Three planning modes</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Balanced, Crucial-first, and Easy-first strategies.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Graduation summary</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Shows target graduation and projected load.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Sample term plan</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Preview how each mode changes term composition.</p>
                  </div>
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50/90 px-2 py-1.5 dark:border-emerald-400/40 dark:bg-emerald-500/10">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-100">Tip</p>
                    <p className="mt-0.5 text-[10px] text-emerald-700 dark:text-emerald-200">
                      Toggle modes to compare tradeoffs before locking your final graduation plan.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 dark:border-white/10 dark:bg-slate-900/60">
              <OnboardingAcademicPlannerPreview />
            </div>
          </div>
        )
      case "reward-system":
        return (
          <div className="space-y-2">
            <Card className="border-amber-200/20 bg-gradient-to-br from-[#2a180f] via-[#19141e] to-[#0d0b12] text-amber-50 shadow-[0_16px_40px_rgba(0,0,0,0.42)]">
              <CardContent className="space-y-2 p-3">
                <Badge variant="secondary" className="h-5 bg-amber-100/15 px-2 text-[10px] text-amber-100">
                  Gamified progress
                </Badge>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-amber-50 sm:text-base">
                    Get reward popups whenever you complete term milestones.
                  </h3>
                  <p className="mt-0.5 text-[11px] text-amber-100/85">
                    Course Tracker triggers an animated overlay with XP gains, current level progress, and newly unlocked term/year badges.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-amber-50">
                  <div className="rounded-lg border border-amber-200/20 bg-amber-100/5 px-2 py-1.5 backdrop-blur-[1px]">
                    <p className="font-semibold">Reward overlay</p>
                    <p className="mt-0.5 text-[10px] text-amber-100/85">Animated XP gain, level progress, and badge unlock moments.</p>
                  </div>
                  <div className="rounded-lg border border-amber-200/20 bg-amber-100/5 px-2 py-1.5 backdrop-blur-[1px]">
                    <p className="font-semibold">Milestone XP</p>
                    <p className="mt-0.5 text-[10px] text-amber-100/85">Each completed term or year adds to your total XP progression.</p>
                  </div>
                  <div className="rounded-lg border border-amber-200/20 bg-amber-100/5 px-2 py-1.5 backdrop-blur-[1px]">
                    <p className="font-semibold">Badges earned</p>
                    <p className="mt-0.5 text-[10px] text-amber-100/85">Each completed term and year contributes to your collection.</p>
                  </div>
                  <div className="rounded-lg border border-orange-200/40 bg-orange-400/10 px-2 py-1.5">
                    <p className="font-semibold text-orange-100">Tip</p>
                    <p className="mt-0.5 text-[10px] text-orange-50/90">Close the overlay to continue tracking, then jump to Profile for your full history.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <OnboardingRewardProfilePreview mode="reward" />
          </div>
        )
      case "profile-summary":
        return (
          <div className="space-y-2">
            <Card className="border-violet-200/35 bg-gradient-to-br from-[#38338d] via-[#5a4fc2] to-[#9a84ea] text-white shadow-[0_16px_40px_rgba(68,56,152,0.35)]">
              <CardContent className="space-y-2 p-3">
                <Badge variant="secondary" className="h-5 bg-violet-200/20 px-2 text-[10px] text-violet-50">
                  Profile overview
                </Badge>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-white sm:text-base">
                    Review your academic summary and rewards from one profile panel.
                  </h3>
                  <p className="mt-0.5 text-[11px] text-violet-100/90">
                    The profile view combines completion stats, level progress, and unlocked badges so you can monitor progress at a glance.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-violet-50">
                  <div className="rounded-lg border border-violet-200/35 bg-black/20 px-2 py-1.5 backdrop-blur-[1px]">
                    <p className="font-semibold">Academic completion</p>
                    <p className="mt-0.5 text-[10px] text-violet-100/90">Check overall passed, active, and pending course progress.</p>
                  </div>
                  <div className="rounded-lg border border-violet-200/35 bg-black/20 px-2 py-1.5 backdrop-blur-[1px]">
                    <p className="font-semibold">Rank and XP</p>
                    <p className="mt-0.5 text-[10px] text-violet-100/90">See your current level plus XP needed for the next milestone.</p>
                  </div>
                  <div className="rounded-lg border border-violet-200/35 bg-black/20 px-2 py-1.5 backdrop-blur-[1px]">
                    <p className="font-semibold">Badge history</p>
                    <p className="mt-0.5 text-[10px] text-violet-100/90">Browse all earned term and year badges in one list.</p>
                  </div>
                  <div className="rounded-lg border border-violet-200/40 bg-violet-300/15 px-2 py-1.5">
                    <p className="font-semibold text-violet-100">Tip</p>
                    <p className="mt-0.5 text-[10px] text-violet-50/90">Use the color chips in the preview to switch the profile background theme.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <OnboardingRewardProfilePreview mode="profile" />
          </div>
        )
      case "extension":
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-4 shadow-sm dark:border-rose-400/20 dark:from-rose-500/10 dark:via-slate-900 dark:to-orange-500/10">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Install the <span className="font-semibold">ComParEng Course Data Extractor</span> from the Chrome Web Store, then log in to SOLAR before uploading sections.
              </p>
              <Button
                className="mt-3 h-9 gap-2 bg-gradient-to-r from-rose-600 to-orange-500 text-white hover:from-rose-500 hover:to-orange-400"
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
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
              <div className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                    <Calendar className="h-3 w-3" />
                  </span>
                  <p className="font-semibold">Schedule Maker</p>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Extension imports live SOLAR sections so you can compare slots and conflicts.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                    <GraduationCap className="h-3 w-3" />
                  </span>
                  <p className="font-semibold">Academic Planner</p>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Uses the same extracted section data to generate and validate realistic term plans.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                    <BookOpen className="h-3 w-3" />
                  </span>
                  <p className="font-semibold">Course Tracker</p>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Works without the extension via curriculum import, then stays aligned with the same course codes.</p>
              </div>
              <div className="rounded-lg border border-rose-300 bg-rose-50/90 px-2 py-1.5 shadow-sm dark:border-rose-400/40 dark:bg-rose-500/10">
                <p className="font-semibold text-rose-800 dark:text-rose-100">Tip</p>
                <p className="mt-0.5 text-[10px] text-rose-700 dark:text-rose-200">Install once, keep SOLAR open, then refresh uploads whenever section availability changes.</p>
              </div>
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
              {[
                {
                  title: "Private by design",
                  body: "Curriculum files, section uploads, and planner tweaks never leave your browser—no passwords or grades hit another server.",
                  icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
                },
                {
                  title: "One import powers all tools",
                  body: "Upload once and Course Tracker, Schedule Maker, and Academic Planner stay in sync without retyping anything.",
                  icon: <Repeat2 className="h-4 w-4 text-blue-600" />,
                },
                {
                  title: "Secure source data",
                  body: "Sections come from SOLAR after you sign in with Microsoft 2FA, so only authenticated students can pull the latest offerings.",
                  icon: <ShieldCheck className="h-4 w-4 text-cyan-600" />,
                },
                {
                  title: "Hop between devices",
                  body: "Need to plan on a lab PC? Re-import the same HTML or extension payload and you're caught up in seconds.",
                  icon: <Laptop className="h-4 w-4 text-purple-600" />,
                },
                {
                  title: "Share with blockmates",
                  body: "Export CSV/JSON/ICS so friends can compare schedules, avoid conflicts, or merge plans for petitions.",
                  icon: <Share2 className="h-4 w-4 text-amber-600" />,
                },
                {
                  title: "Always in the loop",
                  body: "Patch Notes list every change and the Send Feedback button reaches the maintainer when something breaks.",
                  icon: <MessageSquare className="h-4 w-4 text-rose-600" />,
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {item.icon}
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Everything lives locally, so refreshing uploads or re-importing files is the fastest way to recover or move between machines.
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
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">What's Next?</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  <ToolPill
                    label="Course Tracker"
                    className="bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
                  />
                  <span className="ml-2">
                    Mark every passed or active course so prerequisites stay accurate.
                  </span>
                </li>
                <li>
                  <ToolPill
                    label="Schedule Maker"
                    className="bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-100"
                  />
                  <span className="ml-2">
                    In Available Courses, add the subjects you plan to take while comparing sections.
                  </span>
                </li>
                <li>
                  <ToolPill
                    label="Schedule Maker"
                    className="bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-100"
                  />
                  <span className="ml-2">
                    Switch to Selected Courses to fine-tune names, rooms, and notes for the timetable and exported .ics file.
                  </span>
                </li>
                <li>
                  <ToolPill
                    label="Schedule Maker"
                    className="bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-100"
                  />
                  <span className="ml-2">
                    Set the Schedule View start date to the first day of class you will attend (match the weekday of your earliest session).
                  </span>
                </li>
                <li>
                  <ToolPill
                    label="Academic Planner"
                    className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100"
                  />
                  <span className="ml-2">
                    Map future terms, verify the suggested load, and adjust it to hit your earliest graduation date.
                  </span>
                </li>
              </ol>
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              <Button variant="outline" className="justify-center gap-2" onClick={handleOpenCourseTracker}>
                <BookOpenCheck className="h-4 w-4" />
                Jump to Course Tracker
              </Button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <input
        type="file"
        ref={unifiedBackupInputRef}
        accept=".json,application/json"
        onChange={handleUnifiedBackupImport}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <Dialog open={skipImportStatusOpen} onOpenChange={setSkipImportStatusOpen}>
        <DialogContent
          hideCloseButton
          overlayClassName="z-[14080] ease-in-out data-[state=open]:duration-300 data-[state=closed]:duration-200"
          className="z-[14090] max-w-sm ease-in-out data-[state=open]:duration-300 data-[state=closed]:duration-200"
        >
          <DialogHeader>
            <DialogTitle>
              {skipImportStatus === "loading" ? "Importing Data" : skipImportStatus === "success" ? "Import Complete" : "Import Failed"}
            </DialogTitle>
            <DialogDescription>{skipImportStatusMessage}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-3">
            {skipImportStatus === "loading" ? (
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            ) : skipImportStatus === "success" ? (
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
            ) : (
              <Upload className="h-8 w-8 text-rose-600" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
        hideCloseButton
        onInteractOutside={(event) => event.preventDefault()}
        className={cn(
          "border-none bg-transparent p-0 shadow-none",
          isMobileLayout
            ? "inset-0 h-auto w-auto max-h-none max-w-none translate-x-0 translate-y-0 rounded-none"
            : "max-w-3xl"
        )}
      >
        <DialogTitle className="sr-only">ComParEng onboarding</DialogTitle>
        <div
          className={cn(
            "relative flex h-full max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900",
            isRewardThemeSlide && "border-amber-200/20 bg-gradient-to-br from-[#2a180f] via-[#19141e] to-[#0d0b12] text-amber-50",
            isMobileLayout && "h-full min-h-full max-h-none overflow-y-auto rounded-none border-none"
          )}
        >
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-blue-400 to-amber-400",
              isRewardThemeSlide && "from-amber-300 via-orange-400 to-amber-500"
            )}
          />
          <div
            className={cn(
              "flex items-center justify-between border-b border-slate-100 px-6 py-4 text-sm font-medium uppercase tracking-wide dark:border-white/10",
              isRewardThemeSlide && "border-white/10 text-amber-100"
            )}
          >
            <span>Guided onboarding</span>
            {activeSlide.id !== "wrap-up" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className={cn(
                  isRewardThemeSlide &&
                    "border border-amber-300/40 text-amber-100 hover:bg-amber-100/10 hover:text-white"
                )}
              >
                Skip tour
              </Button>
            )}
          </div>
          {/* Scrollable slide content */}
          <div className={cn("flex-1 min-h-0 px-6 pb-4 pt-5", isScheduleMakerSlide && !isMobileLayout ? "overflow-hidden" : "overflow-y-auto")}>
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
                    isRewardThemeSlide && "bg-amber-100/10 text-amber-100",
                    (isMobileLayout || isWelcomeSlide) && "mb-1"
                  )}
                  style={
                    isWelcomeSlide
                      ? { width: WELCOME_ICON_WRAPPER_SIZE_PX, height: WELCOME_ICON_WRAPPER_SIZE_PX }
                      : undefined
                  }
                  aria-hidden
                >
                  {activeSlide.icon}
                </div>
                <div className={cn("text-left", (isMobileLayout || isWelcomeSlide) && "text-center")}
                >
                  <h2 className="text-2xl font-semibold leading-tight">{activeSlide.title}</h2>
                  <p className={cn("text-sm text-muted-foreground", isRewardThemeSlide && "text-amber-100/80")}>{activeSlide.description}</p>
                </div>
              </div>
              {renderSlideContent(activeSlide.id)}
            </div>
          </div>
          <div className={cn("mt-auto border-t border-slate-100 px-6 py-4 dark:border-white/10", isRewardThemeSlide && "border-white/10")}>
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
                    className={cn(
                      isMobileLayout && "w-full justify-center py-3 text-base",
                      isRewardThemeSlide &&
                        "border border-amber-300/40 text-white hover:bg-amber-100/10 hover:text-white"
                    )}
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={goNext}
                  disabled={nextDisabled}
                  className={cn(
                    isMobileLayout && "w-full justify-center py-3 text-base",
                    isRewardThemeSlide &&
                      "border border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-100/10 hover:text-white"
                  )}
                >
                  {isLastSlide ? "Finish" : "Next"}
                </Button>
              </div>
              <p className={cn("text-xs text-muted-foreground", isRewardThemeSlide && "text-amber-100/75", isMobileLayout && "text-center")}
              >
                Tip: Reopen this tour anytime using the Start Onboarding button on the homepage.
              </p>
            </div>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <Dialog open={extensionConfirmOpen} onOpenChange={(nextOpen) => (!nextOpen ? handleExtensionCancel() : null)}>
        <DialogContent onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Install the Course Data Extractor first</DialogTitle>
            <DialogDescription>
              Schedule Maker and Academic Planner rely on the Chrome extension. Without it, live sections and planner data
              will not stay in sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Use the Chrome Web Store button on this slide to install the extension, then sign in to SOLAR so uploads work
              instantly.
            </p>
            <p>Only continue if the extension is already installed or you understand the limitations.</p>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleExtensionCancel} className="w-full sm:w-auto">
              I'll install it
            </Button>
            <Button
              onClick={handleExtensionConfirm}
              className={cn(
                "w-full text-white focus-visible:ring-2 sm:w-auto",
                extensionConfirmAction === "skip"
                  ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
                  : "bg-green-600 hover:bg-green-700 focus-visible:ring-green-600"
              )}
            >
              {extensionConfirmAction === "skip" ? "Continue without it" : "Already installed! Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={generalSkipPromptOpen} onOpenChange={(nextOpen) => (!nextOpen ? setGeneralSkipPromptOpen(false) : null)}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Skip the rest of the tour?</DialogTitle>
            <DialogDescription>
              The next slides cover must-know tips for Course Tracker, Schedule Maker, and Academic Planner. You can always
              return later from the homepage.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-dashed bg-blue-50/70 p-4 text-sm text-blue-900 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100">
            <p className="font-semibold">Already have an all tools data file?</p>
            <p className="mt-1 text-xs opacity-90">
              Import your downloaded backup to restore everything, then we'll skip onboarding automatically.
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full gap-2"
              onClick={openUnifiedBackupPicker}
              disabled={skipImporting}
            >
              {skipImporting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import all tools data
                </>
              )}
            </Button>
          </div>
          <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
            <p className="font-semibold">Before you skip:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>You'll miss quick-start guidance for the remaining tools.</li>
              <li>The onboarding button on the homepage reopens this walkthrough anytime.</li>
            </ul>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleGeneralSkipStay}>
              Continue onboarding
            </Button>
            <Button
              variant="destructive"
              className="w-full bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 sm:w-auto"
              onClick={handleGeneralSkipConfirm}
            >
              Skip tour now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cpeSkipPromptOpen} onOpenChange={(openState) => (!openState ? setCpeSkipPromptOpen(false) : null)}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {cpeSkipPromptContext === "missing-upload" ? "Upload your curriculum before skipping?" : "Keep CpE defaults?"}
            </DialogTitle>
            <DialogDescription>
              {cpeSkipPromptContext === "missing-upload"
                ? "You selected \"Nope\" which means we need your program's curriculum to keep prerequisites accurate."
                : "Skipping now ends the tour and keeps the default FEU Tech CpE curriculum until you import something else."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-dashed bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {cpeSkipPromptContext === "missing-upload" ? (
              <>
                <p className="font-semibold">Without that HTML file:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>We'll fall back to the default CpE curriculum.</li>
                  <li>Course Tracker and Scheduler might hide the classes you really need.</li>
                </ul>
                <p className="mt-3 text-xs opacity-80">
                  Upload now to stay aligned, or continue and import later inside Course Tracker.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Need to see the defaults first?</p>
                <p className="mt-2">
                  Skipping lets you dive right in, but you can always reopen this onboarding later from the homepage if you
                  change your mind.
                </p>
                <p className="mt-3 text-xs opacity-80">Choose Continue to keep exploring the tour, or Skip to finish now.</p>
              </>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleCpeSkipPrimaryAction}>
              {cpeSkipPromptContext === "missing-upload" ? "Upload file now" : "Continue onboarding"}
            </Button>
            <Button
              variant="destructive"
              className="w-full bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 sm:w-auto"
              onClick={handleCpeSkipContinue}
            >
              {cpeSkipPromptContext === "missing-upload" ? "Continue without upload" : "Skip tour anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditLimitDialogOpen} onOpenChange={(nextOpen) => (!nextOpen ? handleCreditLimitSkip() : null)}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Set your program's unit limits</DialogTitle>
            <DialogDescription>
              Check your Course Registration / OSES page for the minimum and maximum credits allowed per term. We'll use
              those numbers in Academic Planner so high-unit programs don't see false overload warnings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Minimum credits per term</label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={creditLimitMin}
                onChange={(event) => {
                  const nextValue = Number.parseFloat(event.target.value)
                  setCreditLimitMin(Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue))
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">Internship-only terms ignore this floor automatically.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Maximum credits per term</label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={creditLimitMax}
                onChange={(event) => {
                  const nextValue = Number.parseFloat(event.target.value)
                  setCreditLimitMax(Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue))
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We still block extreme overloads, but this cap lets Planner warn you earlier when you're above your comfort
                zone.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              You can tweak these anytime via Credit Load Preferences inside Academic Planner.
            </p>
            {creditLimitError && <p className="text-sm text-rose-600 dark:text-rose-300">{creditLimitError}</p>}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={handleCreditLimitSkip}>
              Skip for now
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreditLimitSave}>
              Save limits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
