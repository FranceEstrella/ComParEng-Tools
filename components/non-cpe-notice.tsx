"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Info, ExternalLink, Upload, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface NonCpeNoticeProps {
  compact?: boolean
  onReportIssue?: () => void
}

const NON_CPE_STORAGE_KEY = "compareng.nonCpeNotice.dismissed"
export const NON_CPE_NOTICE_DISMISS_EVENT = "compareng:nonCpeNoticeDismissed" as const

export const markNonCpeNoticeDismissed = () => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(NON_CPE_STORAGE_KEY, "true")
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new Event(NON_CPE_NOTICE_DISMISS_EVENT))
}

export default function NonCpeNotice({ compact = false, onReportIssue }: NonCpeNoticeProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showNotice, setShowNotice] = useState(true)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(NON_CPE_STORAGE_KEY) === "true"
      setShowNotice(!dismissed)
    } catch {
      // ignore storage failures
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleGlobalDismiss = () => setShowNotice(false)
    window.addEventListener(NON_CPE_NOTICE_DISMISS_EVENT, handleGlobalDismiss)
    return () => window.removeEventListener(NON_CPE_NOTICE_DISMISS_EVENT, handleGlobalDismiss)
  }, [])

  const dismissNotice = () => {
    setShowNotice(false)
    markNonCpeNoticeDismissed()
  }

  const goToImport = () => {
    try {
      if (pathname === "/course-tracker") {
        // ensure hash is set so Course Tracker auto-expands Save & Load
        if (typeof window !== "undefined") {
          try { window.location.hash = "#import" } catch {}
        }
        const el = document.getElementById("import-curriculum")
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
          return
        }
      }
      router.push("/course-tracker#import")
    } catch {
      router.push("/course-tracker#import")
    }
  }

  if (!showNotice) return null
  return (
    <Alert className="relative mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 pr-10">
      <button
        type="button"
        className="absolute right-3 top-3 rounded-full p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/40"
        aria-label="Dismiss alternative curriculum notice"
        onClick={dismissNotice}
      >
        <X className="h-4 w-4" />
      </button>
      <Info className="h-4 w-4" />
      <AlertTitle>Using a different program or curriculum?</AlertTitle>
      <AlertDescription>
        <div className="space-y-2 text-sm mt-2">
          <p>
            If you are not a Computer Engineering student, you can still use these tools by importing your own curriculum
            from the FEU Tech Student Portal.
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Sign in to SOLAR and open
              <Button
                variant="link"
                className="text-blue-700 dark:text-blue-300 p-0 h-auto ml-1"
                onClick={() => window.open("https://solar.feutech.edu.ph/program/curriculum", "_blank")}
              >
                Program Curriculum <ExternalLink className="inline h-3 w-3" />
              </Button>
            </li>
            <li>Press Ctrl+S (or right-click → Save as) to save the page as an HTML file.</li>
            <li>
              Go to the Course Tracker and click
              <span className="font-medium"> Import Curriculum (HTML)</span>, then select your saved file.
            </li>
          </ol>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={() => window.open("https://solar.feutech.edu.ph/program/curriculum", "_blank")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" /> Open Program Curriculum
            </Button>
            <Button variant="outline" className="bg-transparent flex items-center gap-2" onClick={goToImport}>
              <Upload className="h-4 w-4" /> Import in Course Tracker
            </Button>
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => {
                if (onReportIssue) onReportIssue()
                else window.open(
                  "mailto:dozey.help@gmail.com?subject=Non-CpE%20curriculum%20import%20issue&body=Describe%20the%20issue%20you%20encountered%20(import%20steps%2C%20program%2C%20sample%20HTML).",
                  "_blank"
                )
              }}
            >
              Report an issue
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
