"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const isInternalHref = (href: string | null) => {
  if (!href) return false
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return false
  if (href.startsWith("#")) return false
  return href.startsWith("/")
}

export default function NavigationOverlay() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  // Hide shortly after a route change to allow a quick fade-out
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), 220)
    return () => clearTimeout(timer)
  }, [pathname, visible])

  // Trigger overlay on internal link clicks
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a") as HTMLAnchorElement | null
      if (!anchor) return

      const href = anchor.getAttribute("href")
      const targetAttr = anchor.getAttribute("target")
      if (!isInternalHref(href)) return
      if (targetAttr && targetAttr === "_blank") return

      setVisible(true)
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm transition-opacity duration-200",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
      </div>
    </div>
  )
}
