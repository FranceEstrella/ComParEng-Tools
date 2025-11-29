"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import FeedbackDialog from "@/components/feedback-dialog"
import { Button } from "@/components/ui/button"

export default function ReportIssueButton() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] sm:bottom-6 sm:right-6">
        <Button
          size="sm"
          variant="secondary"
          className="pointer-events-auto shadow-lg shadow-emerald-500/30"
          onClick={() => setOpen(true)}
          data-report-trigger
        >
          Report an issue
        </Button>
      </div>
      <FeedbackDialog open={open} onOpenChange={setOpen} defaultSubject="Quick bug report" />
    </>,
    document.body
  )
}
