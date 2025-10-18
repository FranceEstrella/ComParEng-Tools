"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  BookOpen,
  FileWarning,
  Info,
  GraduationCap,
  Calendar,
  ExternalLink,
  RefreshCw,
  X,
  ArrowRight,
  Move,
  Download,
  History,
  AlertTriangle,
  ArrowUpDown,
  Undo,
  Upload,
  Plus,
} from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { initialCourses } from "@/lib/course-data"
import { loadCourseStatuses } from "@/lib/course-storage"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

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
  description: string | null
  year: number
  term: string
}

// Available course section interface
interface CourseSection {
  courseCode: string
  section: string
  classSize: string
  remainingSlots: string
  meetingDays: string
  meetingTime: string
  room: string
  hasSlots: boolean
}

// Semester plan interface
interface SemesterPlan {
  year: number
  term: string
  courses: PlanCourse[]
}

// Course in plan with section info
interface PlanCourse extends Course {
  availableSections: CourseSection[]
  needsPetition: boolean
  recommendedSection?: CourseSection
}

// Move history interface
interface MoveHistoryEntry {
  id: string
  timestamp: Date
  type: "single" | "bulk" | "swap"
  description: string
  changes: {
    courseId: string
    fromYear: number
    fromTerm: string
    toYear: number
    toTerm: string
  }[]
}

// Conflict detection interface
interface ConflictInfo {
  type: "prerequisite" | "credit_limit" | "schedule" | "internship"
  severity: "error" | "warning"
  message: string
  affectedCourses: string[]
}

// Import data interface
interface ImportedPlanData {
  year: number
  term: string
  courses: {
    code: string
    name: string
    credits: number
    section?: string
    schedule?: string
    room?: string
  }[]
}

// Quick Navigation Component
const QuickNavigation = () => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link href="/course-tracker">
        <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Course Tracker
        </Button>
      </Link>
      <Link href="/schedule-maker">
        <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Schedule Maker
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

export default function AcademicPlanner() {
  const [courses, setCourses] = useState<Course[]>(initialCourses as unknown as Course[])
  const [availableSections, setAvailableSections] = useState<CourseSection[]>([])
  const [graduationPlan, setGraduationPlan] = useState<SemesterPlan[]>([])
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [currentTerm, setCurrentTerm] = useState<string>("Term 1")
  const [loading, setLoading] = useState(true)
  const [openSemesters, setOpenSemesters] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<string | null>(null)
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false)
  const [bulkMoveTargetTerm, setBulkMoveTargetTerm] = useState<string>("")
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapCourse1, setSwapCourse1] = useState<string>("")
  const [swapCourse2, setSwapCourse2] = useState<string>("")
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([])
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [overloadDialogOpen, setOverloadDialogOpen] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<{ courseId: string; targetYear: number; targetTerm: string } | null>(
    null,
  )
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [unscheduledCoursesRef, setUnscheduledCoursesRef] = useState<HTMLDivElement | null>(null)
  const [showFloatingUnscheduled, setShowFloatingUnscheduled] = useState(false)

  // Load saved course statuses and available sections on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Load course statuses
      const savedCourses = loadCourseStatuses()
      if (savedCourses) {
        setCourses(savedCourses)

        // Get starting year from localStorage if available
        const startYearFromStorage = localStorage.getItem("startYear")
        if (startYearFromStorage) {
          const parsedYear = Number.parseInt(startYearFromStorage)
          if (!isNaN(parsedYear)) {
            setStartYear(parsedYear)
          }
        }
      }

      // Load available sections
      try {
        // First check if the API endpoint exists
        const response = await fetch("/api/get-available-courses", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        })

        // Log response details for debugging
        console.log("API Response status:", response.status)
        console.log("API Response headers:", Object.fromEntries(response.headers.entries()))

        // Check if response is OK
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`)
        }

        // Try to parse as JSON, but handle non-JSON responses
        let result
        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          result = await response.json()

          if (result.success) {
            setAvailableSections(result.data)
          } else {
            throw new Error(result.error || "Failed to fetch available courses")
          }
        } else {
          // If not JSON, log the text response for debugging
          const textResponse = await response.text()
          console.error("Non-JSON response:", textResponse)
          throw new Error("API did not return JSON")
        }
      } catch (err: any) {
        console.error("Error fetching available sections:", err)
        // Set a more informative error message
        setError(
          "Could not load available course sections. Using empty data for recommendations. Error: " + err.message,
        )
        // Use empty array as fallback
        setAvailableSections([])
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Generate graduation plan when courses or available sections change
  useEffect(() => {
    if (!loading) {
      generateGraduationPlan()
    }
  }, [courses, availableSections, loading, currentYear, currentTerm])

  // Detect conflicts whenever graduation plan changes
  useEffect(() => {
    detectConflicts()
  }, [graduationPlan])

  // Track visibility of unscheduled courses section
  useEffect(() => {
    if (!unscheduledCoursesRef) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingUnscheduled(!entry.isIntersecting && getUnscheduledCourses().length > 0)
      },
      { threshold: 0.1 },
    )

    observer.observe(unscheduledCoursesRef)

    return () => observer.disconnect()
  }, [unscheduledCoursesRef, graduationPlan])

  // Check if a course is an internship course
  const isInternshipCourse = (course: Course): boolean => {
    // Consider a course an internship if its name or description contains the word "internship" (case-insensitive)
    const nameContains: boolean = course.name.toLowerCase().includes("internship")
    const descContains: boolean = course.description ? course.description.toLowerCase().includes("internship") : false

    // Prefer CPE internships when explicitly labeled (not required)
    const cpeMention: boolean = course.name.toUpperCase().includes("CPE") || (course.description || "").toUpperCase().includes("CPE")

    // Accept any internship mention in name or description
    return nameContains || descContains
  }

  // Get internship course priority (1 for Internship 1, 2 for Internship 2)
  const getInternshipPriority = (course: Course): number => {
    if (!isInternshipCourse(course)) return 0
    if (course.name.toUpperCase().includes("INTERNSHIP 1")) return 1
    if (course.name.toUpperCase().includes("INTERNSHIP 2")) return 2
    return 3 // Other internship courses come last
  }

  // Find a course by its ID
  const findCourseById = (id: string): Course | undefined => {
    return courses.find((course) => course.id === id)
  }

  // Find a course by its code
  const findCourseByCode = (code: string): Course | undefined => {
    return courses.find((course) => course.code === code)
  }

  // Check if all prerequisites for a course are passed
  const arePrerequisitesMet = (course: Course): boolean => {
    if (course.prerequisites.length === 0) return true

    return course.prerequisites.every((prereqId) => {
      const prereqCourse = findCourseById(prereqId)
      return prereqCourse && prereqCourse.status === "passed"
    })
  }

  // Check if a course can be taken in the current or future terms
  const canTakeCourse = (course: Course): boolean => {
    // Must be a pending course
    if (course.status !== "pending") return false

    // All prerequisites must be passed
    return arePrerequisitesMet(course)
  }

  // Check if a course has available sections
  const hasAvailableSections = (courseCode: string): boolean => {
    // If no available sections data, assume it needs petition
    if (availableSections.length === 0) return false

    // Check if the course exists in available sections
    return availableSections.some((section) => section.courseCode === courseCode && section.hasSlots)
  }

  // Find the best section for a course (most available slots)
  const findBestSection = (courseCode: string): CourseSection | undefined => {
    const sections = getAvailableSections(courseCode)
    if (sections.length === 0) return undefined

    return sections.reduce((best, current) => {
      const bestSlots = Number.parseInt(best.remainingSlots)
      const currentSlots = Number.parseInt(current.remainingSlots)
      return currentSlots > bestSlots ? current : best
    })
  }

  // Create a mock section when no real sections are available
  const createMockSection = (courseCode: string): CourseSection => {
    return {
      courseCode,
      section: "TBD",
      classSize: "0",
      remainingSlots: "0",
      meetingDays: "",
      meetingTime: "TBD",
      room: "TBD",
      hasSlots: false,
    }
  }

  // Get available sections for a course
  const getAvailableSections = (courseCode: string): CourseSection[] => {
    const sections = availableSections.filter((section) => section.courseCode === courseCode && section.hasSlots)
    return sections.length > 0 ? sections : []
  }

  // Convert day abbreviation to full day name
  const getFullDayName = (day: string): string => {
    switch (day) {
      case "M":
        return "Monday"
      case "T":
        return "Tuesday"
      case "W":
        return "Wednesday"
      case "Th":
        return "Thursday"
      case "F":
        return "Friday"
      case "S":
        return "Saturday"
      default:
        return day
    }
  }

  // Parse days string (e.g., "MW" or "TTh") into array of days
  const parseDays = (daysString: string): string[] => {
    if (!daysString) return []

    const days: string[] = []
    let i = 0

    while (i < daysString.length) {
      if (i < daysString.length - 1 && daysString.substring(i, i + 2) === "Th") {
        days.push("Th")
        i += 2
      } else {
        days.push(daysString[i])
        i += 1
      }
    }

    return days
  }

  // Helper to get the next term
  const getNextTerm = (year: number, term: string): { year: number; term: string } => {
    if (term === "Term 1") return { year, term: "Term 2" }
    if (term === "Term 2") return { year, term: "Term 3" }
    return { year: year + 1, term: "Term 1" }
  }

  // Format a year into academic year string: accepts either a calendar year (e.g. 2025)
  // or a curriculum-relative year (1..n). If the value looks like a small curriculum year
  // we convert it to a calendar year using `startYear`.
  const formatAcademicYear = (yearOrCurr: number): string => {
    if (!yearOrCurr && yearOrCurr !== 0) return String(yearOrCurr)
    if (isNaN(yearOrCurr)) return String(yearOrCurr)

    // If the value is a plausible calendar year (>= 1900), use it directly
    if (yearOrCurr >= 1900) {
      return `S.Y ${yearOrCurr}-${yearOrCurr + 1}`
    }

    // Otherwise treat it as a curriculum year (1-based) and convert relative to startYear
    const curriculumYear = Math.max(1, Math.floor(yearOrCurr))
    const start = startYear + (curriculumYear - 1)
    return `S.Y ${start}-${start + 1}`
  }

  // Helper to get the previous term
  const getPreviousTerm = (year: number, term: string): { year: number; term: string } => {
    if (term === "Term 3") return { year, term: "Term 2" }
    if (term === "Term 2") return { year, term: "Term 1" }
    return { year: year - 1, term: "Term 3" }
  }

  // Helper to check if one term is at least one term after another
  const isAtLeastOneTermAfter = (
    laterYear: number,
    laterTerm: string,
    earlierYear: number,
    earlierTerm: string,
  ): boolean => {
    if (laterYear > earlierYear) return true
    if (laterYear === earlierYear) {
      const termOrder = ["Term 1", "Term 2", "Term 3"]
      return termOrder.indexOf(laterTerm) > termOrder.indexOf(earlierTerm)
    }
    return false
  }

  // Helper to check if a course can be scheduled in a given term (considering prerequisites)
  const canScheduleInTerm = (course: PlanCourse, targetYear: number, targetTerm: string): boolean => {
    // Check if all prerequisites have been scheduled at least one term before OR are already passed
    return course.prerequisites.every((prereqId) => {
      // First check if prerequisite is already passed
      const prereqCourse = findCourseById(prereqId)
      if (prereqCourse && prereqCourse.status === "passed") {
        return true
      }

      // Then check if prerequisite is scheduled in the current plan
      for (const semester of graduationPlan) {
        const prereqCourse = semester.courses.find((c) => c.id === prereqId)
        if (prereqCourse) {
          return isAtLeastOneTermAfter(targetYear, targetTerm, semester.year, semester.term)
        }
      }

      // If prerequisite is not found in plan and not passed, it can't be scheduled
      return false
    })
  }

  // Detect conflicts in the graduation plan
  const detectConflicts = () => {
    const newConflicts: ConflictInfo[] = []

    graduationPlan.forEach((semester) => {
      // Check credit limits
      const totalCredits = semester.courses.reduce((sum, course) => sum + course.credits, 0)
      if (totalCredits > 21) {
        newConflicts.push({
          type: "credit_limit",
          severity: "warning",
          message: `${formatAcademicYear(semester.year)} ${semester.term} has ${totalCredits} credits (exceeds recommended 21 credit limit)`,
          affectedCourses: semester.courses.map((c) => c.id),
        })
      }

      // Check internship conflicts
      const internshipCourses = semester.courses.filter((course) => isInternshipCourse(course))
      const nonInternshipCourses = semester.courses.filter((course) => !isInternshipCourse(course))

      if (internshipCourses.length > 0 && nonInternshipCourses.length > 0) {
        newConflicts.push({
          type: "internship",
          severity: "warning",
          message: `${formatAcademicYear(semester.year)} ${semester.term} has internship courses mixed with regular courses. Internship courses are typically taken alone.`,
          affectedCourses: semester.courses.map((c) => c.id),
        })
      }

      if (internshipCourses.length > 1) {
        newConflicts.push({
          type: "internship",
          severity: "warning",
          message: `${formatAcademicYear(semester.year)} ${semester.term} has multiple internship courses. Consider taking them in separate terms.`,
          affectedCourses: internshipCourses.map((c) => c.id),
        })
      }

      // Check prerequisite conflicts
      semester.courses.forEach((course) => {
        course.prerequisites.forEach((prereqId) => {
          const prereqCourse = findCourseById(prereqId)
          if (prereqCourse && prereqCourse.status === "pending") {
            // Find if prerequisite is scheduled
            let prereqScheduled = false
            let prereqTerm = ""
            for (const sem of graduationPlan) {
              if (sem.courses.some((c) => c.id === prereqId)) {
                prereqScheduled = true
                prereqTerm = `${sem.year} ${sem.term}`
                // Check if prerequisite is scheduled at least one term before
                if (!isAtLeastOneTermAfter(semester.year, semester.term, sem.year, sem.term)) {
                  newConflicts.push({
                    type: "prerequisite",
                    severity: "error",
                    message: `${course.code} requires ${prereqCourse.code} to be completed at least one term before ${semester.year} ${semester.term}`,
                    affectedCourses: [course.id, prereqId],
                  })
                }
                break
              }
            }
            if (!prereqScheduled) {
              newConflicts.push({
                type: "prerequisite",
                message: `${course.code} requires ${prereqCourse.code} but it's not scheduled in the plan`,
                severity: "error",
                affectedCourses: [course.id, prereqId],
              })
            }
          }
        })
      })

      // Check schedule conflicts (same time slots)
      const scheduleMap = new Map<string, PlanCourse[]>()
      semester.courses.forEach((course) => {
        if (course.recommendedSection) {
          const timeKey = `${course.recommendedSection.meetingDays}-${course.recommendedSection.meetingTime}`
          if (!scheduleMap.has(timeKey)) {
            scheduleMap.set(timeKey, [])
          }
          scheduleMap.get(timeKey)!.push(course)
        }
      })

      scheduleMap.forEach((coursesAtTime, timeKey) => {
        if (coursesAtTime.length > 1 && timeKey !== "-TBD") {
          newConflicts.push({
            type: "schedule",
            severity: "error",
            message: `Schedule conflict in ${formatAcademicYear(semester.year)} ${semester.term}: ${coursesAtTime
              .map((c) => c.code)
              .join(", ")} have overlapping time slots`,
            affectedCourses: coursesAtTime.map((c) => c.id),
          })
        }
      })
    })

    setConflicts(newConflicts)
  }

  // Generate available terms for moving a course
  const getAvailableTermsForMove = (course: PlanCourse): { year: number; term: string; label: string }[] => {
    const terms: { year: number; term: string; label: string }[] = []
    const maxYears = 5 // Look ahead 5 years

    for (let yearOffset = 0; yearOffset < maxYears; yearOffset++) {
      const year = currentYear + yearOffset
      const termOptions = ["Term 1", "Term 2", "Term 3"]

      for (const term of termOptions) {
        // Skip terms that are in the past
        if (year === currentYear) {
          const currentTermIndex = termOptions.indexOf(currentTerm)
          const termIndex = termOptions.indexOf(term)
          if (termIndex < currentTermIndex) continue
        } else if (year < currentYear) {
          continue
        }

        // Check if the course can be scheduled in this term
        if (canScheduleInTerm(course, year, term)) {
          terms.push({
            year,
            term,
            label: `${formatAcademicYear(year)} - ${term}`,
          })
        }
      }
    }

    return terms
  }

  // Get common available terms for multiple courses
  const getCommonAvailableTerms = (courseIds: string[]): { year: number; term: string; label: string }[] => {
    if (courseIds.length === 0) return []

    // Find all courses in the graduation plan
    const coursesToMove: PlanCourse[] = []
    for (const semester of graduationPlan) {
      for (const course of semester.courses) {
        if (courseIds.includes(course.id)) {
          coursesToMove.push(course)
        }
      }
    }

    if (coursesToMove.length === 0) return []

    // Get available terms for the first course
    let commonTerms = getAvailableTermsForMove(coursesToMove[0])

    // Find intersection with other courses' available terms
    for (let i = 1; i < coursesToMove.length; i++) {
      const courseTerms = getAvailableTermsForMove(coursesToMove[i])
      commonTerms = commonTerms.filter((term) =>
        courseTerms.some((ct) => ct.year === term.year && ct.term === term.term),
      )
    }

    return commonTerms
  }

  // Add to move history
  const addToMoveHistory = (entry: Omit<MoveHistoryEntry, "id" | "timestamp">) => {
    const newEntry: MoveHistoryEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date(),
    }
    setMoveHistory((prev) => [newEntry, ...prev.slice(0, 9)]) // Keep last 10 entries
  }

  // Undo the last move
  const undoLastMove = () => {
    if (moveHistory.length === 0) return

    const lastMove = moveHistory[0]

    // Remove the last move from history
    setMoveHistory((prev) => prev.slice(1))

    // Reverse the changes based on move type
    switch (lastMove.type) {
      case "single":
        // For single moves, swap the from and to positions
        const change = lastMove.changes[0]
        moveCourseToTermSilent(change.courseId, change.fromYear, change.fromTerm)
        break

      case "bulk":
        // For bulk moves, move all courses back to their original positions
        lastMove.changes.forEach((change) => {
          moveCourseToTermSilent(change.courseId, change.fromYear, change.fromTerm)
        })
        break

      case "swap":
        // For swaps, swap the courses back
        if (lastMove.changes.length === 2) {
          const [change1, change2] = lastMove.changes
          swapCoursesSilent(change1.courseId, change2.courseId)
        }
        break
    }
  }

  // Move a course to a different term without adding to history (for undo)
  const moveCourseToTermSilent = (courseId: string, targetYear: number, targetTerm: string) => {
    setGraduationPlan((prevPlan) => {
      // Find and remove the course from its current semester
      let courseToMove: PlanCourse | null = null
      const updatedPlan = prevPlan
        .map((semester) => {
          const courseIndex = semester.courses.findIndex((course) => course.id === courseId)
          if (courseIndex !== -1) {
            courseToMove = semester.courses[courseIndex]
            return {
              ...semester,
              courses: semester.courses.filter((course) => course.id !== courseId),
            }
          }
          return semester
        })
        .filter((semester) => semester.courses.length > 0) // Remove empty semesters

      if (!courseToMove) return prevPlan

      // Check if target semester already exists
      const targetSemesterIndex = updatedPlan.findIndex(
        (semester) => semester.year === targetYear && semester.term === targetTerm,
      )

      if (targetSemesterIndex !== -1) {
        // Add to existing semester
        updatedPlan[targetSemesterIndex].courses.push(courseToMove)
      } else {
        // Create new semester
        const newSemester: SemesterPlan = {
          year: targetYear,
          term: targetTerm,
          courses: [courseToMove],
        }

        // Insert in chronological order
        let insertIndex = updatedPlan.length
        for (let i = 0; i < updatedPlan.length; i++) {
          const semester = updatedPlan[i]
          if (
            semester.year > targetYear ||
            (semester.year === targetYear &&
              ["Term 1", "Term 2", "Term 3"].indexOf(semester.term) >
                ["Term 1", "Term 2", "Term 3"].indexOf(targetTerm))
          ) {
            insertIndex = i
            break
          }
        }
        updatedPlan.splice(insertIndex, 0, newSemester)
      }

      // Sort semesters chronologically
      updatedPlan.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        const termOrder = ["Term 1", "Term 2", "Term 3"]
        return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
      })

      return updatedPlan
    })
  }

  // Swap two courses between terms without adding to history (for undo)
  const swapCoursesSilent = (courseId1: string, courseId2: string) => {
    let course1Location: { year: number; term: string } | null = null
    let course2Location: { year: number; term: string } | null = null

    // Find current locations
    for (const semester of graduationPlan) {
      for (const course of semester.courses) {
        if (course.id === courseId1) {
          course1Location = { year: semester.year, term: semester.term }
        }
        if (course.id === courseId2) {
          course2Location = { year: semester.year, term: semester.term }
        }
      }
    }

    if (!course1Location || !course2Location) return

    setGraduationPlan((prevPlan) => {
      let course1: PlanCourse | null = null
      let course2: PlanCourse | null = null

      // Remove both courses from their current locations
      const updatedPlan = prevPlan.map((semester) => {
        const remainingCourses = semester.courses.filter((course) => {
          if (course.id === courseId1) {
            course1 = course
            return false
          }
          if (course.id === courseId2) {
            course2 = course
            return false
          }
          return true
        })
        return {
          ...semester,
          courses: remainingCourses,
        }
      })

      if (!course1 || !course2) return prevPlan

      // Add courses to their new locations
      updatedPlan.forEach((semester) => {
        if (semester.year === course1Location!.year && semester.term === course1Location!.term) {
          semester.courses.push(course2!)
        }
        if (semester.year === course2Location!.year && semester.term === course2Location!.term) {
          semester.courses.push(course1!)
        }
      })

      return updatedPlan
    })
  }

  // Move a course to a different term
  const moveCourseToTerm = (courseId: string, targetYear: number, targetTerm: string) => {
    let fromYear = 0
    let fromTerm = ""

    // Find current location
    for (const semester of graduationPlan) {
      if (semester.courses.some((c) => c.id === courseId)) {
        fromYear = semester.year
        fromTerm = semester.term
        break
      }
    }

    moveCourseToTermSilent(courseId, targetYear, targetTerm)

    // Add to history
    const course = findCourseById(courseId)
    if (course) {
      addToMoveHistory({
        type: "single",
        description: `Moved ${course.code} from ${fromYear} ${fromTerm} to ${targetYear} ${targetTerm}`,
        changes: [
          {
            courseId,
            fromYear,
            fromTerm,
            toYear: targetYear,
            toTerm: targetTerm,
          },
        ],
      })
    }
  }

  // Move multiple courses to the same term
  const moveMultipleCoursesToTerm = (courseIds: string[], targetYear: number, targetTerm: string) => {
    const changes: MoveHistoryEntry["changes"] = []

    // Find current locations
    const courseLocations = new Map<string, { year: number; term: string }>()
    for (const semester of graduationPlan) {
      for (const course of semester.courses) {
        if (courseIds.includes(course.id)) {
          courseLocations.set(course.id, { year: semester.year, term: semester.term })
        }
      }
    }

    setGraduationPlan((prevPlan) => {
      // Find and remove all selected courses from their current semesters
      const coursesToMove: PlanCourse[] = []
      const updatedPlan = prevPlan
        .map((semester) => {
          const remainingCourses = semester.courses.filter((course) => {
            if (courseIds.includes(course.id)) {
              coursesToMove.push(course)
              const location = courseLocations.get(course.id)
              if (location) {
                changes.push({
                  courseId: course.id,
                  fromYear: location.year,
                  fromTerm: location.term,
                  toYear: targetYear,
                  toTerm: targetTerm,
                })
              }
              return false
            }
            return true
          })
          return {
            ...semester,
            courses: remainingCourses,
          }
        })
        .filter((semester) => semester.courses.length > 0) // Remove empty semesters

      if (coursesToMove.length === 0) return prevPlan

      // Check if target semester already exists
      const targetSemesterIndex = updatedPlan.findIndex(
        (semester) => semester.year === targetYear && semester.term === targetTerm,
      )

      if (targetSemesterIndex !== -1) {
        // Add to existing semester
        updatedPlan[targetSemesterIndex].courses.push(...coursesToMove)
      } else {
        // Create new semester
        const newSemester: SemesterPlan = {
          year: targetYear,
          term: targetTerm,
          courses: coursesToMove,
        }

        // Insert in chronological order
        let insertIndex = updatedPlan.length
        for (let i = 0; i < updatedPlan.length; i++) {
          const semester = updatedPlan[i]
          if (
            semester.year > targetYear ||
            (semester.year === targetYear &&
              ["Term 1", "Term 2", "Term 3"].indexOf(semester.term) >
                ["Term 1", "Term 2", "Term 3"].indexOf(targetTerm))
          ) {
            insertIndex = i
            break
          }
        }
        updatedPlan.splice(insertIndex, 0, newSemester)
      }

      // Sort semesters chronologically
      updatedPlan.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        const termOrder = ["Term 1", "Term 2", "Term 3"]
        return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
      })

      return updatedPlan
    })

    // Add to history
    addToMoveHistory({
      type: "bulk",
      description: `Moved ${courseIds.length} courses to ${targetYear} ${targetTerm}`,
      changes,
    })
  }

  // Swap two courses between terms
  const swapCourses = (courseId1: string, courseId2: string) => {
    const changes: MoveHistoryEntry["changes"] = []
    let course1Location: { year: number; term: string } | null = null
    let course2Location: { year: number; term: string } | null = null

    // Find current locations
    for (const semester of graduationPlan) {
      for (const course of semester.courses) {
        if (course.id === courseId1) {
          course1Location = { year: semester.year, term: semester.term }
        }
        if (course.id === courseId2) {
          course2Location = { year: semester.year, term: semester.term }
        }
      }
    }

    if (!course1Location || !course2Location) return

    swapCoursesSilent(courseId1, courseId2)

    // Add to history
    const c1 = findCourseById(courseId1)
    const c2 = findCourseById(courseId2)
    if (c1 && c2) {
      addToMoveHistory({
        type: "swap",
        description: `Swapped ${c1.code} and ${c2.code}`,
        changes: [
          {
            courseId: courseId1,
            fromYear: course1Location.year,
            fromTerm: course1Location.term,
            toYear: course2Location.year,
            toTerm: course2Location.term,
          },
          {
            courseId: courseId2,
            fromYear: course2Location.year,
            fromTerm: course2Location.term,
            toYear: course1Location.year,
            toTerm: course1Location.term,
          },
        ],
      })
    }
  }

  // Handle bulk move
  const handleBulkMove = () => {
    if (bulkMoveTargetTerm && selectedCourses.size > 0) {
      const [year, term] = bulkMoveTargetTerm.split("-")
      moveMultipleCoursesToTerm(Array.from(selectedCourses), Number.parseInt(year), term)
      setSelectedCourses(new Set())
      setBulkMoveDialogOpen(false)
      setBulkMoveTargetTerm("")
    }
  }

  // Handle course swap
  const handleSwap = () => {
    if (swapCourse1 && swapCourse2 && swapCourse1 !== swapCourse2) {
      swapCourses(swapCourse1, swapCourse2)
      setSwapDialogOpen(false)
      setSwapCourse1("")
      setSwapCourse2("")
    }
  }

  // Get all courses in the plan for swap selection
  const getAllCoursesInPlan = (): { id: string; code: string; location: string }[] => {
    const courses: { id: string; code: string; location: string }[] = []
    graduationPlan.forEach((semester) => {
      semester.courses.forEach((course) => {
        courses.push({
          id: course.id,
          code: course.code,
          location: `${formatAcademicYear(semester.year)} ${semester.term}`,
        })
      })
    })
    return courses
  }

  // Export graduation plan
  const exportPlan = (format: "json" | "csv" | "txt") => {
    const planData = graduationPlan.map((semester) => ({
      year: semester.year,
      term: semester.term,
      courses: semester.courses.map((course) => ({
        code: course.code,
        name: course.name,
        credits: course.credits,
        section: course.recommendedSection?.section || "TBD",
        schedule: course.recommendedSection
          ? `${course.recommendedSection.meetingDays} ${course.recommendedSection.meetingTime}`
          : "TBD",
        room: course.recommendedSection?.room || "TBD",
      })),
    }))

    let content = ""
    let filename = ""
    let mimeType = ""

    switch (format) {
      case "json":
        content = JSON.stringify(planData, null, 2)
        filename = "graduation-plan.json"
        mimeType = "application/json"
        break
      case "csv":
        content = "AcademicYear,Term,Course Code,Course Name,Credits,Section,Schedule,Room\n"
        planData.forEach((semester) => {
          const academic = formatAcademicYear(semester.year)
          semester.courses.forEach((course) => {
            content += `${academic},${semester.term},"${course.code}","${course.name}",${course.credits},"${course.section}","${course.schedule}","${course.room}"\n`
          })
        })
        filename = "graduation-plan.csv"
        mimeType = "text/csv"
        break
      case "txt":
        content = "GRADUATION PLAN\n\n"
        planData.forEach((semester) => {
          content += `${formatAcademicYear(semester.year)} - ${semester.term}\n`
          content += "=" + "=".repeat(20) + "\n"
          semester.courses.forEach((course) => {
            content += `${course.code} - ${course.name} (${course.credits} credits)\n`
            content += `  Section: ${course.section}\n`
            content += `  Schedule: ${course.schedule}\n`
            content += `  Room: ${course.room}\n\n`
          })
          content += "\n"
        })
        filename = "graduation-plan.txt"
        mimeType = "text/plain"
        break
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Parse imported plan data
  const parseImportedData = (content: string, format: "json" | "csv" | "txt"): ImportedPlanData[] => {
    switch (format) {
      case "json":
        try {
          const data = JSON.parse(content)
          if (!Array.isArray(data)) {
            throw new Error("JSON must be an array of semesters")
          }
          return data.map((semester: any) => ({
            year: Number(semester.year),
            term: semester.term,
            courses: semester.courses.map((course: any) => ({
              code: course.code,
              name: course.name,
              credits: Number(course.credits),
              section: course.section,
              schedule: course.schedule,
              room: course.room,
            })),
          }))
        } catch (error) {
          throw new Error("Invalid JSON format")
        }

      case "csv":
        try {
          const lines = content.trim().split("\n")
          const header = lines[0]
          if (!header.includes("Year,Term,Course Code")) {
            throw new Error("Invalid CSV format - missing required headers")
          }

          const semesterMap = new Map<string, ImportedPlanData>()

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            // Parse CSV line (handle quoted values)
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []
            const cleanValues = values.map((v) => v.replace(/^"|"$/g, ""))

            if (cleanValues.length < 4) continue

            const [year, term, code, name, credits, section, schedule, room] = cleanValues
            const semesterKey = `${year}-${term}`

            if (!semesterMap.has(semesterKey)) {
              semesterMap.set(semesterKey, {
                year: Number(year),
                term,
                courses: [],
              })
            }

            // Robust credit parsing: prefer explicit credits column, preserve 0,
            // otherwise look for a parenthesized "(N credits)" in the course name.
            const parsedCredits = (() => {
              const n = Number(credits)
              if (Number.isFinite(n)) return n

              // Try to extract from the name like "Course Name (3 credits)"
              const parenMatch = name ? name.match(/\((\d+)\s*credits?\)/i) : null
              if (parenMatch) return Number(parenMatch[1])

              // If nothing found, default to 0 (safer than assuming 3)
              return 0
            })()

            semesterMap.get(semesterKey)!.courses.push({
              code,
              name,
              credits: parsedCredits,
              section,
              schedule,
              room,
            })
          }

          return Array.from(semesterMap.values())
        } catch (error) {
          throw new Error("Invalid CSV format")
        }

      case "txt":
        try {
          const sections = content.split(/\n\s*\n/)
          const planData: ImportedPlanData[] = []

          for (const section of sections) {
            const lines = section.trim().split("\n")
            if (lines.length < 2) continue

            // Look for semester header (e.g., "2025 - Term 1")
            const semesterMatch = lines[0].match(/(\d{4})\s*-\s*(Term\s*\d+)/)
            if (!semesterMatch) continue

            const year = Number(semesterMatch[1])
            const term = semesterMatch[2]
            const courses: ImportedPlanData["courses"] = []

            for (let i = 2; i < lines.length; i++) {
              const line = lines[i].trim()
              if (!line || line.startsWith("=")) continue

              // Look for course line (e.g., "GED0047 - FOREIGN LANGUAGE (3 credits)")
              const courseMatch = line.match(/^([A-Z]{2,4}\d{4})\s*-\s*(.+?)\s*\((\d+)\s*credits?\)/i)
              if (courseMatch) {
                const [, code, name, credits] = courseMatch
                const parsed = Number(credits)
                courses.push({
                  code,
                  name,
                  credits: Number.isFinite(parsed) ? parsed : 0,
                })
              } else {
                // Try to parse lines without parentheses by splitting on '-' and extracting trailing number safely
                const parts = line.split("-")
                if (parts.length >= 2) {
                  const code = parts[0].trim()
                  const rest = parts.slice(1).join("-").trim()
                  // Attempt to find a parenthesized credit anywhere in rest
                  const parenMatch = rest.match(/\((\d+)\s*credits?\)/i)
                  if (parenMatch) {
                    const parsed = Number(parenMatch[1])
                    courses.push({ code, name: rest.replace(/\s*\(.*$/i, "").trim(), credits: Number.isFinite(parsed) ? parsed : 0 })
                  } else {
                    // No credit info; default to 0
                    const inferredName = rest.replace(/\s*\(.*$/i, "").trim()
                    courses.push({ code, name: inferredName, credits: 0 })
                  }
                }
              }
            }

            if (courses.length > 0) {
              planData.push({ year, term, courses })
            }
          }

          return planData
        } catch (error) {
          throw new Error("Invalid TXT format")
        }

      default:
        throw new Error("Unsupported format")
    }
  }

  // Import graduation plan
  const importPlan = async (file: File) => {
    try {
      setImportError(null)
      const content = await file.text()
      const extension = file.name.split(".").pop()?.toLowerCase()

      let format: "json" | "csv" | "txt"
      switch (extension) {
        case "json":
          format = "json"
          break
        case "csv":
          format = "csv"
          break
        case "txt":
          format = "txt"
          break
        default:
          throw new Error("Unsupported file format. Please use JSON, CSV, or TXT files.")
      }

      const importedData = parseImportedData(content, format)

      if (importedData.length === 0) {
        throw new Error("No valid semester data found in the file")
      }

      // Convert imported data to graduation plan format
      const newPlan: SemesterPlan[] = []

      for (const semesterData of importedData) {
        const semesterCourses: PlanCourse[] = []

        for (const courseData of semesterData.courses) {
          // Find the course in our course list
          const course = findCourseByCode(courseData.code)
          if (!course) {
            console.warn(`Course ${courseData.code} not found in course database`)
            continue
          }

          // Create plan course
          const availableSections = getAvailableSections(course.code)
          const needsPetition = !hasAvailableSections(course.code)
          let recommendedSection: CourseSection | undefined

          // Try to find the section if specified
          if (courseData.section && courseData.section !== "TBD") {
            recommendedSection = availableSections.find((s) => s.section === courseData.section)
          }

          if (!recommendedSection) {
            recommendedSection = findBestSection(course.code)
          }

          const planCourse: PlanCourse = {
            ...course,
            availableSections,
            needsPetition,
            recommendedSection,
          }

          semesterCourses.push(planCourse)
        }

        if (semesterCourses.length > 0) {
          newPlan.push({
            year: semesterData.year,
            term: semesterData.term,
            courses: semesterCourses,
          })
        }
      }

      // Sort semesters chronologically
      newPlan.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        const termOrder = ["Term 1", "Term 2", "Term 3"]
        return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
      })

      // Update graduation plan
      setGraduationPlan(newPlan)

      // Initialize all semesters as closed except the first one
      const newOpenSemesters: { [key: string]: boolean } = {}
      newPlan.forEach((semester, index) => {
        const key = `${semester.year}-${semester.term}`
        newOpenSemesters[key] = index === 0
      })
      setOpenSemesters(newOpenSemesters)

      // Clear move history since we're starting fresh
      setMoveHistory([])

      // Close import dialog
      setImportDialogOpen(false)

      // Show success message
      alert(
        `Successfully imported graduation plan with ${newPlan.length} semesters and ${newPlan.reduce((sum, s) => sum + s.courses.length, 0)} courses.`,
      )
    } catch (error: any) {
      setImportError(error.message)
    }
  }

  // Handle file selection for import
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      importPlan(file)
    }
  }

  // Toggle course selection
  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourses((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(courseId)) {
        newSet.delete(courseId)
      } else {
        newSet.add(courseId)
      }
      return newSet
    })
  }

  // Select all courses in a semester
  const selectAllCoursesInSemester = (semesterCourses: PlanCourse[]) => {
    setSelectedCourses((prev) => {
      const newSet = new Set(prev)
      semesterCourses.forEach((course) => newSet.add(course.id))
      return newSet
    })
  }

  // Deselect all courses in a semester
  const deselectAllCoursesInSemester = (semesterCourses: PlanCourse[]) => {
    setSelectedCourses((prev) => {
      const newSet = new Set(prev)
      semesterCourses.forEach((course) => newSet.delete(course.id))
      return newSet
    })
  }

  // Generate a graduation plan for the student
  const generateGraduationPlan = () => {
    // Get all pending and active courses
    const pendingCourses = courses.filter((course) => course.status === "pending")
    const activeCourses = courses.filter((course) => course.status === "active")

    console.log("Generating plan with:", {
      pendingCount: pendingCourses.length,
      activeCount: activeCourses.length,
      totalCourses: courses.length,
    })

    // If we have no courses to plan, return early
    if (pendingCourses.length === 0 && activeCourses.length === 0) {
      setGraduationPlan([])
      return
    }

    // If no courses are marked as active or passed, recommend the curriculum order (group by original year/term)
    const anyProgress = courses.some((c) => c.status === "active" || c.status === "passed")
    if (!anyProgress) {
      // Group by year and term using the course.year/course.term from initial data
      const grouped = new Map<string, SemesterPlan>()
      const termOrder = ["Term 1", "Term 2", "Term 3"]

      // sort courses by year then term to preserve curriculum order
      const sorted = [...courses].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
      })

      for (const c of sorted) {
        if (c.status === "pending" || c.status === "active") {
          const key = `${c.year}-${c.term}`
          if (!grouped.has(key)) grouped.set(key, { year: c.year, term: c.term, courses: [] })
          const planCourse: PlanCourse = {
            ...c,
            availableSections: getAvailableSections(c.code),
            needsPetition: !hasAvailableSections(c.code),
            recommendedSection: findBestSection(c.code),
          }
          grouped.get(key)!.courses.push(planCourse)
        }
      }

      const planArray = Array.from(grouped.values())
      setGraduationPlan(planArray)
      return
    }

    // Separate internship and regular courses
    const allCoursesToSchedule = [...pendingCourses, ...activeCourses]
    const internshipCourses = allCoursesToSchedule.filter((course) => isInternshipCourse(course))
    const regularCourses = allCoursesToSchedule.filter((course) => !isInternshipCourse(course))

    // Sort internship courses by priority (Internship 1 first, then Internship 2)
    internshipCourses.sort((a, b) => getInternshipPriority(a) - getInternshipPriority(b))

    console.log("Course separation:", {
      regular: regularCourses.length,
      internship: internshipCourses.length,
    })

    // Create a dependency graph for regular courses only
    const dependencyGraph = new Map<string, string[]>()
    regularCourses.forEach((course) => {
      dependencyGraph.set(course.id, course.prerequisites)
    })

    // Perform topological sort to respect prerequisites for regular courses
    const sortedRegularCourses = topologicalSort(regularCourses, dependencyGraph)

    console.log("Sorted regular courses:", sortedRegularCourses.length)

    // Enhance regular courses with section availability info
    const enhancedRegularCourses: PlanCourse[] = sortedRegularCourses.map((course) => {
      const availableSections = getAvailableSections(course.code)
      const needsPetition = !hasAvailableSections(course.code)
      const recommendedSection = findBestSection(course.code)

      return {
        ...course,
        availableSections,
        needsPetition,
        recommendedSection,
      }
    })

    // Enhance internship courses with section availability info
    const enhancedInternshipCourses: PlanCourse[] = internshipCourses.map((course) => {
      const availableSections = getAvailableSections(course.code)
      const needsPetition = !hasAvailableSections(course.code)
      const recommendedSection = findBestSection(course.code)

      return {
        ...course,
        availableSections,
        needsPetition,
        recommendedSection,
      }
    })

    // Group regular courses into semesters with prerequisite gap enforcement
    const plan: SemesterPlan[] = []
    let currentPlanYear = currentYear
    let currentPlanTerm = currentTerm
    let currentSemesterCourses: PlanCourse[] = []
    let currentSemesterCredits = 0
    const MAX_CREDITS_PER_SEMESTER = 21

  // Reserved internship terms (determine from curriculum)
  const maxCurriculumYear = Math.max(...courses.map((c) => c.year))
  const internshipTargetYearLocal = startYear + (maxCurriculumYear - 1)
  const reservedTermsLocal = new Set([`${internshipTargetYearLocal}-Term 2`, `${internshipTargetYearLocal}-Term 3`])

    // Track when each course was scheduled (for prerequisite gap enforcement)
    const courseScheduleMap = new Map<string, { year: number; term: string }>()

    // Add passed courses to the schedule map so prerequisites work correctly
    courses
      .filter((c) => c.status === "passed")
      .forEach((course) => {
        // Assume passed courses were completed in their original term or earlier
        courseScheduleMap.set(course.id, { year: course.year + startYear - 1, term: course.term })
      })

    // Helper to check if a course can be scheduled in a given term
    const canScheduleInTermLocal = (course: PlanCourse, year: number, term: string): boolean => {
      // Check if all prerequisites have been scheduled at least one term before
      return course.prerequisites.every((prereqId) => {
        const prereqSchedule = courseScheduleMap.get(prereqId)
        if (!prereqSchedule) {
          // Check if prerequisite is already passed
          const prereqCourse = findCourseById(prereqId)
          return prereqCourse && prereqCourse.status === "passed"
        }
        return isAtLeastOneTermAfter(year, term, prereqSchedule.year, prereqSchedule.term)
      })
    }

    // Sort regular courses by priority
    enhancedRegularCourses.sort((a, b) => {
      // First priority: active courses
      if (a.status === "active" && b.status !== "active") return -1
      if (a.status !== "active" && b.status === "active") return 1

      // Second priority: courses with prerequisites met
      const aPrereqsMet = arePrerequisitesMet(a)
      const bPrereqsMet = arePrerequisitesMet(b)
      if (aPrereqsMet && !bPrereqsMet) return -1
      if (!aPrereqsMet && bPrereqsMet) return 1

      // Third priority: courses with available sections
      if (!a.needsPetition && b.needsPetition) return -1
      if (a.needsPetition && !b.needsPetition) return 1

      // Fourth priority: by original year and term
      if (a.year !== b.year) return a.year - b.year
      const termOrder = ["Term 1", "Term 2", "Term 3"]
      return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
    })

    // Schedule regular courses first
    const remainingRegularCourses = [...enhancedRegularCourses]
    const maxIterations = 100 // Prevent infinite loops
    let iteration = 0

    while (remainingRegularCourses.length > 0 && iteration < maxIterations) {
      iteration++
      let coursesScheduledThisIteration = 0

      // If current term is a reserved internship term, skip to next term
      while (reservedTermsLocal.has(`${currentPlanYear}-${currentPlanTerm}`)) {
        const nxt = getNextTerm(currentPlanYear, currentPlanTerm)
        currentPlanYear = nxt.year
        currentPlanTerm = nxt.term
        // reset current semester buffer when skipping
        if (currentSemesterCourses.length > 0) {
          plan.push({ year: currentPlanYear, term: currentPlanTerm, courses: [...currentSemesterCourses] })
          currentSemesterCourses = []
          currentSemesterCredits = 0
        }
      }

      console.log(`Regular courses iteration ${iteration}: ${remainingRegularCourses.length} courses remaining`)

      // Try to schedule courses in the current term
      for (let i = remainingRegularCourses.length - 1; i >= 0; i--) {
        const course = remainingRegularCourses[i]

        // Check if this course can be scheduled in the current term
        if (!canScheduleInTermLocal(course, currentPlanYear, currentPlanTerm)) {
          continue // Skip this course for now
        }

        // If adding this course would exceed the credit limit, start a new semester (do not add if it would exceed)
        if (currentSemesterCredits + course.credits > MAX_CREDITS_PER_SEMESTER) {
          if (currentSemesterCourses.length > 0) {
          // Save current semester
          plan.push({
            year: currentPlanYear,
            term: currentPlanTerm,
            courses: [...currentSemesterCourses],
          })

          // Move to next term
          const next = getNextTerm(currentPlanYear, currentPlanTerm)
          currentPlanYear = next.year
          currentPlanTerm = next.term
          currentSemesterCourses = []
          currentSemesterCredits = 0
          // skip reserved terms
          while (reservedTermsLocal.has(`${currentPlanYear}-${currentPlanTerm}`)) {
            const n = getNextTerm(currentPlanYear, currentPlanTerm)
            currentPlanYear = n.year
            currentPlanTerm = n.term
          }
          // after moving to next term, try to schedule this course in the next iteration
          continue
        } else {
          // course fits in empty semester (rare case where course.credits > MAX handled above)
        }
        
        }

        // Add course to current semester
        currentSemesterCourses.push(course)
        currentSemesterCredits += course.credits
        courseScheduleMap.set(course.id, { year: currentPlanYear, term: currentPlanTerm })

        // Remove from remaining courses
        remainingRegularCourses.splice(i, 1)
        coursesScheduledThisIteration++

        console.log(`Scheduled regular ${course.code} in ${currentPlanYear} ${currentPlanTerm}`)
      }

      // If no courses were scheduled in this iteration, move to next term
      if (coursesScheduledThisIteration === 0 && remainingRegularCourses.length > 0) {
        // Save current semester if it has courses
        if (currentSemesterCourses.length > 0) {
          plan.push({
            year: currentPlanYear,
            term: currentPlanTerm,
            courses: [...currentSemesterCourses],
          })
          currentSemesterCourses = []
          currentSemesterCredits = 0
        }

        // Move to next term
        const next = getNextTerm(currentPlanYear, currentPlanTerm)
        currentPlanYear = next.year
        currentPlanTerm = next.term

        console.log(`Moving to next term for regular courses: ${currentPlanYear} ${currentPlanTerm}`)
      }
    }

    // Add the last semester if it has regular courses
    if (currentSemesterCourses.length > 0) {
      plan.push({
        year: currentPlanYear,
        term: currentPlanTerm,
        courses: currentSemesterCourses,
      })

      // Move to next term for internships
      const next = getNextTerm(currentPlanYear, currentPlanTerm)
      currentPlanYear = next.year
      currentPlanTerm = next.term
    }

  // Now schedule internship courses into the program's last year fixed terms (Term 2 and Term 3)
  // Use the internshipTargetYear computed earlier (internshipTargetYearLocal)
  const internshipTargetYear = internshipTargetYearLocal

    // Ensure the reserved internship semesters contain only internships.
    // If regular courses were scheduled into those terms, move them into Term 1 of the internship year or earlier.
    const reservedTerms = reservedTermsLocal

    // Helper to find or create a semester in the plan and return it
    const findOrCreateSemester = (year: number, term: string): SemesterPlan => {
      let idx = plan.findIndex((s) => s.year === year && s.term === term)
      if (idx !== -1) return plan[idx]

      const newSemester: SemesterPlan = { year, term, courses: [] }
      // Insert chronologically
      let insertIndex = plan.length
      for (let i = 0; i < plan.length; i++) {
        const semester = plan[i]
        if (
          semester.year > year ||
          (semester.year === year && ["Term 1", "Term 2", "Term 3"].indexOf(semester.term) > ["Term 1", "Term 2", "Term 3"].indexOf(term))
        ) {
          insertIndex = i
          break
        }
      }
      plan.splice(insertIndex, 0, newSemester)
      return newSemester
    }

    // Collect non-internship courses that ended up in reserved terms
    const nonInternshipsToRelocate: PlanCourse[] = []

    for (const semester of [...plan]) {
      const key = `${semester.year}-${semester.term}`
      if (reservedTerms.has(key)) {
        const internshipsInThis = semester.courses.filter((c) => isInternshipCourse(c))
        const nonInternships = semester.courses.filter((c) => !isInternshipCourse(c))
        if (nonInternships.length > 0) {
          // Remove non-internships from this semester
          semester.courses = internshipsInThis
          nonInternshipsToRelocate.push(...nonInternships)
        }
      }
    }

    // Relocate non-internship courses preferably to Term 1 of the internship year; if not available, append earlier.
    if (nonInternshipsToRelocate.length > 0) {
      const targetSemester = findOrCreateSemester(internshipTargetYear, "Term 1")
      targetSemester.courses.push(...nonInternshipsToRelocate)
      // Update schedule map
      nonInternshipsToRelocate.forEach((c) => courseScheduleMap.set(c.id, { year: targetSemester.year, term: targetSemester.term }))
    }

    // Determine which internship is which by inspecting course name (Internship 1 or Internship 2)
    const internship1 = enhancedInternshipCourses.find((c) => c.name.toLowerCase().includes("internship 1"))
    const internship2 = enhancedInternshipCourses.find((c) => c.name.toLowerCase().includes("internship 2"))

    // Remaining internships that are not explicitly numbered
    const otherInternships = enhancedInternshipCourses.filter(
      (c) => !c.name.toLowerCase().includes("internship 1") && !c.name.toLowerCase().includes("internship 2"),
    )

    // Helper to place a single internship into a specific term
    const placeInternship = (course: PlanCourse | undefined, year: number, term: string) => {
      if (!course) return
      // If the semester already exists in plan, append; otherwise create it
      const existingIndex = plan.findIndex((s) => s.year === year && s.term === term)
      if (existingIndex !== -1) {
        // Ensure only internships are in this semester
        plan[existingIndex].courses = plan[existingIndex].courses.filter((c) => isInternshipCourse(c))
        plan[existingIndex].courses.push(course)
      } else {
        plan.push({ year, term, courses: [course] })
      }
      courseScheduleMap.set(course.id, { year, term })
      console.log(`Scheduled internship ${course.code} in ${year} ${term}`)
    }

    // Place Internship 1 in Term 2, Internship 2 in Term 3 of the internshipTargetYear
    placeInternship(internship1, internshipTargetYear, "Term 2")
    placeInternship(internship2, internshipTargetYear, "Term 3")

    // If there are extra internships (unnumbered), append them after Internship 2 in subsequent terms
    let extraYear = internshipTargetYear
    let extraTerm: string = "Term 3"
    for (const extra of otherInternships) {
      // Advance to next term after the current extraTerm
      const next = getNextTerm(extraYear, extraTerm)
      extraYear = next.year
      extraTerm = next.term
      placeInternship(extra, extraYear, extraTerm)
    }

    console.log(
      "Final plan:",
      plan.map((s) => `${formatAcademicYear(s.year)} ${s.term}: ${s.courses.length} courses (${s.courses.map((c) => c.code).join(", ")})`),
    )

    // Initialize all semesters as closed except the first one
    const newOpenSemesters: { [key: string]: boolean } = {}
    plan.forEach((semester, index) => {
      const key = `${semester.year}-${semester.term}`
      newOpenSemesters[key] = index === 0 // Only open the first semester
    })

    setOpenSemesters(newOpenSemesters)
    setGraduationPlan(plan)
  }

  // Remove a course from the graduation plan
  const removeCourseFromPlan = (courseId: string) => {
    setGraduationPlan((prevPlan) => {
      const updatedPlan = prevPlan
        .map((semester) => ({
          ...semester,
          courses: semester.courses.filter((course) => course.id !== courseId),
        }))
        .filter((semester) => semester.courses.length > 0) // Remove empty semesters

      return updatedPlan
    })
  }

  // Change section for a course in the plan
  const changeCourseSection = (courseId: string, newSection: CourseSection) => {
    setGraduationPlan((prevPlan) => {
      return prevPlan.map((semester) => ({
        ...semester,
        courses: semester.courses.map((course) =>
          course.id === courseId ? { ...course, recommendedSection: newSection } : course,
        ),
      }))
    })
  }

  // Topological sort algorithm
  const topologicalSort = (courses: Course[], graph: Map<string, string[]>): Course[] => {
    const result: Course[] = []
    const visited = new Set<string>()
    const temp = new Set<string>()

    // DFS function
    const visit = (courseId: string) => {
      // If we've already processed this node, skip
      if (visited.has(courseId)) return

      // If we're already visiting this node, we have a cycle
      if (temp.has(courseId)) return

      // Mark as being visited
      temp.add(courseId)

      // Visit all prerequisites first
      const prerequisites = graph.get(courseId) || []
      prerequisites.forEach((prereq) => {
        // Only visit if the prerequisite is in our pending courses
        if (courses.some((c) => c.id === prereq)) {
          visit(prereq)
        }
      })

      // Mark as visited and add to result
      temp.delete(courseId)
      visited.add(courseId)

      // Add the course to the result
      const course = courses.find((c) => c.id === courseId)
      if (course) {
        result.push(course)
      }
    }

    // Visit all courses
    courses.forEach((course) => {
      if (!visited.has(course.id)) {
        visit(course.id)
      }
    })

    return result
  }

  // Toggle semester collapsible
  const toggleSemester = (year: number, term: string) => {
    const key = `${year}-${term}`
    setOpenSemesters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Calculate expected graduation date
  const calculateExpectedGraduation = (): string => {
    if (graduationPlan.length === 0) return "N/A"

    const lastSemester = graduationPlan[graduationPlan.length - 1]

    // Check if the last semester contains Internship 2
    const hasInternship2 = lastSemester.courses.some((course) => course.name.toUpperCase().includes("INTERNSHIP 2"))

    // If it has Internship 2, graduation is the next term
    // Otherwise, graduation is also the next term after the last planned semester
    const nextTerm = getNextTerm(lastSemester.year, lastSemester.term)
    return `${formatAcademicYear(nextTerm.year)} ${nextTerm.term}`
  }

  // Calculate total remaining credits
  const calculateRemainingCredits = (): number => {
    return courses.filter((course) => course.status === "pending").reduce((sum, course) => sum + course.credits, 0)
  }

  // Open the student portal course offerings page
  const openStudentPortal = () => {
    window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")
  }

  // Add this helper function after the other helper functions (around line 200)
  // Get courses that are not in the graduation plan
  const getUnscheduledCourses = (): PlanCourse[] => {
    const coursesInPlan = new Set<string>()

    // Collect all course IDs that are in the graduation plan
    graduationPlan.forEach((semester) => {
      semester.courses.forEach((course) => {
        coursesInPlan.add(course.id)
      })
    })

    // Find pending and active courses that are not in the plan
    const unscheduledCourses = courses
      .filter((course) => (course.status === "pending" || course.status === "active") && !coursesInPlan.has(course.id))
      .map((course) => {
        const availableSections = getAvailableSections(course.code)
        const needsPetition = !hasAvailableSections(course.code)
        const recommendedSection = findBestSection(course.code)

        return {
          ...course,
          availableSections,
          needsPetition,
          recommendedSection,
        }
      })

    return unscheduledCourses
  }

  // Add course to a specific term
  const addCourseToTerm = (courseId: string, targetYear: number, targetTerm: string) => {
    const course = findCourseById(courseId)
    if (!course) return
  // Prevent adding non-internship courses into reserved internship terms by default
  const _maxCurrYear_forAdd = Math.max(...courses.map((c) => c.year))
  const internshipTargetYear = startYear + (_maxCurrYear_forAdd - 1)
  const isReserved = targetYear === internshipTargetYear && (targetTerm === "Term 2" || targetTerm === "Term 3")

  // If it's a reserved term and the course is not an internship, open confirmation modal
  if (isReserved && !isInternshipCourse(course)) {
    setPendingAdd({ courseId, targetYear, targetTerm })
    setOverloadDialogOpen(true)
    return
  }

  // Otherwise perform the add immediately
  performAddCourseToTerm(courseId, targetYear, targetTerm)
  }

  // Perform the actual insertion of a course into a term (shared by modal confirm)
  const performAddCourseToTerm = (courseId: string, targetYear: number, targetTerm: string) => {
    const course = findCourseById(courseId)
    if (!course) return

    // Create enhanced course
    const availableSections = getAvailableSections(course.code)
    const needsPetition = !hasAvailableSections(course.code)
    const recommendedSection = findBestSection(course.code)

    const planCourse: PlanCourse = {
      ...course,
      availableSections,
      needsPetition,
      recommendedSection,
    }

    setGraduationPlan((prevPlan) => {
      // Check if target semester already exists
      const targetSemesterIndex = prevPlan.findIndex(
        (semester) => semester.year === targetYear && semester.term === targetTerm,
      )

      const updatedPlan = [...prevPlan]

      if (targetSemesterIndex !== -1) {
        // Add to existing semester
        updatedPlan[targetSemesterIndex] = {
          ...updatedPlan[targetSemesterIndex],
          courses: [...updatedPlan[targetSemesterIndex].courses, planCourse],
        }
      } else {
        // Create new semester
        const newSemester: SemesterPlan = {
          year: targetYear,
          term: targetTerm,
          courses: [planCourse],
        }

        // Insert in chronological order
        let insertIndex = updatedPlan.length
        for (let i = 0; i < updatedPlan.length; i++) {
          const semester = updatedPlan[i]
          if (
            semester.year > targetYear ||
            (semester.year === targetYear &&
              ["Term 1", "Term 2", "Term 3"].indexOf(semester.term) >
                ["Term 1", "Term 2", "Term 3"].indexOf(targetTerm))
          ) {
            insertIndex = i
            break
          }
        }
        updatedPlan.splice(insertIndex, 0, newSemester)
      }

      // Sort semesters chronologically
      updatedPlan.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        const termOrder = ["Term 1", "Term 2", "Term 3"]
        return termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
      })

      return updatedPlan
    })

    // Add to history
    addToMoveHistory({
      type: "single",
      description: `Added ${course.code} to ${targetYear} ${targetTerm}`,
      changes: [
        {
          courseId,
          fromYear: 0, // Not from any term
          fromTerm: "unscheduled",
          toYear: targetYear,
          toTerm: targetTerm,
        },
      ],
    })
  }

  // Convert 24-hour time to 12-hour format
  const formatTime = (time: string): string => {
    if (!time || time === "TBD") return time

    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

    return `${displayHour}:${minutes}${ampm}`
  }

  // Format meeting days and times
  const formatSchedule = (meetingDays: string, meetingTime: string): string => {
    if (!meetingDays || !meetingTime || meetingTime === "TBD") return "TBD"

    const days = parseDays(meetingDays)
      .map((day) => getFullDayName(day))
      .join("/")

    if (meetingTime.includes("-")) {
      const [startTime, endTime] = meetingTime.split("-")
      return `${days}\n${formatTime(startTime)}-${formatTime(endTime)}`
    }

    return `${days}\n${formatTime(meetingTime)}`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <QuickNavigation />
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Academic Planner</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Plan your path to graduation based on your current progress
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300">
            <Info className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4">
                <p className="mb-2">
                  You can still use the Academic Planner with limited functionality. The planner will create a
                  graduation plan based on your course statuses, but won't be able to recommend specific sections.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Button onClick={openStudentPortal} className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Student Portal Course Offerings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Page
                  </Button>
                </div>
                <p className="mt-2 text-sm">
                  Use the Chrome extension to extract course data from the Student Portal. After extracting the data,
                  refresh this page to see available sections.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Conflicts Alert */}
        {conflicts.length > 0 && (
          <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Plan Conflicts Detected</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="text-sm">
                    <Badge variant={conflict.severity === "error" ? "destructive" : "secondary"} className="mr-2">
                      {conflict.type}
                    </Badge>
                    {conflict.message}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">Loading your course data...</p>
          </div>
        ) : (
          <>
            {/* Graduation Summary */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Graduation Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Expected Graduation</h3>
                    <p className="text-2xl font-bold">{calculateExpectedGraduation()}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">Completed Courses</h3>
                    <p className="text-2xl font-bold">{courses.filter((c) => c.status === "passed").length}</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">Remaining Courses</h3>
                    <p className="text-2xl font-bold">{courses.filter((c) => c.status !== "passed").length}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Alert className="bg-gray-50 dark:bg-gray-800">
                    <Info className="h-4 w-4" />
                    <AlertTitle>How This Works</AlertTitle>
                    <AlertDescription>
                      This planner analyzes your completed courses and remaining requirements to create an optimized
                      path to graduation. It respects course prerequisites, prioritizes courses with available sections,
                      and distributes courses to balance your workload each semester. Internship courses are
                      automatically scheduled at the end of your plan, with Internship 1 followed by Internship 2 in
                      successive terms. You can personalize your plan by moving courses to different terms or removing
                      them entirely.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            {/* Notice for all pending courses */}
            {courses.filter((c) => c.status === "active").length === 0 &&
              courses.filter((c) => c.status === "pending").length > 0 && (
                <Alert
                  data-alert="course-status-notice"
                  className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                >
                  <Info className="h-4 w-4" />
                  <AlertTitle>Course Status Notice</AlertTitle>
                  <AlertDescription>
                    All your courses are marked as "pending". For a more personalized graduation plan, consider updating
                    your course statuses in the Course Tracker to mark completed courses as "passed" and current courses
                    as "active".
                    <br />
                    <br />
                    The current plan shows the default curriculum progression. You can still use all planning features
                    to customize your path.
                    <div className="mt-3">
                      <Link href="/course-tracker">
                        <Button size="sm" className="mr-2">
                          <BookOpen className="h-4 w-4 mr-1" />
                          Update Course Status
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const alert = document.querySelector('[data-alert="course-status-notice"]') as HTMLElement
                          if (alert) alert.style.display = "none"
                        }}
                      >
                        Continue with Default Plan
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

            {/* Current Term Settings */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Current Academic Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Starting Year</label>
                    <div className="flex items-center gap-2">
                      <select
                        className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                        value={startYear}
                        onChange={(e) => {
                          const year = Number.parseInt(e.target.value)
                          if (!isNaN(year)) {
                            setStartYear(year)
                            localStorage.setItem("startYear", year.toString())
                          }
                        }}
                      >
                        {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentYear = new Date().getFullYear()
                          setStartYear(currentYear)
                          localStorage.setItem("startYear", currentYear.toString())
                        }}
                      >
                        Current
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Year</label>
                    <select
                      className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                      value={currentYear}
                      onChange={(e) => setCurrentYear(Number.parseInt(e.target.value))}
                    >
                      {Array.from({ length: 5 }, (_, i) => startYear + i).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Term</label>
                    <select
                      className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                      value={currentTerm}
                      onChange={(e) => setCurrentTerm(e.target.value)}
                    >
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={generateGraduationPlan}>Regenerate Plan</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Move className="h-5 w-5" />
                  Plan Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {/* Export Plan */}
                  <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Export Graduation Plan</DialogTitle>
                        <DialogDescription>Choose a format to export your graduation plan.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-3 py-4">
                        <Button onClick={() => exportPlan("json")} className="justify-start">
                          Export as JSON
                        </Button>
                        <Button onClick={() => exportPlan("csv")} className="justify-start">
                          Export as CSV
                        </Button>
                        <Button onClick={() => exportPlan("txt")} className="justify-start">
                          Export as Text
                        </Button>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Import Plan */}
                  <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                        <Upload className="h-4 w-4" />
                        Import Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Graduation Plan</DialogTitle>
                        <DialogDescription>
                          Upload a previously exported graduation plan file (JSON, CSV, or TXT format).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,.csv,.txt"
                          onChange={handleFileImport}
                          className="mb-4"
                        />
                        {importError && (
                          <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{importError}</AlertDescription>
                          </Alert>
                        )}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p className="mb-2">Supported formats:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>
                              <strong>JSON:</strong> Complete plan data with all course information
                            </li>
                            <li>
                              <strong>CSV:</strong> Tabular format with course details per row
                            </li>
                            <li>
                              <strong>TXT:</strong> Human-readable text format
                            </li>
                          </ul>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setImportDialogOpen(false)
                            setImportError(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Course Swap */}
                  <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                        <ArrowUpDown className="h-4 w-4" />
                        Swap Courses
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Swap Two Courses</DialogTitle>
                        <DialogDescription>
                          Select two courses to swap their positions in your graduation plan.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">First Course</label>
                          <Select value={swapCourse1} onValueChange={setSwapCourse1}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select first course" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAllCoursesInPlan().map((course) => (
                                <SelectItem key={course.id} value={course.id}>
                                  {course.code} ({course.location})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Second Course</label>
                          <Select value={swapCourse2} onValueChange={setSwapCourse2}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select second course" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAllCoursesInPlan()
                                .filter((course) => course.id !== swapCourse1)
                                .map((course, idx) => (
                                  <SelectItem key={`${course.id}-swap-${idx}`} value={course.id}>
                                    {course.code} ({course.location})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSwap}
                          disabled={!swapCourse1 || !swapCourse2 || swapCourse1 === swapCourse2}
                        >
                          Swap Courses
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Overload Confirmation Dialog (for adding non-internships into reserved internship terms) */}
                  <Dialog open={overloadDialogOpen} onOpenChange={(open) => {
                    setOverloadDialogOpen(open)
                    if (!open) setPendingAdd(null)
                  }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Overload</DialogTitle>
                        <DialogDescription>
                          You're attempting to add a non-internship course into a term reserved for internships.
                          This is considered an overload and may affect your graduation timeline. Do you want to
                          continue?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-2">
                        <p className="text-sm text-gray-600">Selected:</p>
                        <p className="font-medium">
                          {pendingAdd ? `${findCourseById(pendingAdd.courseId)?.code} → ${formatAcademicYear(pendingAdd.targetYear)} ${pendingAdd.targetTerm}` : ""}
                        </p>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setOverloadDialogOpen(false); setPendingAdd(null) }}>
                          Cancel
                        </Button>
                        <Button onClick={() => {
                          if (pendingAdd) {
                            performAddCourseToTerm(pendingAdd.courseId, pendingAdd.targetYear, pendingAdd.targetTerm)
                          }
                          setOverloadDialogOpen(false)
                          setPendingAdd(null)
                        }}>
                          Confirm Add
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Undo Action */}
                  <Button
                    variant="outline"
                    onClick={undoLastMove}
                    disabled={moveHistory.length === 0}
                    className="flex items-center gap-2 bg-transparent"
                  >
                    <Undo className="h-4 w-4" />
                    Undo Last Move
                  </Button>

                  {/* Move History */}
                  <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                        <History className="h-4 w-4" />
                        Move History ({moveHistory.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Move History</DialogTitle>
                        <DialogDescription>Recent changes to your graduation plan.</DialogDescription>
                      </DialogHeader>
                      <div className="max-h-96 overflow-y-auto py-4">
                        {moveHistory.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No moves recorded yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {moveHistory.map((entry) => (
                              <div key={entry.id} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">{entry.type}</Badge>
                                  <span className="text-xs text-gray-500">{entry.timestamp.toLocaleString()}</span>
                                </div>
                                <p className="text-sm font-medium">{entry.description}</p>
                                <div className="mt-2 space-y-1">
                                  {entry.changes.map((change, index) => {
                                    const course = findCourseById(change.courseId)
                                    return (
                                      <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                        {course?.code}: {change.fromYear} {change.fromTerm} → {change.toYear}{" "}
                                        {change.toTerm}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Unscheduled Courses - moved here for better visibility */}
            {getUnscheduledCourses().length > 0 && (
              <div ref={setUnscheduledCoursesRef} className="mb-6">
                <h2 className="text-2xl font-bold mb-4">Unscheduled Courses</h2>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Courses Not Yet Scheduled
                    </CardTitle>
                    <CardDescription>
                      These courses are marked as pending or active but are not currently placed in any semester of your
                      graduation plan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course Code</TableHead>
                          <TableHead>Course Name</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Prerequisites Met</TableHead>
                          <TableHead>Available Sections</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getUnscheduledCourses().map((course, _idx) => {
                          const allPrereqsMet = arePrerequisitesMet(course)
                          const availableTerms = getAvailableTermsForMove(course)

                          return (
                            <TableRow key={`${course.id}-unscheduled`}>
                              <TableCell className="font-medium">{course.code}</TableCell>
                              <TableCell>{course.name}</TableCell>
                              <TableCell>{course.credits}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={course.status === "active" ? "default" : "secondary"}
                                  className={
                                    course.status === "active"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                      : ""
                                  }
                                >
                                  {course.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={allPrereqsMet ? "default" : "destructive"}
                                  className={
                                    allPrereqsMet
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      : ""
                                  }
                                >
                                  {allPrereqsMet ? "Yes" : "No"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {course.needsPetition ? (
                                  <Badge variant="destructive">Needs Petition</Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  >
                                    {course.availableSections.length} sections
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Select
                                  onValueChange={(value) => {
                                    const [year, term] = value.split("-")
                                    addCourseToTerm(course.id, Number.parseInt(year), term)
                                  }}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Add to term..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTerms.map((term) => (
                                      <SelectItem key={`${term.year}-${term.term}`} value={`${term.year}-${term.term}`}>
                                        <div className="flex items-center gap-2">
                                          <Plus className="h-3 w-3" />
                                          {term.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>

                    {getUnscheduledCourses().some((course) => !arePrerequisitesMet(course)) && (
                      <Alert className="mt-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Prerequisites Not Met</AlertTitle>
                        <AlertDescription>
                          Some unscheduled courses have prerequisites that are not yet completed. Make sure to complete
                          the prerequisites before scheduling these courses.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Graduation Plan */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Your Graduation Plan</h2>

              {graduationPlan.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No Pending Courses</AlertTitle>
                  <AlertDescription>
                    You don't have any pending courses to plan. If you've completed all your courses, congratulations!
                    Otherwise, go to the Course Tracker to update your course statuses.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {graduationPlan.map((semester, index) => {
                    const semesterKey = `${semester.year}-${semester.term}`
                    const isOpen = openSemesters[semesterKey]
                    const coursesNeedingPetition = semester.courses.filter((course) => course.needsPetition)
                    const semesterCoursesSelected = semester.courses.filter((course) => selectedCourses.has(course.id))
                    const allSemesterCoursesSelected = semesterCoursesSelected.length === semester.courses.length
                    const semesterCredits = semester.courses.reduce((sum, course) => sum + course.credits, 0)
                    const hasConflicts = conflicts.some((conflict) =>
                      conflict.affectedCourses.some((courseId) =>
                        semester.courses.some((course) => course.id === courseId),
                      ),
                    )
                    const hasInternship = semester.courses.some((course) => isInternshipCourse(course))

                    return (
                      <Collapsible
                        key={semesterKey}
                        open={isOpen}
                        onOpenChange={() => toggleSemester(semester.year, semester.term)}
                        className="border rounded-lg overflow-hidden"
                      >
                        <CollapsibleTrigger className="w-full p-4 flex justify-between items-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {formatAcademicYear(semester.year)} - {semester.term}
                            </h3>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {semester.courses.length} courses
                            </Badge>
                            <Badge
                              className={`${
                                semesterCredits > 21
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              }`}
                            >
                              {semesterCredits} credits
                            </Badge>
                            {hasInternship && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                Internship Term
                              </Badge>
                            )}
                            {coursesNeedingPetition.length > 0 && (
                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                {coursesNeedingPetition.length} need petition
                              </Badge>
                            )}
                            {semesterCoursesSelected.length > 0 && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                {semesterCoursesSelected.length} selected
                              </Badge>
                            )}
                            {hasConflicts && (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Conflicts
                              </Badge>
                            )}
                          </div>
                          <div className="text-gray-500">{isOpen ? "Hide" : "Show"} Courses</div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 bg-gray-50 dark:bg-gray-900">
                            <div className="flex items-center gap-2 mb-4">
                              <Checkbox
                                checked={allSemesterCoursesSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    selectAllCoursesInSemester(semester.courses)
                                  } else {
                                    deselectAllCoursesInSemester(semester.courses)
                                  }
                                }}
                              />
                              <label className="text-sm font-medium">
                                {allSemesterCoursesSelected ? "Deselect All" : "Select All"} in this semester
                              </label>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">Select</TableHead>
                                  <TableHead>Course Code</TableHead>
                                  <TableHead>Course Name</TableHead>
                                  <TableHead>Credits</TableHead>
                                  <TableHead>Section</TableHead>
                                  <TableHead>Schedule</TableHead>
                                  <TableHead>Room</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {semester.courses.map((course, _idx) => {
                                  const prereqCourses = course.prerequisites
                                    .map((id) => findCourseById(id))
                                    .filter((c): c is Course => c !== undefined)

                                  const allPrereqsMet = arePrerequisitesMet(course)
                                  const section = course.recommendedSection
                                  const availableSections = course.availableSections
                                  const availableTerms = getAvailableTermsForMove(course)
                                  const isSelected = selectedCourses.has(course.id)
                                  const hasConflict = conflicts.some((conflict) =>
                                    conflict.affectedCourses.includes(course.id),
                                  )
                                  const courseIsInternship = isInternshipCourse(course)

                                  return (
                                    <TableRow
                                      key={`${semesterKey}-${course.id}`}
                                      className={`${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""} ${
                                        hasConflict ? "border-l-4 border-red-500" : ""
                                      } ${courseIsInternship ? "bg-purple-50 dark:bg-purple-900/10" : ""}`}
                                    >
                                      <TableCell>
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => toggleCourseSelection(course.id)}
                                        />
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          {course.code}
                                          {courseIsInternship && (
                                            <Badge variant="outline" className="text-xs">
                                              Internship
                                            </Badge>
                                          )}
                                          {hasConflict && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeCourseFromPlan(course.id)}
                                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            title="Remove from plan"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                      <TableCell>{course.name}</TableCell>
                                      <TableCell>{course.credits}</TableCell>
                                      <TableCell>
                                        {availableSections.length > 0 ? (
                                          <Select
                                            value={section?.section || ""}
                                            onValueChange={(value) => {
                                              const selectedSection = availableSections.find((s) => s.section === value)
                                              if (selectedSection) {
                                                changeCourseSection(course.id, selectedSection)
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="w-32">
                                              <SelectValue placeholder="Select Section" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {availableSections.map((availableSection) => (
                                                <SelectItem
                                                  key={availableSection.section}
                                                  value={availableSection.section}
                                                >
                                                  {availableSection.section}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : section ? (
                                          section.section
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              localStorage.setItem("filterCourseCode", course.code)
                                              window.location.href = "/schedule-maker"
                                            }}
                                            className="flex items-center gap-1"
                                          >
                                            <Calendar className="h-3 w-3" />
                                            Find Section
                                          </Button>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {section ? (
                                          <div className="text-sm whitespace-pre-line">
                                            {formatSchedule(section.meetingDays, section.meetingTime)}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400">TBD</span>
                                        )}
                                      </TableCell>
                                      <TableCell>{section ? section.room : "N/A"}</TableCell>
                                      <TableCell>
                                        {course.needsPetition ? (
                                          <Badge variant="destructive">Needs Petition</Badge>
                                        ) : !allPrereqsMet ? (
                                          <Badge
                                            variant="outline"
                                            className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                          >
                                            Prerequisites Not Met
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                          >
                                            Available
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Select
                                            onValueChange={(value) => {
                                              const [year, term] = value.split("-")
                                              moveCourseToTerm(course.id, Number.parseInt(year), term)
                                            }}
                                          >
                                            <SelectTrigger className="w-40">
                                              <SelectValue placeholder="Move to..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {availableTerms
                                                .filter(
                                                  (term) =>
                                                    !(term.year === semester.year && term.term === semester.term),
                                                )
                                                .map((term) => (
                                                  <SelectItem
                                                    key={`${term.year}-${term.term}`}
                                                    value={`${term.year}-${term.term}`}
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <ArrowRight className="h-3 w-3" />
                                                      {term.label}
                                                    </div>
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>

                            {semester.courses.some((course) => course.needsPetition) && (
                              <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                                <FileWarning className="h-4 w-4" />
                                <AlertTitle>Petition Required</AlertTitle>
                                <AlertDescription>
                                  Some courses in this semester require a petition as they don't have available
                                  sections. You may need to check with the department for special arrangements.
                                </AlertDescription>
                              </Alert>
                            )}

                            {semester.courses.some(
                              (course) => !arePrerequisitesMet(course) && !course.needsPetition,
                            ) && (
                              <Alert className="mt-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Prerequisites Not Met</AlertTitle>
                                <AlertDescription>
                                  Some courses in this semester have prerequisites that are not yet completed. Make sure
                                  to complete the prerequisites before taking these courses.
                                </AlertDescription>
                              </Alert>
                            )}

                            {hasInternship && semester.courses.length > 1 && (
                              <Alert className="mt-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Internship Term Notice</AlertTitle>
                                <AlertDescription>
                                  This semester contains internship courses. Typically, internship courses should be
                                  taken alone in a term. You can manually move other courses to different terms if
                                  needed.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Floating Unscheduled Courses Card */}
            {showFloatingUnscheduled && (
              <div className="fixed bottom-6 right-6 z-50 animate-in fade-in-0 slide-in-from-bottom-2">
                <Card className="w-80 shadow-lg border-2 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Unscheduled Courses ({getUnscheduledCourses().length})
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          unscheduledCoursesRef?.scrollIntoView({ behavior: "smooth" })
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {getUnscheduledCourses()
                        .slice(0, 3)
                        .map((course) => (
                          <div key={course.id} className="flex items-center justify-between text-xs">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{course.code}</div>
                              <div className="text-gray-500 truncate">{course.name}</div>
                            </div>
                            <Badge
                              variant={course.status === "active" ? "default" : "secondary"}
                              className="ml-2 text-xs"
                            >
                              {course.status}
                            </Badge>
                          </div>
                        ))}
                      {getUnscheduledCourses().length > 3 && (
                        <div className="text-xs text-gray-500 text-center pt-1">
                          +{getUnscheduledCourses().length - 3} more courses
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => {
                        unscheduledCoursesRef?.scrollIntoView({ behavior: "smooth" })
                      }}
                    >
                      View All Unscheduled
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Bottom Navigation */}
            <div className="mt-10 mb-6">
              <QuickNavigation />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
