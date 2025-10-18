"use client"

import React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Moon,
  Sun,
  ArrowLeft,
  Calendar,
  Download,
  Upload,
  Save,
  Eye,
  Table,
  Grid3X3,
  GraduationCap,
  RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { CircularProgress } from "@/components/ui/circular-progress"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { saveCourseStatuses, loadCourseStatuses } from "@/lib/course-storage"
import { initialCourses } from "@/lib/course-data"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"

// --- Types and Interfaces ---

// Course status types
type CourseStatus = "passed" | "active" | "pending"

// Course interface
interface Course {
  id: string
  code: string
  name: string
  credits: number
  status: CourseStatus
  prerequisites: string[] // Array of course IDs
  description: string | null // Kept in interface, but not displayed in card
  year: number
  term: string // e.g., "Fall", "Spring", "Summer"
}

// Group courses by year and term
interface CoursesByYearAndTerm {
  [year: number]: {
    [term: string]: Course[]
  }
}

// Type for the map storing dependent courses
type DependentCoursesMap = Map<string, Course[]>

// Progress stats interface
interface ProgressStats {
  total: number
  passed: number
  active: number
  pending: number
  percentage: number
}

// Academic year interface
interface AcademicYear {
  year: number
  term1: string
  term2: string
  term3: string
}

// --- Subcomponent Prop Types ---
interface FilterAndSearchControlsProps {
  searchTerm: string
  setSearchTerm: (v: string) => void
  filterStatus: CourseStatus | "all" | "future"
  setFilterStatus: (s: CourseStatus | "all" | "future") => void
  viewMode: "card" | "table"
  setViewMode: (v: "card" | "table") => void
  courses: Course[]
}

interface OverallProgressProps {
  overallProgress: ProgressStats
  showDetailedProgress: boolean
  setShowDetailedProgress: (b: boolean) => void
  progressByYear: { [key: number]: ProgressStats }
  progressByTerm: { [key: number]: { [term: string]: ProgressStats } }
  courses: Course[]
}

interface SaveLoadControlsProps {
  saveProgress: () => void
  downloadProgress: () => void
  uploadProgress: (e: React.ChangeEvent<HTMLInputElement>) => void
  saveMessage: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>
  setSaveMessage: (m: string | null) => void
}

interface AcademicTimelineProps {
  startYear: number
  handleStartYearChange: (v: string | React.ChangeEvent<HTMLInputElement>) => void
  academicYears: AcademicYear[]
}

// Quick Navigation Component
const QuickNavigation = () => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link href="/schedule-maker">
        <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Schedule Maker
        </Button>
      </Link>
      <Link href="/academic-planner">
        <Button className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Academic Planner
        </Button>
      </Link>
      <Link href="/">
        <Button variant="outline" className="w-full sm:w-auto flex items-center gap-2 bg-transparent">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </Link>
    </div>
  )
}

// --- Helper Functions ---

/**
 * Calculates a map where keys are course IDs and values are arrays
 * of courses that list the key course as a prerequisite.
 * @param courses - The list of all courses.
 * @returns A Map<string, Course[]>
 */
const calculateDependentCoursesMap = (courses: Course[]): DependentCoursesMap => {
  const dependentMap: DependentCoursesMap = new Map()
  courses.forEach((course) => {
    course.prerequisites.forEach((prereqId) => {
      if (!dependentMap.has(prereqId)) {
        dependentMap.set(prereqId, [])
      }
      // Ensure we don't add duplicates if a course somehow lists the same prereq twice
      if (!dependentMap.get(prereqId)?.find((dep) => dep.id === course.id)) {
        dependentMap.get(prereqId)?.push(course)
      }
    })
  })
  return dependentMap
}

/**
 * Groups courses by year and then by term.
 * @param courses - The list of courses to group.
 * @returns an object structured by year and term.
 */
const groupCourses = (courses: Course[]): CoursesByYearAndTerm => {
  const grouped: CoursesByYearAndTerm = {}
  courses.forEach((course) => {
    if (!grouped[course.year]) {
      grouped[course.year] = {}
    }
    if (!grouped[course.year][course.term]) {
      grouped[course.year][course.term] = []
    }
    grouped[course.year][course.term].push(course)
    // Sort courses within the term by code
    grouped[course.year][course.term].sort((a, b) => a.code.localeCompare(b.code))
  })
  // Sort terms within the year
  Object.keys(grouped).forEach((year) => {
    const yearNum = Number.parseInt(year, 10)
    const terms = Object.keys(grouped[yearNum])
    const termOrder = ["Term 1", "Term 2", "Term 3"] // Define desired order
    terms.sort((a, b) => termOrder.indexOf(a) - termOrder.indexOf(b))
    const sortedTerms: { [term: string]: Course[] } = {}
    terms.forEach((term) => {
      sortedTerms[term] = grouped[yearNum][term]
    })
    grouped[yearNum] = sortedTerms
  })

  return grouped
}

/**
 * Gets the appropriate icon based on course status.
 * Used for prerequisite badges and inside the status select trigger/items.
 * @param status - The status of the course.
 * @returns A Lucide icon component.
 */
const getStatusIcon = (status: CourseStatus) => {
  switch (status) {
    case "passed":
      return <CheckCircle className="h-3 w-3 ml-1 text-green-700 dark:text-green-400" />
    case "active":
      return <Clock className="h-3 w-3 ml-1 text-blue-700 dark:text-blue-400" />
    case "pending":
      return <AlertCircle className="h-3 w-3 ml-1 text-yellow-700 dark:text-yellow-400" />
    default:
      return null
  }
}

/**
 * Calculate progress statistics for a set of courses
 * @param courses - Array of courses to calculate stats for
 * @returns ProgressStats object with counts and percentage
 */
const calculateProgress = (courses: Course[]): ProgressStats => {
  const total = courses.length
  const passed = courses.filter((c) => c.status === "passed").length
  const active = courses.filter((c) => c.status === "active").length
  const pending = courses.filter((c) => c.status === "pending").length
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0

  return { total, passed, active, pending, percentage }
}

/**
 * Calculate academic years based on starting year
 * @param startYear - The starting year of the student
 * @returns Array of academic years
 */
const calculateAcademicYears = (startYear: number): AcademicYear[] => {
  const academicYears: AcademicYear[] = []

  for (let i = 0; i < 4; i++) {
    const year = i + 1
    const academicYearStart = startYear + i
    const academicYearEnd = startYear + i + 1
    const academicYearStr = `${academicYearStart}${academicYearEnd}`

    academicYears.push({
      year,
      term1: academicYearStr,
      term2: academicYearStr,
      term3: academicYearStr,
    })
  }

  return academicYears
}

// --- Theme Toggle Component ---
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="rounded-full"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

// Replace the Filter and Search Controls section with this improved version
const FilterAndSearchControls = ({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  viewMode,
  setViewMode,
  courses,
}: FilterAndSearchControlsProps) => {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Course[]>([])

  // Generate suggestions based on search term
  useEffect(() => {
    if (searchTerm.length >= 3) {
      const filtered = courses
        .filter(
          (course) =>
            course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.name.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .sort((a, b) => a.code.localeCompare(b.code))
        .slice(0, 5)
      setSuggestions(filtered)
    } else {
      setSuggestions([])
    }
  }, [searchTerm, courses])

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Input with Suggestions */}
        <div className="relative">
          <Label htmlFor="search-course" className="text-sm font-medium mb-1 block">
            Search Courses
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Input
                  id="search-course"
                  type="text"
                  placeholder="Search by code or name..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    if (e.target.value.length >= 3) setOpen(true)
                    else setOpen(false)
                  }}
                  className="pl-8 w-full"
                  autoComplete="off" // Prevent browser autocomplete
                />
              </PopoverTrigger>
              <PopoverContent className="p-0 w-full" align="start" sideOffset={5}>
                <Command>
                  <CommandList>
                    <CommandGroup heading="Suggestions">
                      {suggestions.map((course) => (
                        <CommandItem
                          key={course.id}
                          onSelect={() => {
                            setSearchTerm(course.code)
                            setOpen(false)
                          }}
                          className="cursor-pointer"
                        >
                          <span className="font-medium">{course.code}</span>
                          <span className="ml-2 text-sm text-muted-foreground">{course.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Status Filter and View Toggle */}
        <div>
          <Label className="text-sm font-medium mb-1 block">Filter & View Options</Label>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                onClick={() => setFilterStatus("all")}
                className="text-xs"
              >
                All
              </Button>
              <Button
                variant={filterStatus === "pending" ? "default" : "outline"}
                onClick={() => setFilterStatus("pending")}
                className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-500/20"
              >
                Pending
              </Button>
              <Button
                variant={filterStatus === "active" ? "default" : "outline"}
                onClick={() => setFilterStatus("active")}
                className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-500/20"
              >
                Active
              </Button>
              <Button
                variant={filterStatus === "passed" ? "default" : "outline"}
                onClick={() => setFilterStatus("passed")}
                className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-500/20"
              >
                Passed
              </Button>
              <Button
                variant={filterStatus === "future" ? "default" : "outline"}
                onClick={() => setFilterStatus("future")}
                className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-500/20"
              >
                Future
              </Button>
            </div>

            <div className="flex justify-end">
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="rounded-none"
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  Card
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="rounded-none"
                >
                  <Table className="h-4 w-4 mr-1" />
                  Table
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Update the OverallProgress component to show courses instead of credits
const OverallProgress = ({
  overallProgress,
  showDetailedProgress,
  setShowDetailedProgress,
  progressByYear,
  progressByTerm,
  courses,
}: OverallProgressProps) => {
  const [expandedYears, setExpandedYears] = useState<{ [key: number]: boolean }>({})

  const toggleYearExpansion = (year: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }))
  }

  // Get courses by year and term
  const getCoursesByYearAndTerm = (year: number, term?: string) => {
    return courses.filter((course) => course.year === year && (term ? course.term === term : true))
  }

  return (
    <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Overall Program Progress</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetailedProgress(!showDetailedProgress)}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          {showDetailedProgress ? "Hide" : "Show"} Detailed Progress
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:w-2/3">
          <Progress
            value={overallProgress.percentage}
            className="h-4 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-full"
            style={{
              backgroundImage: "none",
            }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${overallProgress.percentage}%`,
                background: "linear-gradient(90deg, #0a4da2 0%, #0f6fee 100%)",
              }}
            />
          </Progress>
          <p className="mt-2 text-center">{overallProgress.percentage}% Complete</p>
        </div>
        <div className="w-full md:w-1/3 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <p className="text-lg font-bold text-green-700 dark:text-green-400">{overallProgress.passed}</p>
            <p className="text-xs text-green-700 dark:text-green-400">Completed</p>
          </div>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{overallProgress.active}</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Active</p>
          </div>
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{overallProgress.pending}</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">Remaining</p>
          </div>
        </div>
      </div>

      {/* Detailed Progress View */}
      {showDetailedProgress && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium mb-4">Detailed Progress</h3>

          {/* Year Progress */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3">Progress by Year</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(progressByYear).map(([year, stats]) => {
                const yearNum = Number(year)
                const yearCourses = getCoursesByYearAndTerm(yearNum)
                const activeCourses = yearCourses.filter((c) => c.status === "active")
                const pendingCourses = yearCourses.filter((c) => c.status === "pending")

                return (
                  <div key={year} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center">
                    <CircularProgress
                      value={stats.percentage}
                      size={80}
                      strokeWidth={8}
                      color={stats.percentage === 100 ? "#10b981" : "#3b82f6"}
                      className="mb-2"
                    />
                    <p className="font-medium">Year {year}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {stats.passed}/{stats.total} courses
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => toggleYearExpansion(yearNum)} className="mt-2">
                      {expandedYears[yearNum] ? "Hide Terms" : "Show Terms"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Term Progress (Expandable) */}
          {Object.entries(progressByYear).map(([year, yearStats]) => {
            const yearNum = Number(year)
            return (
              expandedYears[yearNum] && (
                <div key={`terms-${year}`} className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-md font-medium mb-3">Progress by Term - Year {year}</h4>
                  <div className="space-y-4">
                    {Object.entries(progressByTerm[yearNum] || {}).map(([term, stats]) => {
                      const termCourses = getCoursesByYearAndTerm(yearNum, term)
                      const activeCourses = termCourses.filter((c) => c.status === "active")
                      const pendingCourses = termCourses.filter((c) => c.status === "pending")

                      return (
                        <div key={`${year}-${term}`} className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <CircularProgress
                              value={stats.percentage}
                              size={60}
                              strokeWidth={6}
                              color={stats.percentage === 100 ? "#10b981" : "#3b82f6"}
                            />
                            <div className="flex-grow">
                              <p className="font-medium">{term}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {stats.passed}/{stats.total} courses
                              </p>

                              {/* Show course status information */}
                              <div className="mt-2 text-xs">
                                {stats.percentage === 100 ? (
                                  <p className="text-green-600 dark:text-green-400">All courses completed!</p>
                                ) : (
                                  <div>
                                    {activeCourses.length > 0 && (
                                      <p className="text-blue-600 dark:text-blue-400">
                                        Active: {activeCourses.map((c) => c.code).join(", ")}
                                      </p>
                                    )}
                                    {pendingCourses.length > 0 && (
                                      <p className="text-yellow-600 dark:text-yellow-400">
                                        Pending: {pendingCourses.map((c) => c.code).join(", ")}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )
          })}
        </div>
      )}

      {/* Note about course status persistence */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300">
        <p className="flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>
            <strong>Note:</strong> Course statuses are saved to your browser's local storage. After marking courses as
            "Active", use the "Go to Schedule Maker" button to see available sections for your active courses.
          </span>
        </p>
      </div>
    </div>
  )
}

// --- Save/Load Progress Controls (Simplified) ---
const SaveLoadControls = ({
  saveProgress,
  downloadProgress,
  uploadProgress,
  saveMessage,
  fileInputRef,
  setCourses,
  setSaveMessage,
}: SaveLoadControlsProps) => {
  // Ref for curriculum HTML import
  const htmlFileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Parse a Program Curriculum HTML file (from SOLAR) and extract courses.
   * The function is intentionally permissive: it supports tables where
   * course rows are regular <tr> with multiple <td>s and also handles
   * section header rows (single-cell rows) that indicate Year/Term.
   */
  const parseCurriculumHtml = (html: string): Course[] => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

  const tbody = doc.querySelector("tbody")
    if (!tbody) return []

    const courses: Course[] = []
    let currentYear = 1
    let currentTerm: string = "Term 1"

    // Try to detect header -> column index for units/credits to reliably extract credits
    const headerCells = Array.from(doc.querySelectorAll("thead th, thead td"))
    let unitsColIndex: number | null = null
    if (headerCells.length > 0) {
      headerCells.forEach((th, idx) => {
        const txt = (th.textContent || "").trim()
        if (/unit|credit|units|credits/i.test(txt) && unitsColIndex === null) {
          unitsColIndex = idx
        }
      })
    }

    const rows = Array.from(tbody.querySelectorAll("tr"))
  rows.forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll("td"))
      const rowText = tr.textContent?.trim() || ""

      // Heuristic: a single-cell row is likely a section header (e.g. "First Year" or "Term 1")
      if (tds.length === 1) {
        // Normalize whitespace and collapse newlines so header like:
        // "FIRST YEAR ( 2ND TERM )" becomes "FIRST YEAR (2ND TERM)"
        const header = rowText.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim()

        // Detect year (FIRST, SECOND, THIRD, FOURTH)
        if (/first year|year 1|1st year/i.test(header)) currentYear = 1
        else if (/second year|year 2|2nd year/i.test(header)) currentYear = 2
        else if (/third year|year 3|3rd year/i.test(header)) currentYear = 3
        else if (/fourth year|year 4|4th year/i.test(header)) currentYear = 4

        // Prefer detecting a parenthesized term like "(2ND TERM)" first
        const parenMatch = header.match(/\(([^)]+)\)/)
        let termText = parenMatch ? parenMatch[1] : header

        // Now extract a term number from the termText
        const termOrdinalMatch = termText.match(/(1ST|2ND|3RD|4TH)\s*TERM/i)
        const termDigitMatch = termText.match(/(\d)(?:ST|ND|RD|TH)?\s*TERM/i)
        const termAfterWordMatch = termText.match(/TERM\s*[:\(\s]*\s*(\d)/i)

        if (termOrdinalMatch) {
          const digit = termOrdinalMatch[1].charAt(0)
          currentTerm = `Term ${digit}`
        } else if (termDigitMatch) {
          currentTerm = `Term ${termDigitMatch[1]}`
        } else if (termAfterWordMatch) {
          currentTerm = `Term ${termAfterWordMatch[1]}`
        } else {
          // No explicit term detected -> default to Term 1 for that year
          currentTerm = 'Term 1'
        }

        return
      }

      // If it looks like a course row (code in first cell)
      if (tds.length >= 2) {
        const code = tds[0].textContent?.trim() || ""
        const name = tds[1].textContent?.trim() || ""

        // Attempt to find credits using the detected units column first
        let credits: number | undefined = undefined

        // Helper: parse a candidate cell text for an isolated/sensible numeric units value
        const parseCandidateNumber = (txt: string | null | undefined): number | undefined => {
          if (!txt) return undefined
          const s = txt.trim()
          if (s.length === 0) return undefined

          // Accept whole-cell integers like "3" or "0" (optionally decimals like "3.0")
          const whole = s.match(/^(\d+)(?:\.\d+)?$/)
          if (whole) {
            const n = Number(whole[1])
            if (Number.isFinite(n) && n >= 0 && n <= 9) return n
          }

          // Accept isolated numeric tokens but avoid digits embedded in alphanumeric course codes (e.g. COE123)
          // Scan digit runs and ensure surrounding characters are not letters
          const digitRe = /\d+/g
          let m: RegExpExecArray | null
          while ((m = digitRe.exec(s)) !== null) {
            const match = m[0]
            const idx = m.index
            const before = idx > 0 ? s[idx - 1] : undefined
            const after = idx + match.length < s.length ? s[idx + match.length] : undefined
            const beforeIsLetter = before ? /[A-Za-z]/.test(before) : false
            const afterIsLetter = after ? /[A-Za-z]/.test(after) : false
            if (!beforeIsLetter && !afterIsLetter) {
              const n = Number(match)
              if (Number.isFinite(n) && n >= 0 && n <= 9) return n
            }
          }

          return undefined
        }

        if (unitsColIndex !== null && unitsColIndex < tds.length) {
          const unitsTxt = tds[unitsColIndex].textContent || ""
          credits = parseCandidateNumber(unitsTxt)
        }

        // If the detected units column didn't help, scan non-code cells (skip code cell at tds[0])
        if (credits === undefined) {
          for (let i = 1; i < tds.length; i++) {
            const candidate = parseCandidateNumber(tds[i].textContent)
            if (candidate !== undefined) {
              credits = candidate
              break
            }
          }
        }

        // Only add rows that look like courses (must have a code or name)
        if (code || name) {
          const id = code || name.slice(0, 8).replace(/\s+/g, "_")
          courses.push({
            id,
            code: code || id,
            name: name || "",
            credits: credits ?? 0,
            status: "pending" as CourseStatus,
            prerequisites: [],
            description: null,
            year: currentYear,
            term: currentTerm,
          })
        }
      }
    })

    return courses
  }

  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <h2 className="text-lg font-semibold">Save & Load Progress</h2>
        <Button variant="ghost" size="sm">
          {isExpanded ? "Hide" : "Show"} Options
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveProgress} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4" />
              Save Progress
            </Button>
            <Button onClick={downloadProgress} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Progress
            </Button>
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={uploadProgress}
                accept=".json"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Upload progress file"
              />
              <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Upload className="h-4 w-4" />
                Upload Progress
              </Button>
            </div>
            {/* Import Curriculum (HTML) */}
            <div className="relative">
              <input
                type="file"
                ref={htmlFileInputRef}
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    try {
                      const html = ev.target?.result as string
                      const parsed = parseCurriculumHtml(html) as Course[]
                      if (!parsed || parsed.length === 0) {
                        setSaveMessage("No courses found in the provided HTML file")
                        setTimeout(() => setSaveMessage(null), 3000)
                        return
                      }
                      setCourses(parsed)
                      saveCourseStatuses(parsed)
                      setSaveMessage("Curriculum imported successfully")
                      setTimeout(() => setSaveMessage(null), 3000)
                    } catch (err) {
                      console.error(err)
                      setSaveMessage("Failed to parse curriculum HTML file")
                      setTimeout(() => setSaveMessage(null), 3000)
                    }
                  }
                  reader.readAsText(file)

                  // reset input so same file can be re-selected
                  ;(e.target as HTMLInputElement).value = ""
                }}
                accept=".html,.htm"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Import curriculum HTML file"
              />
              <Button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Upload className="h-4 w-4" />
                Import Curriculum (HTML)
              </Button>
            </div>
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to reset all course progress? This will set all courses to 'pending'.",
                  )
                ) {
                  setCourses((prevCourses: Course[]) => {
                    const resetCourses = prevCourses.map((course: Course) => ({
                      ...course,
                      status: "pending" as CourseStatus,
                    }))
                    saveCourseStatuses(resetCourses)
                    setSaveMessage("All course progress has been reset")
                    setTimeout(() => setSaveMessage(null), 3000)
                    return resetCourses
                  })
                }
              }}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset All Progress
            </Button>
          </div>

          {saveMessage && (
            <Alert className="mt-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Status</AlertTitle>
              <AlertDescription>{saveMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

// --- Academic Timeline (Simplified) ---
const AcademicTimeline = ({ startYear, handleStartYearChange, academicYears }: AcademicTimelineProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState<string>(String(startYear))
  const expectedGraduation = startYear + 4

  // Keep local input in sync with prop changes
  useEffect(() => {
    setInputValue(String(startYear))
  }, [startYear])

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Academic Timeline
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="start-year" className="whitespace-nowrap">
              Starting Year:
            </Label>
            <Input
              id="start-year"
              type="text" /* use text + inputMode to show numeric keyboard on mobile without spinner */
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => handleStartYearChange(inputValue)}
              className="w-24"
              inputMode="numeric" /* prefer numeric keypad on mobile */
              pattern="\\d*" /* allow digits only on some mobile browsers */
              placeholder="2025"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            <p className="text-blue-700 dark:text-blue-300 font-medium">Expected Graduation: {expectedGraduation}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? "Hide" : "Show"} Details
          </Button>
        </div>
      </div>

      {/* Academic Years Table (Expandable) */}
      {isExpanded && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left">Year</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left">Term 1</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left">Term 2</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left">Term 3</th>
              </tr>
            </thead>
            <tbody>
              {academicYears.map((academicYear) => (
                <tr key={academicYear.year} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">Year {academicYear.year}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">S.Y. {academicYear.term1}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">S.Y. {academicYear.term2}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">S.Y. {academicYear.term3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Academic Planner Link */}
      <div className="mt-4">
        <Link href="/academic-planner">
          <Button variant="outline" className="flex items-center gap-2 bg-transparent">
            <Calendar className="h-4 w-4" />
            Open Academic Planner
          </Button>
        </Link>
      </div>
    </div>
  )
}

// --- Main Component ---

export default function CourseTracker() {
  const [courses, setCourses] = useState<Course[]>(initialCourses as unknown as Course[])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<CourseStatus | "all" | "future">("all")
  const [openYears, setOpenYears] = useState<{ [key: number]: boolean }>({ 1: true }) // Start with Year 1 open
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null) // Track expanded card
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "table">("card")
  const [showDetailedProgress, setShowDetailedProgress] = useState(false)
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const { theme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate academic years and expected graduation
  const academicYears = useMemo(() => calculateAcademicYears(startYear), [startYear])
  const expectedGraduation = startYear + 4

  // Load saved course statuses on component mount
  useEffect(() => {
    const savedCourses = loadCourseStatuses()
    if (savedCourses) {
      setCourses(savedCourses)
      setSaveMessage("Loaded saved course statuses from local storage")
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [])

  // Pre-calculate dependent courses using useMemo for efficiency
  const dependentCoursesMap = useMemo(() => calculateDependentCoursesMap(courses), [courses])

  // Calculate overall progress stats
  const overallProgress = useMemo(() => calculateProgress(courses), [courses])

  // Calculate progress stats by year
  const progressByYear = useMemo(() => {
    const yearStats: { [key: number]: ProgressStats } = {}
    const years = [...new Set(courses.map((c) => c.year))].sort()

    years.forEach((year) => {
      const yearCourses = courses.filter((c) => c.year === year)
      yearStats[year] = calculateProgress(yearCourses)
    })

    return yearStats
  }, [courses])

  // Calculate progress stats by term within each year
  const progressByTerm = useMemo(() => {
    const termStats: { [key: number]: { [key: string]: ProgressStats } } = {}
    const groupedCourses: CoursesByYearAndTerm = groupCourses(courses)

    Object.entries(groupedCourses).forEach(([year, terms]) => {
      const yearNum = Number.parseInt(year, 10)
      termStats[yearNum] = {}

      ;(Object.entries(terms) as [string, Course[]][]).forEach(([term, termCourses]) => {
        termStats[yearNum][term] = calculateProgress(termCourses)
      })
    })

    return termStats
  }, [courses])

  // Find a course by its ID
  const findCourseById = (id: string): Course | undefined => {
    return courses.find((course) => course.id === id)
  }

  // Check if a course can be taken next (all prerequisites are passed or active)
  const canTakeNext = (course: Course): boolean => {
    // Must be a pending course
    if (course.status !== "pending") return false

    // If no prerequisites, it can be taken
    if (course.prerequisites.length === 0) return true

    // All prerequisites must be either passed or active
    return course.prerequisites.every((prereqId) => {
      const prereqCourse = findCourseById(prereqId)
      return prereqCourse && (prereqCourse.status === "passed" || prereqCourse.status === "active")
    })
  }

  // Filter courses based on search term and status
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        searchTerm === "" ||
        course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.name.toLowerCase().includes(searchTerm.toLowerCase())

      let matchesStatus = true
      if (filterStatus === "future") {
        matchesStatus = canTakeNext(course)
      } else if (filterStatus !== "all") {
        matchesStatus = course.status === filterStatus
      }

      return matchesSearch && matchesStatus
    })
  }, [courses, searchTerm, filterStatus])

  // Group the filtered courses for display
  const groupedFilteredCourses = useMemo<CoursesByYearAndTerm>(() => groupCourses(filteredCourses), [filteredCourses])

  // Handle status change for a course
  const handleStatusChange = (courseId: string, newStatus: CourseStatus) => {
    setCourses((prevCourses) => {
      const updatedCourses = prevCourses.map((course) =>
        course.id === courseId ? { ...course, status: newStatus } : course,
      )

      // Save to localStorage whenever courses are updated
      saveCourseStatuses(updatedCourses)

      return updatedCourses
    })
  }

  // Toggle year collapsible
  const toggleYear = (year: number) => {
    setOpenYears((prev) => ({ ...prev, [year]: !prev[year] }))
  }

  const toggleCourseExpansion = (courseId: string) => {
    setExpandedCourseId((prevId) => (prevId === courseId ? null : courseId))
  }

  // Check if all courses in a year are passed
  const areAllCoursesPassed = (year: number): boolean => {
    const yearCourses = courses.filter((course) => course.year === year)
    return yearCourses.length > 0 && yearCourses.every((course) => course.status === "passed")
  }

  // Check if all courses in a term are passed
  const areAllTermCoursesPassed = (year: number, term: string): boolean => {
    const termCourses = courses.filter((course) => course.year === year && course.term === term)
    return termCourses.length > 0 && termCourses.every((course) => course.status === "passed")
  }

  // Mark all courses in a specific year as passed
  const markYearAsPassed = (year: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the collapsible
    setCourses((prevCourses) => {
      const yearCourses = prevCourses.filter((course) => course.year === year)
      const passedCourses = yearCourses.filter((course) => course.status === "passed")
      const allPassed = yearCourses.length === passedCourses.length

      const updatedCourses: Course[] = prevCourses.map((course: Course) =>
        course.year === year ? { ...course, status: (allPassed ? "pending" : "passed") as CourseStatus } : course,
      )

      // Save to localStorage
      saveCourseStatuses(updatedCourses)

      return updatedCourses
    })
  }

  // Toggle all courses in a specific term between passed and pending
  const markTermAsPassed = (year: number, term: string) => {
    setCourses((prevCourses) => {
      const termCourses = prevCourses.filter((course) => course.year === year && course.term === term)
      const passedCourses = termCourses.filter((course) => course.status === "passed")
      const allPassed = termCourses.length === passedCourses.length

      const updatedCourses: Course[] = prevCourses.map((course: Course) =>
        course.year === year && course.term === term ? { ...course, status: (allPassed ? "pending" : "passed") as CourseStatus } : course,
      )

      // Save to localStorage
      saveCourseStatuses(updatedCourses)

      return updatedCourses
    })
  }

  // Download course progress as JSON file
  const downloadProgress = () => {
    const dataStr = JSON.stringify(courses, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`

    const exportFileDefaultName = `course-progress-${new Date().toISOString().slice(0, 10)}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()

    setSaveMessage("Course progress downloaded successfully")
    setTimeout(() => setSaveMessage(null), 3000)
  }

  // Upload course progress from JSON file
  const uploadProgress = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsedCourses = JSON.parse(content) as Course[]

        // Validate the imported data
        if (
          !Array.isArray(parsedCourses) ||
          !parsedCourses.every(
            (course) =>
              course.id && course.code && course.name && ["passed", "active", "pending"].includes(course.status),
          )
        ) {
          throw new Error("Invalid course data format")
        }

        setCourses(parsedCourses)
        saveCourseStatuses(parsedCourses)
        setSaveMessage("Course progress imported successfully")
        setTimeout(() => setSaveMessage(null), 3000)
      } catch (error) {
        console.error("Error parsing course progress file:", error)
        setSaveMessage("Error importing course progress: Invalid file format")
        setTimeout(() => setSaveMessage(null), 3000)
      }
    }
    reader.readAsText(file)

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Save current progress to localStorage
  const saveProgress = () => {
    saveCourseStatuses(courses)
    setSaveMessage("Course progress saved to browser storage")
    setTimeout(() => setSaveMessage(null), 3000)
  }

  // Handle start year change
  const handleStartYearChange = (eOrValue: React.ChangeEvent<HTMLInputElement> | string) => {
    // Accept either an event or a raw string value so the child component can call with a string
    const valueStr = typeof eOrValue === "string" ? eOrValue : eOrValue.target.value
    const year = Number.parseInt(valueStr)
    if (!isNaN(year) && year >= 2000 && year <= 2100) {
      setStartYear(year)
    }
    // If the value is empty or invalid, do not update startYear to allow the user to edit freely on mobile
  }

  // --- JSX ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Disclaimer Banner */}
      <div className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 p-2 text-center text-sm">
        <strong>Disclaimer:</strong> This is a personal project and is NOT officially affiliated with FEU Tech or the
        FEU Tech CpE Department.
      </div>

      <div className="mb-6 mt-4">
        <QuickNavigation />
      </div>

      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto font-sans">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center">FEU TECH Computer Engineering Course Tracker</h1>
          <ThemeToggle />
        </div>

        {/* Save/Load Progress Controls */}
        <SaveLoadControls
          saveProgress={saveProgress}
          downloadProgress={downloadProgress}
          uploadProgress={uploadProgress}
          saveMessage={saveMessage}
          fileInputRef={fileInputRef}
          setCourses={setCourses}
          setSaveMessage={setSaveMessage}
        />

        {/* Academic Year and Expected Graduation */}
        <AcademicTimeline
          startYear={startYear}
          handleStartYearChange={handleStartYearChange}
          academicYears={academicYears}
        />

        {/* Overall Progress */}
        <OverallProgress
          overallProgress={overallProgress}
          showDetailedProgress={showDetailedProgress}
          setShowDetailedProgress={setShowDetailedProgress}
          progressByYear={progressByYear}
          progressByTerm={progressByTerm}
          courses={courses}
        />

        {/* Filter and Search Controls */}
        <FilterAndSearchControls
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          viewMode={viewMode}
          setViewMode={setViewMode}
          courses={courses}
        />

        {/* Course Display Area */}
        <Tabs defaultValue="courses" className="mb-6">
          <TabsList>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="table-view">Table View</TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            {viewMode === "card" ? (
              <div className="space-y-6">
                {Object.keys(groupedFilteredCourses).length > 0 ? (
                  Object.entries(groupedFilteredCourses)
                    .sort(([yearA], [yearB]) => Number.parseInt(yearA) - Number.parseInt(yearB)) // Sort years numerically
                    .map(([year, terms]: [string, { [term: string]: Course[] }]) => {
                      const yearNum = Number.parseInt(year, 10)
                      const yearProgress = progressByYear[yearNum]
                      const allPassed = areAllCoursesPassed(yearNum)

                      return (
                        <Collapsible
                          key={year}
                          open={openYears[yearNum]}
                          onOpenChange={() => toggleYear(yearNum)}
                          className="border dark:border-gray-700 rounded-lg overflow-hidden shadow-md bg-white dark:bg-gray-800"
                        >
                          <CollapsibleTrigger className="flex justify-between items-center w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-semibold">Year {year}</h2>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                ({yearProgress.passed}/{yearProgress.total} courses - {yearProgress.percentage}%)
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                asChild={true}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2 text-green-600 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:border-green-800 dark:hover:bg-red-900/30 dark:hover:border-red-800 dark:hover:text-red-400 transition-colors bg-transparent"
                                onClick={(e) => markYearAsPassed(yearNum, e)}
                              >
                                <span>
                                  {areAllCoursesPassed(yearNum)
                                    ? "Unmark All"
                                    : `Mark All as Passed (${courses.filter((c) => c.year === yearNum && c.status !== "passed").length})`}
                                </span>
                              </Button>
                              {openYears[yearNum] ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="p-4 space-y-4">
                            {/* Year Progress Bar */}
                            <div className="mb-4">
                              <Progress
                                value={yearProgress.percentage}
                                className="h-2 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-full"
                                style={{
                                  backgroundImage: "none",
                                }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${yearProgress.percentage}%`,
                                    background: "linear-gradient(90deg, #0a4da2 0%, #0f6fee 100%)",
                                  }}
                                />
                              </Progress>
                            </div>

                            {Object.entries(terms).map(([term, termCourses]: [string, Course[]]) => {
                              const termProgress = progressByTerm[yearNum]?.[term] || {
                                total: 0,
                                passed: 0,
                                percentage: 0,
                              }
                              const allTermPassed = areAllTermCoursesPassed(yearNum, term)
                              const academicYear = academicYears[yearNum - 1]
                              const academicYearStr = academicYear
                                ? term === "Term 1"
                                  ? academicYear.term1
                                  : term === "Term 2"
                                    ? academicYear.term2
                                    : academicYear.term3
                                : ""

                              return (
                                <div key={term} className="border dark:border-gray-700 rounded-lg p-4">
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <h3 className="text-md font-medium">{term}</h3>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        S.Y. {academicYearStr} • ({termProgress.passed}/{termProgress.total} courses -{" "}
                                        {termProgress.percentage}%)
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7 px-2 text-green-600 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:border-green-800 dark:hover:bg-red-900/30 dark:hover:border-red-800 dark:hover:text-red-400 transition-colors bg-transparent"
                                      onClick={() => markTermAsPassed(yearNum, term)}
                                    >
                                      {areAllTermCoursesPassed(yearNum, term)
                                        ? "Unmark All"
                                        : `Mark All as Passed (${courses.filter((c) => c.year === yearNum && c.term === term && c.status !== "passed").length})`}
                                    </Button>
                                  </div>

                                  {/* Term Progress Bar */}
                                  <div className="mb-4">
                                    <Progress
                                      value={termProgress.percentage}
                                      className="h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-full"
                                      style={{
                                        backgroundImage: "none",
                                      }}
                                    >
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: `${termProgress.percentage}%`,
                                          background: "linear-gradient(90deg, #0a4da2 0%, #0f6fee 100%)",
                                        }}
                                      />
                                    </Progress>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {termCourses.map((course: Course) => {
                                      // Find prerequisites and dependents for this course
                                      const prereqCourses = course.prerequisites
                                        .map((id: string) => findCourseById(id))
                                        .filter((c: Course | undefined): c is Course => c !== undefined) // Type guard

                                      const dependentCourses = dependentCoursesMap.get(course.id) || []
                                      const MAX_DEPENDENTS_SHOWN = 2 // Max dependent codes to show initially

                                      const isExpanded = expandedCourseId === course.id

                                      return (
                                        <Card
                                          key={course.id}
                                          className={cn(
                                            "flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border dark:border-gray-700",
                                            // Vertical expansion instead of horizontal
                                            course.status === "passed" && "border-l-4 border-l-green-500",
                                            course.status === "active" && "border-l-4 border-l-blue-500",
                                            course.status === "pending" && "border-l-4 border-l-yellow-500",
                                          )}
                                          style={{
                                            transition: "all 0.3s ease", // Add smooth transition
                                          }}
                                        >
                                          {/* === Card Header: Title (Left) and Credits (Right) === */}
                                          <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start gap-2">
                                              <CardTitle className="text-base font-semibold">
                                                {course.code} - {course.name}
                                              </CardTitle>
                                              {/* Credits moved here */}
                                              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap flex-shrink-0 pt-1">
                                                {course.credits} Credit{course.credits !== 1 ? "s" : ""}
                                              </span>
                                            </div>
                                          </CardHeader>

                                          {/* === Card Content: Prerequisites and Dependents === */}
                                          <CardContent
                                            className={cn(
                                              "text-sm space-y-3 pb-3 flex-grow overflow-hidden",
                                              isExpanded && "overflow-visible",
                                            )}
                                          >
                                            {/* Prerequisites Section */}
                                            {prereqCourses.length > 0 && (
                                              <div>
                                                <span className="text-xs font-medium">Prerequisites: </span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {prereqCourses.map((prereq) => (
                                                    <Badge
                                                      key={prereq.id}
                                                      variant="outline"
                                                      className={cn(
                                                        "text-xs px-1.5 py-0.5",
                                                        prereq.status === "passed" &&
                                                          "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400",
                                                        prereq.status === "active" &&
                                                          "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400",
                                                        prereq.status === "pending" &&
                                                          "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-400",
                                                      )}
                                                    >
                                                      {prereq.code}
                                                      {getStatusIcon(prereq.status)}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {/* Dependent Courses (Required For) Section */}
                                            {dependentCourses.length > 0 && (
                                              <div className="relative overflow-hidden">
                                                <span className="text-xs font-medium">Required for: </span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  <AnimatePresence>
                                                    {dependentCourses
                                                      .slice(
                                                        0,
                                                        isExpanded ? dependentCourses.length : MAX_DEPENDENTS_SHOWN,
                                                      )
                                                      .map((dep, index) => (
                                                        <motion.div
                                                          key={dep.id}
                                                          initial={{ opacity: 0, y: -10 }}
                                                          animate={{ opacity: 1, y: 0 }}
                                                          exit={{ opacity: 0, y: 10 }}
                                                          transition={{ duration: 0.2, delay: index * 0.05 }}
                                                        >
                                                          <Badge
                                                            variant="secondary"
                                                            className="text-xs px-1.5 py-0.5 whitespace-nowrap"
                                                          >
                                                            {dep.code}
                                                            {index <
                                                              (isExpanded
                                                                ? dependentCourses.length
                                                                : MAX_DEPENDENTS_SHOWN) -
                                                                1 && index < dependentCourses.length - 1
                                                              ? ","
                                                              : ""}
                                                          </Badge>
                                                        </motion.div>
                                                      ))}
                                                  </AnimatePresence>
                                                </div>
                                                {!isExpanded && dependentCourses.length > MAX_DEPENDENTS_SHOWN && (
                                                  <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="text-xs p-0 mt-1"
                                                    onClick={() => toggleCourseExpansion(course.id)}
                                                  >
                                                    ...see all {dependentCourses.length}
                                                  </Button>
                                                )}
                                                {isExpanded && (
                                                  <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="text-xs p-0 mt-1"
                                                    onClick={() => toggleCourseExpansion(course.id)}
                                                  >
                                                    Show less
                                                  </Button>
                                                )}
                                              </div>
                                            )}

                                            {/* Add a spacer if no content to push footer down */}
                                            {prereqCourses.length === 0 && dependentCourses.length === 0 && (
                                              <div className="flex-grow"></div>
                                            )}
                                          </CardContent>

                                          {/* === Card Footer: Year/Term (Left) and Status Buttons (Right) === */}
                                          <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t dark:border-gray-700 mt-auto">
                                            <span>
                                              Year {course.year} - {course.term}
                                            </span>

                                            {/* --- Status Buttons --- */}
                                            <div className="flex gap-1">
                                              <Button
                                                size="sm"
                                                variant={course.status === "pending" ? "default" : "outline"}
                                                onClick={() => handleStatusChange(course.id, "pending")}
                                                className={cn(
                                                  "px-2 py-1 text-xs",
                                                  course.status === "pending"
                                                    ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                                    : "text-yellow-600 hover:text-yellow-700 border-yellow-200 hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-900/30",
                                                )}
                                              >
                                                Pending
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant={course.status === "active" ? "default" : "outline"}
                                                onClick={() => handleStatusChange(course.id, "active")}
                                                className={cn(
                                                  "px-2 py-1 text-xs",
                                                  course.status === "active"
                                                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                                                    : "text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30",
                                                )}
                                              >
                                                Active
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant={course.status === "passed" ? "default" : "outline"}
                                                onClick={() => handleStatusChange(course.id, "passed")}
                                                className={cn(
                                                  "px-2 py-1 text-xs",
                                                  course.status === "passed"
                                                    ? "bg-green-500 hover:bg-green-600 text-white"
                                                    : "text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30",
                                                )}
                                              >
                                                Passed
                                              </Button>
                                            </div>
                                          </CardFooter>
                                        </Card>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    })
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 mt-10 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    No courses match the current filters.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          Code
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          Course Title
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          Units
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          Prerequisites
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCourses.length > 0 ? (
                        filteredCourses.map((course) => {
                          const prereqCourses = course.prerequisites
                            .map((id) => findCourseById(id))
                            .filter((c): c is Course => c !== undefined)

                          return (
                            <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{course.code}</td>
                              <td className="px-6 py-4 text-sm">{course.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{course.credits}</td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex flex-wrap gap-1">
                                  {prereqCourses.length > 0 ? (
                                    prereqCourses.map((prereq) => (
                                      <Badge
                                        key={prereq.id}
                                        variant="outline"
                                        className={cn(
                                          "text-xs px-1.5 py-0.5",
                                          prereq.status === "passed" &&
                                            "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400",
                                          prereq.status === "active" &&
                                            "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400",
                                          prereq.status === "pending" &&
                                            "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-400",
                                        )}
                                      >
                                        {prereq.code}
                                        {getStatusIcon(prereq.status)}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">None</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant={course.status === "pending" ? "default" : "outline"}
                                    onClick={() => handleStatusChange(course.id, "pending")}
                                    className={cn(
                                      "px-2 py-1 text-xs",
                                      course.status === "pending"
                                        ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                        : "text-yellow-600 hover:text-yellow-700 border-yellow-200 hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-900/30",
                                    )}
                                  >
                                    Pending
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={course.status === "active" ? "default" : "outline"}
                                    onClick={() => handleStatusChange(course.id, "active")}
                                    className={cn(
                                      "px-2 py-1 text-xs",
                                      course.status === "active"
                                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                                        : "text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30",
                                    )}
                                  >
                                    Active
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={course.status === "passed" ? "default" : "outline"}
                                    onClick={() => handleStatusChange(course.id, "passed")}
                                    className={cn(
                                      "px-2 py-1 text-xs",
                                      course.status === "passed"
                                        ? "bg-green-500 hover:bg-green-600 text-white"
                                        : "text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30",
                                    )}
                                  >
                                    Passed
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                            No courses match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="table-view">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Course
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Course
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Course Title
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Units
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Laboratory
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Units
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Prerequisite
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(groupCourses(courses))
                      .sort(([yearA], [yearB]) => Number.parseInt(yearA) - Number.parseInt(yearB))
                      .map(([year, terms]: [string, { [term: string]: Course[] }]) => {
                        const yearNum = Number.parseInt(year, 10)
                        const academicYear = academicYears[yearNum - 1]

                        return Object.entries(terms).map(([term, termCourses]) => {
                          const termStr = term === "Term 1" ? "Term : 1" : term === "Term 2" ? "Term : 2" : "Term : 3"
                          const academicYearStr = academicYear
                            ? term === "Term 1"
                              ? academicYear.term1
                              : term === "Term 2"
                                ? academicYear.term2
                                : academicYear.term3
                            : ""

                          return (
                            <React.Fragment key={`${year}-${term}`}>
                              <tr className="bg-gray-100 dark:bg-gray-700">
                                <td colSpan={7} className="px-6 py-2 text-sm font-medium">
                                  {yearNum === 1 && term === "Term 1" && (
                                    <div className="font-bold mb-1">First Year</div>
                                  )}
                                  {yearNum === 2 && term === "Term 1" && (
                                    <div className="font-bold mb-1">Second Year</div>
                                  )}
                                  {yearNum === 3 && term === "Term 1" && (
                                    <div className="font-bold mb-1">Third Year</div>
                                  )}
                                  {yearNum === 4 && term === "Term 1" && (
                                    <div className="font-bold mb-1">Fourth Year</div>
                                  )}
                                  {termStr} S.Y : {academicYearStr}
                                </td>
                              </tr>
                              {termCourses.map((course: Course) => {
                                const prereqCourses = course.prerequisites
                                  .map((id: string) => findCourseById(id))
                                  .filter((c: Course | undefined): c is Course => c !== undefined)

                                // Check if this is a lab course
                                const isLabCourse = course.code.endsWith("L")
                                const mainCourseCode = isLabCourse ? course.code.slice(0, -1) : null
                                const mainCourse = mainCourseCode
                                  ? courses.find((c) => c.code === mainCourseCode)
                                  : null

                                return (
                                  <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">{course.code}</td>
                                    <td className="px-6 py-3 text-sm">{course.name}</td>
                                    <td className="px-6 py-3 text-center text-sm">
                                      {!isLabCourse ? course.credits : ""}
                                    </td>
                                    <td className="px-6 py-3 text-center text-sm">{isLabCourse ? course.code : ""}</td>
                                    <td className="px-6 py-3 text-center text-sm">
                                      {isLabCourse ? course.credits : ""}
                                    </td>
                                    <td className="px-6 py-3 text-sm">
                                      <div className="flex flex-wrap gap-1">
                                        {prereqCourses.length > 0 ? (
                                          prereqCourses.map((prereq) => (
                                            <Badge
                                              key={prereq.id}
                                              variant="outline"
                                              className={cn(
                                                "text-xs px-1.5 py-0.5",
                                                prereq.status === "passed" &&
                                                  "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400",
                                                prereq.status === "active" &&
                                                  "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400",
                                                prereq.status === "pending" &&
                                                  "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-400",
                                              )}
                                            >
                                              {prereq.code}
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-gray-400 dark:text-gray-500">None</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                      <select
                                        value={course.status}
                                        onChange={(e) => handleStatusChange(course.id, e.target.value as CourseStatus)}
                                        className={cn(
                                          "text-sm rounded-md border px-2 py-1",
                                          course.status === "passed" &&
                                            "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
                                          course.status === "active" &&
                                            "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
                                          course.status === "pending" &&
                                            "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700",
                                        )}
                                      >
                                        <option value="pending">PENDING</option>
                                        <option value="active">ACTIVE</option>
                                        <option value="passed">PASSED</option>
                                      </select>
                                    </td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          )
                        })
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Navigation Buttons (Bottom) */}
        <div className="mt-10 mb-6">
          <QuickNavigation />
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t dark:border-gray-700 text-center text-sm text-gray-600 dark:text-gray-400">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>Created by France Estrella</p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/feutechCpEO"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                CpEO Page
              </a>
            </div>
            <p>© All Rights Reserved 2025</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
