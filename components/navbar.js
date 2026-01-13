"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X, Sun, Moon, ArrowUp, ArrowLeft, Save } from "lucide-react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"

// Lazy-load to avoid server render issues with dialog on some routes
const PatchNotesButton = dynamic(() => import("./patch-notes"), { ssr: false })
import { useTheme } from "next-themes"
import { trackAnalyticsEvent } from "@/lib/analytics-client"

const navVariants = {
  rest: { y: 0, opacity: 1, scale: 1, boxShadow: "0 6px 16px rgba(0,0,0,0.08)" },
  pulse: { y: 0, opacity: 1, scale: 1.01, boxShadow: "0 10px 26px rgba(0,0,0,0.14)" },
}

export default function Navbar() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [navPulse, setNavPulse] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showTopButton, setShowTopButton] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const { theme, setTheme } = useTheme()
  const isHomePage = pathname === "/"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const syncProfile = () => {
      if (typeof document === "undefined") return
      setProfileOpen(document.body.dataset.profileOpen === "true")
      setProfileEditing(document.body.dataset.profileEditing === "true")
    }
    syncProfile()
    const handleProfileState = (event) => {
      setProfileOpen(Boolean(event?.detail?.open))
      if (typeof event?.detail?.editing === "boolean") setProfileEditing(event.detail.editing)
    }
    window.addEventListener("compareng:profile-open-state", handleProfileState)
    window.addEventListener("resize", syncProfile)
    return () => {
      window.removeEventListener("compareng:profile-open-state", handleProfileState)
      window.removeEventListener("resize", syncProfile)
    }
  }, [])

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(typeof window !== "undefined" ? window.innerWidth < 768 : false)
    updateIsMobile()
    window.addEventListener("resize", updateIsMobile)
    return () => window.removeEventListener("resize", updateIsMobile)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === "undefined") return
      setShowTopButton(window.scrollY > 140)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setNavPulse(true)
    const timer = setTimeout(() => setNavPulse(false), 320)
    return () => clearTimeout(timer)
  }, [isMobile, pathname])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeProfile = () => {
    window.dispatchEvent(new Event("compareng:close-profile"))
  }

  const saveProfile = () => {
    if (typeof window !== "undefined" && window.comparengSaveProfile) {
      window.comparengSaveProfile()
    }
    closeProfile()
  }

  const scrollToTop = () => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!mounted) return null

  const navItems = profileOpen
    ? [
        { href: "/course-tracker", label: "Course Tracker" },
        { href: "/schedule-maker", label: "Schedule Maker" },
        { href: "/academic-planner", label: "Academic Planner" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/course-tracker", label: "Course Tracker" },
        { href: "/schedule-maker", label: "Schedule Maker" },
        { href: "/academic-planner", label: "Academic Planner" },
      ]

  return (
    <motion.nav
      className="relative z-50 bg-blue-600 text-white shadow-md"
      variants={navVariants}
      initial="rest"
      animate={isMobile && navPulse ? "pulse" : "rest"}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-xl font-bold">
              FEU Tech ComParEng Tools
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            {isHomePage && (
              <button
                onClick={() => {
                  const nextTheme = theme === "dark" ? "light" : "dark"
                  trackAnalyticsEvent("theme.toggle", { to: nextTheme, source: "navbar" })
                  setTheme(nextTheme)
                }}
                className="p-2 rounded-full hover:bg-blue-700"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            )}
            <button
              onClick={toggleMenu}
              className="text-white focus:outline-none"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <AnimatePresence mode="wait">
              {showTopButton && (
                <motion.button
                  key="nav-mobile-top"
                  onClick={scrollToTop}
                  aria-label="Back to top"
                  className="rounded-full bg-white/15 p-2 text-white shadow-md ring-1 ring-white/30"
                  initial={{ opacity: 0, y: 26, scale: 0.85, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, y: 26, scale: 0.85, rotate: -4 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20 }}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.08 }}
                  layout
                >
                  <ArrowUp className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {profileOpen && (
              <button
                type="button"
                onClick={profileEditing ? saveProfile : closeProfile}
                className="relative inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-white hover:text-blue-200"
              >
                {profileEditing ? <Save className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                <span>{profileEditing ? "Save" : "Back"}</span>
              </button>
            )}
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative inline-flex items-center px-2 py-1 text-white hover:text-blue-200"
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-highlight"
                      className="absolute inset-0 rounded-md bg-white/15"
                      transition={{ type: "spring", stiffness: 480, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 font-semibold">{item.label}</span>
                </Link>
              )
            })}
            <PatchNotesButton />
            {isHomePage && (
              <button
                onClick={() => {
                  const nextTheme = theme === "dark" ? "light" : "dark"
                  trackAnalyticsEvent("theme.toggle", { to: nextTheme, source: "navbar" })
                  setTheme(nextTheme)
                }}
                className="p-2 rounded-full hover:bg-blue-700"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-blue-500">
            <div className="flex flex-col space-y-3">
              {profileOpen && (
                <button
                  type="button"
                  onClick={() => {
                    closeProfile()
                    setIsMenuOpen(false)
                  }}
                  className="relative inline-flex items-center gap-2 rounded-md px-2 py-1 text-white hover:text-blue-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="relative z-10 font-semibold">Back</span>
                </button>
              )}
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="relative inline-flex items-center px-2 py-1 text-white hover:text-blue-200"
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active-highlight"
                        className="absolute inset-0 rounded-md bg-white/12"
                        transition={{ type: "spring", stiffness: 480, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 font-semibold">{item.label}</span>
                  </Link>
                )}
              )}
              <div>
                <PatchNotesButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.nav>
  )
}
