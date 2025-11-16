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
        if (process.env.NODE_ENV !== "production") {
          console.warn("Service worker registration failed", error)
        }
      }
    }

    register()
  }, [])

  return null
}
