"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone, X } from "lucide-react"

const PERMANENT_HIDE_KEY = "installBanner.permanentHide"
const SESSION_DISMISS_KEY = "installBanner.sessionDismissed"
const SNOOZE_KEY = "installBanner.snoozedSession"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
}

type DeferredPrompt = BeforeInstallPromptEvent | null

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt>(null)
  const [statusMessage, setStatusMessage] = useState("Preparing install options…")

  useEffect(() => {
    if (typeof window === "undefined") return

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any)?.standalone
    if (isStandalone) return

    let permanentlyHidden = false
    try {
      permanentlyHidden = localStorage.getItem(PERMANENT_HIDE_KEY) === "true"
    } catch {}

    let dismissedThisSession = false
    try {
      dismissedThisSession = sessionStorage.getItem(SESSION_DISMISS_KEY) === "true"
    } catch {}

    let snoozedThisSession = false
    try {
      snoozedThisSession = sessionStorage.getItem(SNOOZE_KEY) === "true"
    } catch {}

    const shouldReveal = !permanentlyHidden && !dismissedThisSession && !snoozedThisSession

    const handleBeforeInstallPrompt: EventListener = (event) => {
      if (!shouldReveal) return
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setDeferredPrompt(promptEvent)
      setVisible(true)
      setStatusMessage("Install prompt is getting ready—hang tight.")
    }

    const handleAppInstalled = () => {
      setVisible(false)
      try {
        sessionStorage.setItem(SESSION_DISMISS_KEY, "true")
        localStorage.setItem(PERMANENT_HIDE_KEY, "true")
      } catch {}
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    if (shouldReveal) {
      setVisible(true)
      setStatusMessage("Install prompt will enable once your browser is ready.")
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (deferredPrompt) {
      setStatusMessage("Install prompt ready! Tap Install to continue.")
    }
  }, [deferredPrompt])

  if (!visible) return null

  const hide = () => setVisible(false)

  const snooze = () => {
    hide()
    try {
      sessionStorage.setItem(SNOOZE_KEY, "true")
    } catch {}
    setDeferredPrompt(null)
    setStatusMessage("Preparing install options…")
  }

  const dismiss = () => {
    hide()
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "true")
    } catch {}
    setDeferredPrompt(null)
    setStatusMessage("Preparing install options…")
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setStatusMessage("Your browser hasn't surfaced an install prompt yet. Use Add to Home Screen from your browser menu to install manually.")
      return
    }

    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice?.outcome === "accepted") {
        dismiss()
        try {
          localStorage.setItem(PERMANENT_HIDE_KEY, "true")
        } catch {}
      } else {
        setStatusMessage("Install was cancelled. You can still add this app via your browser's Add to Home Screen menu.")
      }
    } catch {
      setStatusMessage("Install prompt failed. Try using your browser's Add to Home Screen option.")
    } finally {
      setDeferredPrompt(null)
    }
  }

  return (
    <div className="sticky top-0 z-40 w-full bg-emerald-600 text-white shadow-md">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-1 h-6 w-6 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold sm:text-base">Install ComParEng Tools</p>
            <p className="text-xs text-emerald-50 sm:text-sm">Add this site to your device for faster access and an app-like experience.</p>
            {statusMessage && (
              <p className="mt-1 text-xs text-white/90 sm:text-xs">{statusMessage}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            variant="outline"
            className="bg-transparent text-white hover:bg-emerald-500/40 border-white/40"
            onClick={snooze}
          >
            Not now
          </Button>
          <Button
            className="bg-white text-emerald-600 hover:bg-emerald-100"
            onClick={handleInstall}
            disabled={!deferredPrompt}
          >
            Install app
          </Button>
          <button
            type="button"
            className="ml-1 rounded-full p-1 hover:bg-emerald-500/30"
            aria-label="Dismiss install banner"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
