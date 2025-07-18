"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { initialCourses } from "@/lib/course-data"
import { loadCourseStatuses } from "@/lib/course-storage"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

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

export default function AcademicPlanner() {
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [availableSections, setAvailableSections] = useState<CourseSection[]>([])
  const [graduationPlan, setGraduationPlan] = useState<SemesterPlan[]>([])
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [currentTerm, setCurrentTerm] = useState<string>("Term 1")
  const [loading, setLoading] = useState(true)
  const [openSemesters, setOpenSemesters] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<string | null>(null)

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

  // Find a course by its ID
  const findCourseById = (id: string): Course | undefined => {
    return courses.find((course) => course.id === id)
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

  // Generate a graduation plan for the student
  const generateGraduationPlan = () => {
    // Get all pending and active courses
    const pendingCourses = courses.filter((course) => course.status === "pending")
    const activeCourses = courses.filter((course) => course.status === "active")

    // If we have no courses to plan, return early
    if (pendingCourses.length === 0 && activeCourses.length === 0) {
      setGraduationPlan([])
      return
    }

    // Create a dependency graph
    const dependencyGraph = new Map<string, string[]>()
    pendingCourses.concat(activeCourses).forEach((course) => {
      dependencyGraph.set(course.id, course.prerequisites)
    })

    // Perform topological sort to respect prerequisites
    const sortedPendingCourses = topologicalSort(pendingCourses, dependencyGraph)
    const sortedActiveCourses = topologicalSort(activeCourses, dependencyGraph)

    // Enhance courses with section availability info
    const enhancedActiveCourses: PlanCourse[] = sortedActiveCourses.map((course) => {
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

    const enhancedPendingCourses: PlanCourse[] = sortedPendingCourses.map((course) => {
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

    // Group courses into semesters with prerequisite gap enforcement
    const plan: SemesterPlan[] = []
    let currentPlanYear = currentYear
    let currentPlanTerm = currentTerm
    let currentSemesterCourses: PlanCourse[] = []
    let currentSemesterCredits = 0
    const MAX_CREDITS_PER_SEMESTER = 21

    // Track when each course was scheduled (for prerequisite gap enforcement)
    const courseScheduleMap = new Map<string, { year: number; term: string }>()

    // Helper to get the next term
    const getNextTerm = (year: number, term: string): { year: number; term: string } => {
      if (term === "Term 1") return { year, term: "Term 2" }
      if (term === "Term 2") return { year, term: "Term 3" }
      return { year: year + 1, term: "Term 1" }
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

    // Helper to check if a course can be scheduled in a given term
    const canScheduleInTerm = (course: PlanCourse, year: number, term: string): boolean => {
      // Check if all prerequisites have been scheduled at least one term before
      return course.prerequisites.every((prereqId) => {
        const prereqSchedule = courseScheduleMap.get(prereqId)
        if (!prereqSchedule) return false // Prerequisite not scheduled yet

        return isAtLeastOneTermAfter(year, term, prereqSchedule.year, prereqSchedule.term)
      })
    }

    // First, prioritize active courses
    const prioritizedActiveCourses = [...enhancedActiveCourses].sort((a, b) => {
      // First priority: courses with available sections
      if (!a.needsPetition && b.needsPetition) return -1
      if (a.needsPetition && !b.needsPetition) return 1

      // Second priority: courses in the current term
      const aInTerm = a.term === currentPlanTerm
      const bInTerm = b.term === currentPlanTerm
      if (aInTerm && !bInTerm) return -1
      if (!aInTerm && bInTerm) return 1

      // Third priority: courses with more available sections
      return b.availableSections.length - a.availableSections.length
    })

    // Then, prioritize pending courses that can be taken (prerequisites are met)
    const prioritizedPendingCourses = [...enhancedPendingCourses].sort((a, b) => {
      // First priority: courses with prerequisites met
      const aPrereqsMet = arePrerequisitesMet(a)
      const bPrereqsMet = arePrerequisitesMet(b)
      if (aPrereqsMet && !bPrereqsMet) return -1
      if (!aPrereqsMet && bPrereqsMet) return 1

      // Second priority: courses with available sections
      if (!a.needsPetition && b.needsPetition) return -1
      if (a.needsPetition && !b.needsPetition) return 1

      // Third priority: courses in the current term
      const aInTerm = a.term === currentPlanTerm
      const bInTerm = b.term === currentPlanTerm
      if (aInTerm && !bInTerm) return -1
      if (!aInTerm && bInTerm) return 1

      // Fourth priority: courses with more available sections
      return b.availableSections.length - a.availableSections.length
    })

    // Combine active and pending courses, with active courses first
    const prioritizedCourses = [...prioritizedActiveCourses, ...prioritizedPendingCourses]

    // Distribute courses into semesters with prerequisite gap enforcement
    const remainingCourses = [...prioritizedCourses]
    const maxIterations = 50 // Prevent infinite loops
    let iteration = 0

    while (remainingCourses.length > 0 && iteration < maxIterations) {
      iteration++
      let coursesScheduledThisIteration = 0

      for (let i = remainingCourses.length - 1; i >= 0; i--) {
        const course = remainingCourses[i]

        // Check if this course can be scheduled in the current term
        if (!canScheduleInTerm(course, currentPlanYear, currentPlanTerm)) {
          continue // Skip this course for now
        }

        // If adding this course would exceed the credit limit, start a new semester
        if (currentSemesterCredits + course.credits > MAX_CREDITS_PER_SEMESTER) {
          if (currentSemesterCourses.length > 0) {
            plan.push({
              year: currentPlanYear,
              term: currentPlanTerm,
              courses: [...currentSemesterCourses],
            })
          }

          // Move to next term
          const next = getNextTerm(currentPlanYear, currentPlanTerm)
          currentPlanYear = next.year
          currentPlanTerm = next.term
          currentSemesterCourses = []
          currentSemesterCredits = 0

          // Check again if the course can be scheduled in the new term
          if (!canScheduleInTerm(course, currentPlanYear, currentPlanTerm)) {
            continue
          }
        }

        // Add course to current semester
        currentSemesterCourses.push(course)
        currentSemesterCredits += course.credits
        courseScheduleMap.set(course.id, { year: currentPlanYear, term: currentPlanTerm })

        // Remove from remaining courses
        remainingCourses.splice(i, 1)
        coursesScheduledThisIteration++
      }

      // If no courses were scheduled in this iteration, move to next term
      if (coursesScheduledThisIteration === 0 && remainingCourses.length > 0) {
        if (currentSemesterCourses.length > 0) {
          plan.push({
            year: currentPlanYear,
            term: currentPlanTerm,
            courses: [...currentSemesterCourses],
          })
        }

        // Move to next term
        const next = getNextTerm(currentPlanYear, currentPlanTerm)
        currentPlanYear = next.year
        currentPlanTerm = next.term
        currentSemesterCourses = []
        currentSemesterCredits = 0
      }
    }

    // Add the last semester if it has courses
    if (currentSemesterCourses.length > 0) {
      plan.push({
        year: currentPlanYear,
        term: currentPlanTerm,
        courses: currentSemesterCourses,
      })
    }

    // Initialize all semesters as closed
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
    return `${lastSemester.year} ${lastSemester.term}`
  }

  // Calculate total remaining credits
  const calculateRemainingCredits = (): number => {
    return courses.filter((course) => course.status === "pending").reduce((sum, course) => sum + course.credits, 0)
  }

  // Open the student portal course offerings page
  const openStudentPortal = () => {
    window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Link href="/course-tracker">
              <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                <BookOpen className="h-4 w-4" />
                Back to Course Tracker
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
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
                      and distributes courses to balance your workload each semester.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

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
                              {semester.year} - {semester.term}
                            </h3>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {semester.courses.length} courses
                            </Badge>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {semester.courses.reduce((sum, course) => sum + course.credits, 0)} credits
                            </Badge>
                            {coursesNeedingPetition.length > 0 && (
                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                {coursesNeedingPetition.length} need petition
                              </Badge>
                            )}
                          </div>
                          <div className="text-gray-500">{isOpen ? "Hide" : "Show"} Courses</div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 bg-gray-50 dark:bg-gray-900">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Course Code</TableHead>
                                  <TableHead>Course Name</TableHead>
                                  <TableHead>Credits</TableHead>
                                  <TableHead>Section</TableHead>
                                  <TableHead>Schedule</TableHead>
                                  <TableHead>Room</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {semester.courses.map((course) => {
                                  const prereqCourses = course.prerequisites
                                    .map((id) => findCourseById(id))
                                    .filter((c): c is Course => c !== undefined)

                                  const allPrereqsMet = arePrerequisitesMet(course)
                                  const section = course.recommendedSection
                                  const availableSections = course.availableSections

                                  return (
                                    <TableRow key={course.id}>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          {course.code}
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
                                          <select
                                            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700"
                                            value={section?.section || ""}
                                            onChange={(e) => {
                                              const selectedSection = availableSections.find(
                                                (s) => s.section === e.target.value,
                                              )
                                              if (selectedSection) {
                                                changeCourseSection(course.id, selectedSection)
                                              }
                                            }}
                                          >
                                            <option value="">Select Section</option>
                                            {availableSections.map((availableSection) => (
                                              <option key={availableSection.section} value={availableSection.section}>
                                                {availableSection.section} ({availableSection.remainingSlots} slots)
                                              </option>
                                            ))}
                                          </select>
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
                                          <div>
                                            <div>
                                              {parseDays(section.meetingDays)
                                                .map((day) => getFullDayName(day))
                                                .join(", ")}
                                            </div>
                                            <div className="text-xs text-gray-500">{section.meetingTime}</div>
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
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
