"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import FeedbackDialog from "@/components/feedback-dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { setFeedbackContextHint, getFeedbackContextHint } from "@/lib/feedback-context"

export default function ReportIssueButton() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hint, setHint] = useState<string>("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const resolveContext = (node: HTMLElement | null): string => {
      if (!node) return ""
      const feedbackNode = node.closest("[data-feedback-context]") as HTMLElement | null
      if (feedbackNode?.dataset.feedbackContext) {
        return feedbackNode.dataset.feedbackContext
      }

      const actionable = node.closest("button, a, [role=button], [role=link], input, select, textarea") as HTMLElement | null
      const source = actionable || node
      const aria = source.getAttribute("aria-label") || source.getAttribute("title")
      if (aria && aria.trim()) return aria.trim()

      const text = source.textContent?.trim() || ""
      if (text) return text

      const tag = source.tagName.toLowerCase()
      if (["button", "a"].includes(tag)) return tag
      return ""
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const isTrigger = Boolean(target.closest("[data-report-trigger]"))
      if (isTrigger) return

      const raw = resolveContext(target)
      const normalized = raw ? raw.replace(/\s+/g, " ").slice(0, 140) : ""
      if (!normalized) return
      setFeedbackContextHint(normalized)
      setHint(normalized)
    }

    document.addEventListener("click", handleClick, true)
    const existing = getFeedbackContextHint().hint
    if (existing) {
      setHint(existing)
    }
    return () => document.removeEventListener("click", handleClick, true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <>
      <div className="pointer-events-none fixed bottom-24 right-4 z-[9999] md:bottom-6 md:right-6">
        <Button
          size="icon"
          variant="secondary"
          className="pointer-events-auto h-11 w-11 rounded-full shadow-lg shadow-red-500/35 ring-1 ring-red-500/30 hover:ring-red-500/50"
          onClick={() => setOpen(true)}
          data-report-trigger
          aria-label="Report an issue"
        >
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="sr-only">Report an issue</span>
        </Button>
      </div>
      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        defaultSubject="Quick bug report"
        contextHint={hint || "Previous action not captured"}
      />
    </>,
    document.body
  )
}
