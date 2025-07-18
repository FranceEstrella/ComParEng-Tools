"use client"

import CourseTracker from "@/components/course-tracker"
import { ThemeProvider } from "@/components/theme-provider"

export default function CourseTrackerPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <div className="container mx-auto py-8">
        <CourseTracker />
      </div>
    </ThemeProvider>
  )
}
