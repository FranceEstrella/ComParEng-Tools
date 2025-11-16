"use client"

import { useEffect } from "react"

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        if (registration.update) {
          registration.update().catch(() => {})
        }
      } catch (error) {
        if (typeof window !== "undefined" && window.location.hostname === "localhost") {
          console.warn("Service worker registration failed", error)
        }
      }
    }

    register()
  }, [])

  return null
}
