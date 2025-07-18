"use client"

import Link from "next/link"
import { useRouter } from "next/router"
import { useState } from "react"
import { Menu, X, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"

export default function Navbar() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const isHomePage = router.pathname === "/"

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <nav className="bg-blue-600 text-white shadow-md">
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
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link href="/" className={`hover:text-blue-200 ${router.pathname === "/" ? "font-bold" : ""}`}>
              Home
            </Link>
            <Link
              href="/course-tracker"
              className={`hover:text-blue-200 ${router.pathname === "/course-tracker" ? "font-bold" : ""}`}
            >
              Course Tracker
            </Link>
            <Link
              href="/schedule-maker"
              className={`hover:text-blue-200 ${router.pathname === "/schedule-maker" ? "font-bold" : ""}`}
            >
              Schedule Maker
            </Link>
            <Link
              href="/academic-planner"
              className={`hover:text-blue-200 ${router.pathname === "/academic-planner" ? "font-bold" : ""}`}
            >
              Academic Planner
            </Link>
            {isHomePage && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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
              <Link
                href="/"
                className={`hover:text-blue-200 ${router.pathname === "/" ? "font-bold" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/course-tracker"
                className={`hover:text-blue-200 ${router.pathname === "/course-tracker" ? "font-bold" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Course Tracker
              </Link>
              <Link
                href="/schedule-maker"
                className={`hover:text-blue-200 ${router.pathname === "/schedule-maker" ? "font-bold" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Schedule Maker
              </Link>
              <Link
                href="/academic-planner"
                className={`hover:text-blue-200 ${router.pathname === "/academic-planner" ? "font-bold" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Academic Planner
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
