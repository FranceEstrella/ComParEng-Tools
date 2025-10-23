"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultSubject?: string
}

export default function FeedbackDialog({ open, onOpenChange, defaultSubject = "" }: FeedbackDialogProps) {
  const [fbName, setFbName] = useState("")
  const [fbSubject, setFbSubject] = useState(defaultSubject)
  const [fbMessage, setFbMessage] = useState("")
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([])
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const subjectMissing = !fbSubject.trim()
  const messageMissing = fbMessage.trim().length < 10

  useEffect(() => {
    try {
      const raw = localStorage.getItem("feedbackHistory")
      if (raw) setFeedbackHistory(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    // Reset fields whenever reopened
    if (open) {
      setStatus("idle")
      setStatusMessage("")
      setFbSubject(defaultSubject || "")
    }
  }, [open, defaultSubject])

  const saveLocalFeedback = (entry: any) => {
    const next = [entry, ...feedbackHistory].slice(0, 20)
    setFeedbackHistory(next)
    try {
      localStorage.setItem("feedbackHistory", JSON.stringify(next))
    } catch {}
  }

  const copyFeedback = async () => {
    const content = `To: dozey.help@gmail.com\nSubject: ${fbSubject}\n\nFrom: ${fbName}\n\n${fbMessage}`
    try {
      await navigator.clipboard.writeText(content)
      saveLocalFeedback({ name: fbName, subject: fbSubject, message: fbMessage, date: new Date().toISOString(), sentVia: "copied" })
      setStatus("success")
      setStatusMessage("Copied to clipboard. Paste into your email app.")
    } catch (e) {
      setStatus("error")
      setStatusMessage("Copy failed")
    }
  }

  const sendFeedbackMail = () => {
    const body = encodeURIComponent(`From: ${fbName}\n\n${fbMessage}`)
    const mailto = `mailto:dozey.help@gmail.com?subject=${encodeURIComponent(fbSubject)}&body=${body}`
    saveLocalFeedback({ name: fbName, subject: fbSubject, message: fbMessage, date: new Date().toISOString(), sentVia: "mailto" })
    window.location.href = mailto
  }

  const sendFeedbackToServer = async () => {
    try {
      setStatus("sending")
      setStatusMessage("")
      const res = await fetch("/api/send-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fbName, subject: fbSubject, message: fbMessage }),
      })
      const json = await res.json()
      if (json?.success) {
        saveLocalFeedback({ name: fbName, subject: fbSubject, message: fbMessage, date: new Date().toISOString(), sentVia: "server" })
        setStatus("success")
        setStatusMessage("Feedback sent to server")
        setFbName("")
        setFbSubject(defaultSubject || "")
        setFbMessage("")
      } else {
        setStatus("error")
        setStatusMessage(json?.error || "Server send failed")
      }
    } catch (e: any) {
      setStatus("error")
      setStatusMessage(e?.message || "Server send failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>If you have suggestions or issues, send them to dozey.help@gmail.com</DialogDescription>
        </DialogHeader>

        {status === "idle" || status === "sending" ? (
          <div className="space-y-3 py-2">
            <Input placeholder="Your name (optional)" value={fbName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFbName(e.target.value)} />
            <Input placeholder="Subject" value={fbSubject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFbSubject(e.target.value)} />
            <textarea
              placeholder="Message"
              value={fbMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFbMessage(e.target.value)}
              className="w-full p-2 border rounded h-36 bg-white dark:bg-gray-800 dark:border-gray-700"
            />
            <div className="flex gap-2 justify-end items-center">
              <Button variant="outline" onClick={copyFeedback} disabled={status === "sending"}>Copy & Send Manually</Button>
              <Button onClick={sendFeedbackMail} disabled={status === "sending"}>Open Mail Client</Button>
              <div className="flex items-center">
                <Button disabled={status === "sending" || subjectMissing || messageMissing} onClick={async () => { await sendFeedbackToServer() }}>
                  {status === "sending" ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                      Sending...
                    </span>
                  ) : (
                    "Send to Server"
                  )}
                </Button>
              </div>
            </div>

            {(subjectMissing || messageMissing) && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">Subject and message are required to send feedback.</div>
            )}

            {feedbackHistory.length > 0 && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="font-medium mb-1">Recent feedback</div>
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {feedbackHistory.slice(0, 5).map((h, i) => (
                    <li key={i} className="border rounded p-2 bg-gray-50 dark:bg-gray-800">
                      <div className="text-xs text-gray-500">{new Date(h.date).toLocaleString()} • {h.sentVia}</div>
                      <div className="font-medium">{h.subject}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 truncate">{h.message}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center">
            {status === "success" ? (
              <>
                <h4 className="text-lg font-bold text-green-600">Feedback Sent</h4>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{statusMessage || "Thank you for your feedback."}</p>
                <div className="mt-4">
                  <Button onClick={() => onOpenChange(false)}>Close</Button>
                </div>
              </>
            ) : (
              <>
                <h4 className="text-lg font-bold text-red-700">Failed to Send</h4>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{statusMessage || "There was an error sending your feedback."}</p>
                <div className="mt-4 flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => { setStatus("idle"); setStatusMessage("") }}>Try Again</Button>
                  <Button onClick={() => onOpenChange(false)}>Close</Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
