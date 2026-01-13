"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowUp, BookOpen, Calendar, GraduationCap, Home, ArrowLeft, Save } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/course-tracker", label: "Tracker", icon: BookOpen },
  { href: "/schedule-maker", label: "Schedule", icon: Calendar },
  { href: "/academic-planner", label: "Planner", icon: GraduationCap },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 320)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const syncProfileOpen = () => {
      if (typeof document === "undefined") return
      setProfileOpen(document.body.dataset.profileOpen === "true")
      setProfileEditing(document.body.dataset.profileEditing === "true")
    }
    syncProfileOpen()
    const handleProfileState = (event: any) => {
      setProfileOpen(Boolean(event?.detail?.open))
      if (typeof event?.detail?.editing === "boolean") {
        setProfileEditing(event.detail.editing)
      }
    }
    window.addEventListener("compareng:profile-open-state", handleProfileState)
    window.addEventListener("resize", syncProfileOpen)
    return () => {
      window.removeEventListener("compareng:profile-open-state", handleProfileState)
      window.removeEventListener("resize", syncProfileOpen)
    }
  }, [])

  const activeMap = useMemo(() => {
    const normalized = pathname?.split("?")[0] ?? "/"
    const match = NAV_ITEMS.find((item) => item.href === normalized)
    return match ? match.href : null
  }, [pathname])

  const scrollToTop = () => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const closeProfile = () => {
    window.dispatchEvent(new Event("compareng:close-profile"))
  }

  const saveProfile = () => {
    if (typeof window !== "undefined" && (window as any).comparengSaveProfile) {
      ;(window as any).comparengSaveProfile()
    }
    closeProfile()
  }

  const columnsClass = showScrollTop ? "grid-cols-5" : "grid-cols-4"

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[13060] border-t border-slate-200 bg-white/90 backdrop-blur-lg shadow-[0_-8px_18px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
      <div className="mx-auto max-w-5xl px-3">
        <div className={`grid ${columnsClass} gap-1 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.4rem)]`}>
          {profileOpen ? (
            <>
              <span aria-hidden className="h-0" />
              <button
                type="button"
                onClick={profileEditing ? saveProfile : closeProfile}
                className="col-span-2 flex flex-col items-center gap-1 justify-self-center rounded-xl px-3 py-2 text-[11px] font-semibold leading-tight text-white transition-colors bg-blue-600 hover:bg-blue-700 shadow-[0_6px_18px_rgba(37,99,235,0.45)] ring-1 ring-blue-300/60 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                {profileEditing ? <Save className="h-5 w-5" strokeWidth={2.2} /> : <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />}
                <span className="truncate">{profileEditing ? "Save" : "Back"}</span>
              </button>
              {showScrollTop && (
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold leading-tight text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-100 dark:hover:bg-slate-800/80"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
                  <span className="truncate">Top</span>
                </button>
              )}
            </>
          ) : (
            <>
              {NAV_ITEMS.map((item) => {
                const isActive = activeMap === item.href
                const ItemIcon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold leading-tight text-slate-600 transition-colors hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80",
                      isActive && "bg-blue-50/90 text-blue-700 shadow-[0_6px_18px_rgba(59,130,246,0.18)] ring-1 ring-blue-200/70 dark:bg-blue-900/50 dark:text-blue-200 dark:ring-blue-700/60",
                    )}
                  >
                    <ItemIcon className="h-5 w-5" strokeWidth={2.2} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}

              {showScrollTop && (
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold leading-tight text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-100 dark:hover:bg-slate-800/80"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
                  <span className="truncate">Top</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
