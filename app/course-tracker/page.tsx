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
      <div className="container mx-auto py-8">
        <CourseTracker />
      </div>
    </ThemeProvider>
  )
}
