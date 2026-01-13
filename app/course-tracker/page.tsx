"use client"

import CourseTracker from "@/components/course-tracker"
import { ThemeProvider } from "@/components/theme-provider"
import { useEffect } from "react"
import { trackAnalyticsEvent } from "@/lib/analytics-client"

export default function CourseTrackerPage() {
  useEffect(() => {
    trackAnalyticsEvent("course_tracker.page_view")
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[-5%] h-48 w-48 rounded-full bg-sky-200 opacity-50 blur-3xl dark:bg-sky-800/40" />
          <div className="absolute right-[5%] top-[15%] h-56 w-56 rounded-full bg-indigo-200 opacity-50 blur-3xl dark:bg-indigo-800/40" />
          <div className="absolute bottom-[-10%] left-[20%] h-64 w-64 rounded-full bg-emerald-200 opacity-40 blur-3xl dark:bg-emerald-800/30" />
        </div>

        <div className="container relative mx-auto px-4 py-10">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-2 shadow-2xl shadow-sky-100 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none sm:p-4">
            <CourseTracker />
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
