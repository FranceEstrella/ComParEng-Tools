"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { BookOpen, Calendar, GraduationCap, Download, ExternalLink, Info, X } from "lucide-react"
import PatchNotesButton from "@/components/patch-notes"
import { ThemeProvider } from "@/components/theme-provider"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Spinner from "@/components/ui/spinner"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { orderedPatchNotes } from "@/lib/patch-notes"
import { MESSAGE_MIN } from "../lib/config"
import NonCpeNotice, { markNonCpeNoticeDismissed } from "@/components/non-cpe-notice"
import FeedbackDialog from "@/components/feedback-dialog"
import OnboardingDialog from "@/components/onboarding-dialog"

export default function Home() {
  const { theme, setTheme } = useTheme()
  // Feedback state (popup in Patch Notes)
  const [copied, setCopied] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState("")
  const [toastType, setToastType] = useState<"success" | "error" | "">("")
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [feedbackStatusMessage, setFeedbackStatusMessage] = useState("")
  const [feedbackDefaultSubject, setFeedbackDefaultSubject] = useState<string>("")
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [shouldAutoOpenWhatsNew, setShouldAutoOpenWhatsNew] = useState(false)
  const [showExtensionCard, setShowExtensionCard] = useState(true)
  

  useEffect(() => {
    try {
      const raw = localStorage.getItem("feedbackHistory")
      if (raw) setFeedbackHistory(JSON.parse(raw))
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => {
      setToastMessage("")
      setToastType("")
    }, 3000)
    return () => clearTimeout(t)
  }, [toastMessage])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    try {
      const completed = localStorage.getItem("compareng.onboarding.completed") === "true"
      setHasCompletedOnboarding(completed)
      setShouldAutoOpenWhatsNew(completed)
      if (!completed) {
        timeout = setTimeout(() => setOnboardingOpen(true), 400)
      }
    } catch {
      // ignore storage failures
    }
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  const completeOnboarding = (options?: { deferWhatsNew?: boolean; source?: "finish" | "jump" | "skip" }) => {
    try {
      localStorage.setItem("compareng.onboarding.completed", "true")
    } catch {
      // ignore storage failures
    }
    setHasCompletedOnboarding(true)
    if (options?.source === "finish" || options?.source === "jump") {
      dismissExtensionCard()
      markNonCpeNoticeDismissed()
    }
    if (options?.deferWhatsNew) {
      try {
        sessionStorage.setItem("compareng.deferWhatsNew", "true")
      } catch {
        // ignore
      }
      setShouldAutoOpenWhatsNew(false)
    } else {
      setShouldAutoOpenWhatsNew(true)
    }
    setOnboardingOpen(false)
  }

  useEffect(() => {
    try {
      const shouldDefer = sessionStorage.getItem("compareng.deferWhatsNew") === "true"
      if (shouldDefer) {
        sessionStorage.removeItem("compareng.deferWhatsNew")
        setShouldAutoOpenWhatsNew(true)
      }
    } catch {
      // ignore storage failures
    }
  }, [])

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("compareng.extensionCard.dismissed") === "true"
      setShowExtensionCard(!dismissed)
    } catch {
      // ignore storage failures
    }
  }, [])

  const dismissExtensionCard = () => {
    setShowExtensionCard(false)
    try {
      localStorage.setItem("compareng.extensionCard.dismissed", "true")
    } catch {
      // ignore storage failures
    }
  }

  const saveLocalFeedback = (entry: any) => {
    const next = [entry, ...feedbackHistory].slice(0, 20)
    setFeedbackHistory(next)
    try {
      localStorage.setItem("feedbackHistory", JSON.stringify(next))
    } catch (e) {
      // ignore
    }
  }

  // Feedback logic moved to FeedbackDialog component; keep toast helpers intact for other uses

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <OnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onComplete={completeOnboarding}
        hasCompletedOnce={hasCompletedOnboarding}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        {/* Simple toast notification (uses Alert for consistent UI) */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 w-80">
            <Alert variant={toastType === "error" ? "destructive" : "default"} className={toastType === "error" ? "" : "bg-green-600 text-white border-green-600"}>
              <div className="flex flex-col">
                <AlertTitle className={toastType === "error" ? "" : "text-white"}>{toastType === "error" ? "Error" : "Success"}</AlertTitle>
                <AlertDescription className={toastType === "error" ? "" : "text-white"}>{toastMessage}</AlertDescription>
              </div>
            </Alert>
          </div>
        )}
        <div className="fixed inset-x-0 top-0 z-40">
          <div className="w-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 p-2 text-center text-xs md:text-sm">
            <span className="font-semibold">Disclaimer:</span> This is a personal project and is NOT officially affiliated with FEU Tech or the FEU Tech CpE Department.
          </div>
        </div>
        <div className="container mx-auto px-4 pb-12 pt-16">
          <div className="max-w-5xl mx-auto">
            {/* Header with Dark Mode Toggle */}
            <div className="relative mb-8 text-center md:pt-12">
              {/* Keep actions above the title and prevent overlap on small screens */}
              <div className="flex justify-center md:justify-end items-center gap-2 mb-4 md:mb-0 md:absolute md:right-0 md:top-0">
                <Button
                  variant="outline"
                  className="bg-white/80 text-slate-900 border-slate-300 hover:bg-white dark:bg-white/10 dark:text-white dark:border-white/40 dark:hover:bg-white/20"
                  onClick={() => setOnboardingOpen(true)}
                >
                  Start Onboarding
                </Button>
                <PatchNotesButton autoOpenOnce={shouldAutoOpenWhatsNew} buttonLabel="What's New" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                  className="rounded-full border-slate-300 bg-white/80 text-slate-900 hover:bg-white transition-colors dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mx-auto max-w-3xl">
                FEU Tech ComParEng Tools
              </h1>
            </div>

            {/* Hero Section */}
            <div className="text-center mb-8">
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                A collection of tools designed to help Computer Engineering students at FEU Tech manage their academic
                journey more effectively.
              </p>
            </div>

            {/* Extension Installation Guide */}
            {showExtensionCard && (
              <Card className="relative mb-8 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/40"
                  aria-label="Dismiss extension install reminder"
                  onClick={dismissExtensionCard}
                >
                  <X className="h-4 w-4" />
                </button>
                <CardHeader className="gap-2">
                  <CardTitle className="flex items-center gap-2 pr-8">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Extension Installation Required
                  </CardTitle>
                  <CardDescription>
                    For full functionality of Schedule Maker and Academic Planner, please install the ComParEng Course
                    Data Extractor Extension
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <Button
                      className="w-full flex items-center gap-2"
                      onClick={() =>
                        window.open(
                          "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                          "_blank",
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Install Extension
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                          View Installation Guide
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>ComParEng Academic Tools Web App - Installation Guide</DialogTitle>
                          <DialogDescription>Follow these steps to install and use the extension</DialogDescription>
                        </DialogHeader>

                      {/* Content moved outside DialogDescription */}
                      <div className="space-y-4 mt-4">
                        <div>
                          <h3 className="font-bold">Pre-requisites (for Schedule Maker and Academic Planner):</h3>
                          <p>Install ComParEng Course Data Extractor Extension</p>
                        </div>

                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
                          <ol className="list-decimal pl-5 space-y-2">
                            <li>
                              Download the extension from the &nbsp;
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                                onClick={() =>
                                  window.open(
                                    "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                                    "_blank",
                                  )
                                }
                              >
                                chrome web store. <ExternalLink className="h-3 w-3 inline" />
                              </Button>
                            </li>
                            <li>Click the "Add to Chrome" button to install.</li>
                            <li>A popup will open and click "Add extension".</li>
                          </ol>

                          <p className="font-medium mt-4">You have successfully installed the extension!</p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h3 className="font-bold mb-2">Using the Extension:</h3>
                          <ol className="list-decimal pl-5 space-y-2">
                            <li>
                              Login to SOLAR and go to{" "}
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                                onClick={() => window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")}
                              >
                                https://solar.feutech.edu.ph/course/offerings
                              </Button>
                            </li>
                            <li>Select the current term and school year.</li>
                            <li>
                              Open the ComParEng Tools Web App:
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal ml-2"
                                onClick={() => window.open("https://compareng-tools.vercel.app/", "_blank")}
                              >
                                https://compareng-tools.vercel.app/
                              </Button>
                            </li>
                          </ol>
                          <p className="font-medium mt-4">You are ready to use the App!</p>
                        </div>
                      </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Non-CpE Student Notice */}
            <NonCpeNotice
              onReportIssue={() => {
                setFeedbackDefaultSubject("Issue: Importing Program Curriculum")
                setFeedbackDialogOpen(true)
              }}
            />

            {/* Tools Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* Course Tracker Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105">
                <div className="bg-blue-700 dark:bg-blue-900 bg-gradient-to-r from-blue-600 to-blue-800 p-6">
                  <BookOpen className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Course Tracker</h2>
                  <p className="text-blue-100 mt-2">Track your academic progress through the CpE curriculum</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Mark courses as Pending, Active, or Passed</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View prerequisites and dependent courses</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Track your progress through the curriculum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>See which courses you can take next</span>
                    </li>
                  </ul>
                  <Link
                    href="/course-tracker"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Open Course Tracker
                  </Link>
                </div>
              </div>

              {/* Schedule Maker Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105">
                <div className="bg-purple-700 dark:bg-purple-900 bg-gradient-to-r from-purple-600 to-purple-800 p-6">
                  <Calendar className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Schedule Maker</h2>
                  <p className="text-purple-100 mt-2">Create your perfect class schedule with ease</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View available course sections</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Filter courses in your curriculum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Check for schedule conflicts</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Optimize your weekly schedule</span>
                    </li>
                  </ul>
                  <Link
                    href="/schedule-maker"
                    className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Open Schedule Maker
                  </Link>
                </div>
              </div>

              {/* Academic Planner Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105">
                <div className="bg-green-700 dark:bg-green-900 bg-gradient-to-r from-green-600 to-green-800 p-6">
                  <GraduationCap className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Academic Planner</h2>
                  <p className="text-green-100 mt-2">Plan your path to graduation efficiently</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Get personalized course recommendations</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Optimize your remaining semesters</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Identify courses needing petitions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Estimate your graduation timeline</span>
                    </li>
                  </ul>
                  <Link
                    href="/academic-planner"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    Open Academic Planner
                  </Link>
                </div>
              </div>
            </div>

            {/* Patch Notes Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Patch Notes</CardTitle>
                <CardDescription>Latest updates and improvements to the ComParEng Tools</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={orderedPatchNotes[0]?.version ?? "latest"}>
                  {/* Make the version tabs horizontally scrollable on small screens and contained within the card */}
                  <div className="mb-4 overflow-x-auto">
                    <TabsList className="min-w-full w-max flex-nowrap">
                      {orderedPatchNotes.map((note) => (
                        <TabsTrigger key={note.version} value={note.version} className="whitespace-nowrap">
                          {note.version}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {orderedPatchNotes.map((note) => (
                    <TabsContent key={note.version} value={note.version}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">{note.version}</h3>
                          <Badge variant="outline">{note.date}</Badge>
                        </div>
                        <ul className="space-y-2">
                          {note.changes.map((change, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span className="whitespace-pre-line">{change.description}</span>
                            </li>
                          ))}
                        </ul>
                        {note.hotfixes?.length ? (
                          <div className="mt-4 rounded-lg border border-amber-300/70 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
                            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-100">
                              Hotfixes
                            </p>
                            <div className="mt-3 space-y-3">
                              {note.hotfixes.map((hotfix) => (
                                <div key={hotfix.date}>
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">{hotfix.date}</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                                    {hotfix.items.map((item, idx) => (
                                      <li key={`${hotfix.date}-${idx}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
              <CardFooter className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <div>If you encounter any issues with the app, feel free to message them to our page.</div>
                <div>
                  <Dialog open={feedbackDialogOpen} onOpenChange={(open) => setFeedbackDialogOpen(open)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFeedbackDefaultSubject("")}
                      >
                        Send Feedback
                      </Button>
                    </DialogTrigger>
                    {/* Controlled feedback dialog */}
                    <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} defaultSubject={feedbackDefaultSubject} />
                  </Dialog>
                </div>
              </CardFooter>
            </Card>

            {/* About Section */}

            {/* Hello there! nyehehehe */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">About These Tools</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                These tools were created to help FEU Tech Computer Engineering students plan their academic journey more
                effectively. They are not officially affiliated with FEU Tech or the FEU Tech CpE Department.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Created by France Estrella. For feedback or suggestions, please reach out via the{" "}
                <Button
                  variant="link"
                  className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                  onClick={() => window.open("https://www.facebook.com/feutechCpEO", "_blank")}
                >
                  CpEO Page
                </Button>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
