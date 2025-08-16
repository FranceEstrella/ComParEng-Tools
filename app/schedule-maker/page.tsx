"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash,
  AlertCircle,
  BookOpen,
  FileWarning,
  ExternalLink,
  Check,
  Calendar,
  Download,
  Palette,
  Edit,
  GraduationCap,
} from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { initialCourses, curriculumCodes } from "@/lib/course-data"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { HexColorPicker } from "react-colorful"
import React from "react"
import { createEvents } from "ics"
import html2canvas from "html2canvas"

// Time slot constants
const DAYS = ["M", "Tu", "W", "Th", "F", "S"] as const
type DayToken = (typeof DAYS)[number]

const TIME_SLOTS = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
]

// Helper to calculate time slot position
const getTimePosition = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return (hours - 7) * 2 + minutes / 30
}

// Calculate duration in 30-min slots
const getDurationSlots = (start: string, end: string) => {
  return getTimePosition(end) - getTimePosition(start)
}

// Course details map for quick lookup
const courseDetailsMap = initialCourses.reduce((map, course) => {
  map[course.code] = course
  return map
}, {})

// Interface for course data
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

interface ActiveCourse {
  id: string
  code: string
  name: string
  credits: number
  status: string
}

interface SelectedCourse extends CourseSection {
  name: string
  credits: number
  timeStart: string
  timeEnd: string
  parsedDays: DayToken[]
  displayTime: string
  displayRoom: string
}

interface CourseCustomization {
  customTitle?: string
  color?: string
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

// Sample data for available courses - used as fallback
const sampleAvailableCourses = [
  {
    courseCode: "COE0001",
    section: "A",
    classSize: "40",
    remainingSlots: "15",
    meetingDays: "MW",
    meetingTime: "10:00:00-11:30:00",
    room: "Room 301",
    hasSlots: true,
  },
  {
    courseCode: "COE0003",
    section: "B",
    classSize: "35",
    remainingSlots: "5",
    meetingDays: "TuTh",
    meetingTime: "13:00:00-14:30:00",
    room: "Room 201",
    hasSlots: true,
  },
  {
    courseCode: "GED0001",
    section: "C",
    classSize: "45",
    remainingSlots: "0",
    meetingDays: "F",
    meetingTime: "08:00:00-11:00:00",
    room: "Room 101",
    hasSlots: false,
  },
  {
    courseCode: "COE0005",
    section: "A",
    classSize: "30",
    remainingSlots: "10",
    meetingDays: "MW",
    meetingTime: "13:00:00-14:30:00",
    room: "Room 302",
    hasSlots: true,
  },
  {
    courseCode: "GED0004",
    section: "B",
    classSize: "35",
    remainingSlots: "8",
    meetingDays: "TuTh",
    meetingTime: "08:00:00-09:30:00",
    room: "Room 202",
    hasSlots: true,
  },
  {
    courseCode: "ONLINE001",
    section: "D",
    classSize: "50",
    remainingSlots: "25",
    meetingDays: "MW",
    meetingTime: "14:00:00-15:30:00",
    room: "Online / Online",
    hasSlots: true,
  },
  {
    courseCode: "LAB001",
    section: "E",
    classSize: "20",
    remainingSlots: "3",
    meetingDays: "TuTh",
    meetingTime: "15:00:00-16:30:00",
    room: "F406 / F406",
    hasSlots: true,
  },
]

// Extract department codes from course codes
const extractDepartmentCode = (courseCode: string): string => {
  const match = courseCode.match(/^[A-Z]+/)
  return match ? match[0] : "OTHER"
}

// Updated day mapping
const dayAbbreviationToDay = {
  M: 1, // Monday
  Tu: 2, // Tuesday
  W: 3, // Wednesday
  Th: 4, // Thursday
  F: 5, // Friday
  S: 6, // Saturday
}

// New robust day parser
function parseDays(daysString: string): DayToken[] {
  const tokens: DayToken[] = []
  let i = 0
  const s = daysString.toUpperCase().replace(/\s+/g, "")

  while (i < s.length) {
    if (s[i] === "M") {
      tokens.push("M")
      i++
    } else if (s[i] === "W") {
      tokens.push("W")
      i++
    } else if (s[i] === "F") {
      tokens.push("F")
      i++
    } else if (s[i] === "S") {
      tokens.push("S")
      i++
    } else if (s[i] === "T") {
      // Check for Thursday
      if (i + 1 < s.length && s[i + 1] === "H") {
        tokens.push("Th")
        i += 2
      }
      // Otherwise it's Tuesday
      else {
        tokens.push("Tu")
        i++
      }
    } else {
      // Skip invalid characters but warn
      console.warn(`Invalid day character: ${s[i]} in "${daysString}"`)
      i++
    }
  }

  return tokens
}

// Day string validator
function validateDayString(days: string): boolean {
  const validPattern = /^([MTWFS]|TU|TH)+$/i
  return validPattern.test(days.replace(/\s+/g, ""))
}

// Helper function to determine text color based on background color
const getContrastColor = (hexColor: string): string => {
  // Convert hex to RGB
  const r = Number.parseInt(hexColor.substr(1, 2), 16)
  const g = Number.parseInt(hexColor.substr(3, 2), 16)
  const b = Number.parseInt(hexColor.substr(5, 2), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black or white depending on luminance
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export default function ScheduleMaker() {
  const [availableCourses, setAvailableCourses] = useState<CourseSection[]>([])
  const [activeCourses, setActiveCourses] = useState<ActiveCourse[]>([])
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([])
  const [customizations, setCustomizations] = useState<Record<string, CourseCustomization>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "table">("card")
  const [selectedViewMode, setSelectedViewMode] = useState<"card" | "table">("card")
  const scheduleRef = useRef<HTMLDivElement>(null)
  const [showOnlyActive, setShowOnlyActive] = useState(true)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("department")
  const [sortOrder, setSortOrder] = useState("asc")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [isClient, setIsClient] = useState(false)
  const [editingCourse, setEditingCourse] = useState<SelectedCourse | null>(null)
  const [tempCustomTitle, setTempCustomTitle] = useState("")
  const [tempCustomColor, setTempCustomColor] = useState("#3b82f6")
  const [scheduleTitle, setScheduleTitle] = useState(
    typeof window !== "undefined" ? localStorage.getItem("scheduleTitle") || "Weekly Schedule" : "Weekly Schedule",
  )

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load data from localStorage only on the client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedSchedule = localStorage.getItem("scheduleMakerData")
        if (savedSchedule) {
          const parsed = JSON.parse(savedSchedule)
          if (parsed.selectedCourses) {
            setSelectedCourses(parsed.selectedCourses)
          }
          if (parsed.customizations) {
            setCustomizations(parsed.customizations || {})
          }
        }

        const filterCourseCode = localStorage.getItem("filterCourseCode")
        if (filterCourseCode) {
          setSearchTerm(filterCourseCode)
          localStorage.removeItem("filterCourseCode")
        }
      } catch (err) {
        console.error("Error loading schedule from localStorage:", err)
      }
    }
  }, [])

  // Save to localStorage whenever selectedCourses or customizations change
  useEffect(() => {
    if (typeof window !== "undefined" && isClient) {
      try {
        localStorage.setItem(
          "scheduleMakerData",
          JSON.stringify({
            version: 1,
            selectedCourses,
            customizations,
          }),
        )
      } catch (err) {
        console.error("Error saving to localStorage:", err)
      }
    }
  }, [selectedCourses, customizations, isClient])

  // Convert 24-hour time to 12-hour format
  const convertTo12Hour = (time24: string): string => {
    if (!time24) return "TBD"

    // Handle time ranges (e.g., "13:00-14:30")
    if (time24.includes("-")) {
      const [start, end] = time24.split("-")
      return `${convertTo12Hour(start)} - ${convertTo12Hour(end)}`
    }

    // Handle multiple time slots (e.g., "13:00 / 15:00")
    if (time24.includes(" / ")) {
      return time24
        .split(" / ")
        .map((t) => convertTo12Hour(t))
        .join(" / ")
    }

    // Convert single time
    const [hours, minutes] = time24.split(":")
    const hourNum = Number.parseInt(hours, 10)

    if (hourNum === 0) {
      return `12:${minutes} AM`
    } else if (hourNum < 12) {
      return `${hourNum}:${minutes} AM`
    } else if (hourNum === 12) {
      return `12:${minutes} PM`
    } else {
      return `${hourNum - 12}:${minutes} PM`
    }
  }

  // Clean and normalize room string
  const cleanRoomString = (roomString: string): string => {
    if (!roomString) return "TBD"

    // Split by possible delimiters
    const rooms = roomString.split(/ \/ |\/|\/\/|, /)

    // If all rooms are the same after trimming, return just one
    const uniqueRooms = [...new Set(rooms.map((room) => room.trim()))]
    if (uniqueRooms.length === 1) {
      return uniqueRooms[0]
    }

    // Otherwise return the original string
    return roomString
  }

  // Clean and normalize time string
  const cleanTimeString = (timeString: string): string => {
    if (!timeString) return "TBD"

    const times = timeString.split(" / ")

    // If all times are the same, just convert one to 12-hour format
    if (times.every((time) => time === times[0])) {
      const [start, end] = times[0].split("-")
      return `${convertTo12Hour(start)} - ${convertTo12Hour(end)}`
    }

    // Otherwise convert each time range individually
    return times
      .map((time) => {
        const [start, end] = time.split("-")
        return `${convertTo12Hour(start)} - ${convertTo12Hour(end)}`
      })
      .join(" / ")
  }

  // Parse time string (e.g., "10:00:00-11:30:00") into start and end times
  const parseTimeRange = (timeString: string): { start: string; end: string } => {
    const [start, end] = timeString.split("-")
    return {
      start: start.substring(0, 5),
      end: end.substring(0, 5),
    }
  }

  // Get full day name
  const getFullDayName = (day: DayToken): string => {
    switch (day) {
      case "M":
        return "Monday"
      case "Tu":
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

  // Enhanced conflict detection
  const hasScheduleConflict = (course: CourseSection): boolean => {
    if (!course.meetingTime || !course.meetingDays) return false

    const { start: newStart, end: newEnd } = parseTimeRange(course.meetingTime)
    const newDays = parseDays(course.meetingDays)

    return selectedCourses.some((selected) => {
      if (selected.courseCode === course.courseCode) return false

      // Convert both day sets to Sets for efficient lookup
      const selectedDaysSet = new Set(selected.parsedDays)
      const newDaysSet = new Set(newDays)

      // Check if any days overlap
      const daysOverlap = [...newDaysSet].some((day) => selectedDaysSet.has(day))
      if (!daysOverlap) return false

      // Only check time overlap if days overlap
      return (
        (newStart >= selected.timeStart && newStart < selected.timeEnd) ||
        (newEnd > selected.timeStart && newEnd <= selected.timeEnd) ||
        (newStart <= selected.timeStart && newEnd >= selected.timeEnd)
      )
    })
  }

  // Check if a course with the same code is already selected
  const hasSameCourseCode = (course: CourseSection): boolean => {
    return selectedCourses.some((selected) => selected.courseCode === course.courseCode)
  }

  // Get the selected course with the same code
  const getSelectedCourseWithSameCode = (course: CourseSection): SelectedCourse | undefined => {
    return selectedCourses.find((selected) => selected.courseCode === course.courseCode)
  }

  const sortCourses = (courses: CourseSection[]) => {
    return [...courses].sort((a, b) => {
      let valueA, valueB

      if (sortBy === "courseCode") {
        valueA = a.courseCode
        valueB = b.courseCode
      } else if (sortBy === "department") {
        valueA = extractDepartmentCode(a.courseCode)
        valueB = extractDepartmentCode(b.courseCode)

        if (valueA === valueB) {
          valueA = a.courseCode
          valueB = b.courseCode
        }
      } else if (sortBy === "remainingSlots") {
        valueA = Number.parseInt(a.remainingSlots)
        valueB = Number.parseInt(b.remainingSlots)
      } else if (sortBy === "meetingDays") {
        valueA = a.meetingDays
        valueB = b.meetingDays
      } else {
        valueA = a[sortBy]
        valueB = b[sortBy]
      }

      if (sortOrder === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })
  }

  // Add a course to the selected courses
  const addCourse = (course: CourseSection) => {
    const existingCourse = selectedCourses.find((selected) => selected.courseCode === course.courseCode)

    const { start, end } = parseTimeRange(course.meetingTime)
    const parsedDays = parseDays(course.meetingDays)

    const newCourse = {
      ...course,
      name: courseDetailsMap[course.courseCode]?.name || "Unknown Course",
      credits: courseDetailsMap[course.courseCode]?.credits || 3,
      timeStart: start,
      timeEnd: end,
      parsedDays,
      displayTime: cleanTimeString(course.meetingTime),
      displayRoom: cleanRoomString(course.room),
    }

    if (existingCourse) {
      setSelectedCourses((prev) =>
        prev.map((selected) => (selected.courseCode === course.courseCode ? newCourse : selected)),
      )
    } else {
      setSelectedCourses((prev) => [...prev, newCourse])
    }
  }

  // Remove a course from selected courses
  const removeCourse = (courseCode: string, section: string) => {
    setSelectedCourses((prev) =>
      prev.filter((course) => !(course.courseCode === courseCode && course.section === section)),
    )

    const key = `${courseCode}-${section}`
    setCustomizations((prev) => {
      const newCustomizations = { ...prev }
      delete newCustomizations[key]
      return newCustomizations
    })
  }

  // New ICS file generator
  const downloadICSFile = () => {
    if (selectedCourses.length === 0) return

    const events = selectedCourses.map((course) => {
      const startDateObj = new Date(startDate)
      const dayNumbers = course.parsedDays.map((day) => {
        switch (day) {
          case "M":
            return "MO"
          case "Tu":
            return "TU"
          case "W":
            return "WE"
          case "Th":
            return "TH"
          case "F":
            return "FR"
          case "S":
            return "SA"
          default:
            return "MO"
        }
      })

      const [startHour, startMinute] = course.timeStart.split(":").map(Number)
      const [endHour, endMinute] = course.timeEnd.split(":").map(Number)

      const event = {
        title:
          customizations[`${course.courseCode}-${course.section}`]?.customTitle ||
          `${course.courseCode} - ${course.name}`,
        description: `Section: ${course.section}\nRoom: ${course.displayRoom}`,
        location: course.displayRoom,
        start: [
          startDateObj.getFullYear(),
          startDateObj.getMonth() + 1,
          startDateObj.getDate(),
          startHour,
          startMinute,
        ] as [number, number, number, number, number],
        end: [startDateObj.getFullYear(), startDateObj.getMonth() + 1, startDateObj.getDate(), endHour, endMinute] as [
          number,
          number,
          number,
          number,
          number,
        ],
        recurrenceRule: `FREQ=WEEKLY;BYDAY=${dayNumbers.join(",")};COUNT=15`, // ~15 week semester
        alarms: [
          {
            action: "display",
            description: "Reminder",
            trigger: { hours: 1, minutes: 0, before: true },
          },
        ],
      }

      return event
    })

    createEvents(events, (error, value) => {
      if (error) {
        console.error("Error generating ICS file:", error)
        return
      }

      const blob = new Blob([value], { type: "text/calendar" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "my-schedule.ics"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  // Group courses by department
  const groupCoursesByDepartment = (courses: CourseSection[]) => {
    const grouped = courses.reduce(
      (acc, course) => {
        const dept = extractDepartmentCode(course.courseCode)
        if (!acc[dept]) acc[dept] = []
        acc[dept].push(course)
        return acc
      },
      {} as Record<string, CourseSection[]>,
    )

    return Object.entries(grouped)
      .sort(([deptA], [deptB]) => deptA.localeCompare(deptB))
      .map(([dept, courses]) => ({
        department: dept,
        courses: sortCourses(courses),
      }))
  }

  const getFilteredAndSortedCourses = () => {
    const filtered = filteredCourses.filter((course) => {
      const matchesSearch =
        searchTerm === "" ||
        course.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (courseDetailsMap[course.courseCode]?.name || "").toLowerCase().includes(searchTerm.toLowerCase())

      const matchesDepartment =
        selectedDepartment === "all" || extractDepartmentCode(course.courseCode) === selectedDepartment

      return matchesSearch && matchesDepartment
    })

    return sortCourses(filtered)
  }

  // Open the student portal course offerings page
  const openStudentPortal = () => {
    window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")
  }

  // Check if a time slot falls within a course's time range
  const isTimeInRange = (timeSlot: string, course: SelectedCourse): boolean => {
    const [slotHour, slotMinute] = timeSlot.split(":").map(Number)
    const [startHour, startMinute] = course.timeStart.split(":").map(Number)
    const [endHour, endMinute] = course.timeEnd.split(":").map(Number)

    const slotTime = slotHour * 60 + slotMinute
    const startTime = startHour * 60 + startMinute
    const endTime = endHour * 60 + endMinute

    return slotTime >= startTime && slotTime < endTime
  }

  // Fetch available courses from the API
  const fetchAvailableCourses = async () => {
    try {
      const response = await fetch("/api/get-available-courses", {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API returned status: ${response.status}. Details: ${errorText}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`API did not return JSON. Content-Type: ${contentType || "undefined"}`)
      }

      const result = await response.json()
      if (result.success) {
        // Validate all course day strings
        result.data.forEach((course: CourseSection) => {
          if (!validateDayString(course.meetingDays)) {
            console.warn(`Invalid day format for ${course.courseCode}: ${course.meetingDays}`)
          }
        })
        return result.data
      } else {
        throw new Error(result.error || "Failed to fetch available courses")
      }
    } catch (err: any) {
      console.error("Error fetching available courses:", err)
      throw new Error(`Error fetching available courses: ${err.message}`)
    }
  }

  // Load active courses from localStorage
  const loadActiveCourses = () => {
    try {
      if (typeof window !== "undefined") {
        const savedCourses = localStorage.getItem("courseStatuses")
        if (savedCourses) {
          const parsedCourses = JSON.parse(savedCourses)
          return parsedCourses.filter((course: any) => course.status === "active")
        }
      }
      return []
    } catch (err) {
      console.error("Error loading active courses from localStorage:", err)
      return []
    }
  }

  // Fetch both available courses and active courses
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      let availableCoursesData: CourseSection[] = []
      try {
        availableCoursesData = await fetchAvailableCourses()
        if (availableCoursesData.length === 0) {
          console.warn("No course data available, using sample data")
          availableCoursesData = sampleAvailableCourses
          setError("No course data available. Please use the extension to extract course data.")
        }
      } catch (err: any) {
        console.error("Failed to fetch available courses:", err)
        setError(err.message || "Failed to fetch available courses")
        availableCoursesData = sampleAvailableCourses
      }

      const activeCoursesData = loadActiveCourses()

      setAvailableCourses(availableCoursesData)
      setActiveCourses(activeCoursesData)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError("Error fetching data: " + (err.message || "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isClient) {
      fetchData()
    }
  }, [isClient])

  // Filter courses based on active status and curriculum
  const filteredCourses = availableCourses.filter((course) => {
    if (showOnlyActive) {
      return (
        curriculumCodes.includes(course.courseCode) && activeCourses.some((active) => active.code === course.courseCode)
      )
    } else {
      return true
    }
  })

  // Find active courses that don't have available sections
  const coursesNeedingPetition = activeCourses.filter(
    (active) => !availableCourses.some((available) => available.courseCode === active.code),
  )

  // Get all available department codes
  const departmentCodes = React.useMemo(() => {
    const departments = new Set<string>()
    availableCourses.forEach((course) => {
      const dept = extractDepartmentCode(course.courseCode)
      departments.add(dept)
    })
    return Array.from(departments).sort()
  }, [availableCourses])

  const downloadScheduleImage = async () => {
    if (!scheduleRef.current) return

    try {
      // Store original styles
      const dayHeaders = scheduleRef.current.querySelectorAll(".day-header")
      const originalStyles = Array.from(dayHeaders).map((header) => ({
        element: header as HTMLElement,
        display: (header as HTMLElement).style.display,
        alignItems: (header as HTMLElement).style.alignItems,
        justifyContent: (header as HTMLElement).style.justifyContent,
        height: (header as HTMLElement).style.height,
      }))

      // Apply temporary styles for perfect centering during capture
      dayHeaders.forEach((header) => {
        const el = header as HTMLElement
        el.style.display = "flex"
        el.style.alignItems = "center"
        el.style.justifyContent = "center"
        el.style.height = "44px" // Match your header height
      })

      // Hide the edit button temporarily
      const editButtons = scheduleRef.current.querySelectorAll(".edit-button")
      editButtons.forEach((button) => ((button as HTMLElement).style.display = "none"))

      // Small delay to ensure styles are applied
      await new Promise((resolve) => setTimeout(resolve, 50))

      const canvas = await html2canvas(scheduleRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "white",
        scrollX: 0,
        scrollY: 0,
        windowWidth: scheduleRef.current.scrollWidth,
        windowHeight: scheduleRef.current.scrollHeight,
      })

      // Restore all original styles
      originalStyles.forEach((style) => {
        style.element.style.display = style.display
        style.element.style.alignItems = style.alignItems
        style.element.style.justifyContent = style.justifyContent
        style.element.style.height = style.height
      })

      // Restore the edit buttons
      editButtons.forEach((button) => ((button as HTMLElement).style.display = ""))

      const link = document.createElement("a")
      link.download = `schedule-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("Error generating image:", err)
    }
  }

  // Save course customization
  const saveCustomization = () => {
    if (!editingCourse) return

    const key = `${editingCourse.courseCode}-${editingCourse.section}`
    setCustomizations((prev) => ({
      ...prev,
      [key]: {
        customTitle: tempCustomTitle || editingCourse.courseCode,
        color: tempCustomColor,
      },
    }))
    setEditingCourse(null)
  }

  // Get course color
  const getCourseColor = (course: SelectedCourse) => {
    const key = `${course.courseCode}-${course.section}`
    return customizations[key]?.color || "#3b82f6" // Default blue
  }

  // Editable title component
  const EditableTitle = () => {
    const [isEditing, setIsEditing] = useState(false)
    const [tempTitle, setTempTitle] = useState(scheduleTitle)

    const handleSave = () => {
      setScheduleTitle(tempTitle)
      localStorage.setItem("scheduleTitle", tempTitle)
      setIsEditing(false)
    }

    return (
      <div className="flex items-center justify-center gap-2 mb-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              className="text-center text-lg font-bold w-64"
            />
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold">{scheduleTitle}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    )
  }

  const renderScheduleView = () => {
    // Constants for precise alignment
    const HEADER_HEIGHT = 44 // Height of header row in pixels
    const HOUR_HEIGHT = 80 // Each hour = 80px tall
    const FIRST_HOUR = 7 // Schedule starts at 7AM

    return (
      <div>
        {/* Header controls */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Label htmlFor="start-date">Start Date:</Label>
            <Input
              type="date"
              id="start-date"
              value={startDate.toISOString().split("T")[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadICSFile}
              className="flex items-center gap-2 bg-transparent"
            >
              <Calendar className="h-4 w-4" />
              Export as ICS
            </Button>
            <Button variant="default" size="sm" onClick={downloadScheduleImage} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download as Image
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4" ref={scheduleRef}>
          <EditableTitle />

          <div className="overflow-x-auto relative">
            {/* Header row - fixed at top */}
            <div className="grid grid-cols-7 gap-1 min-w-[800px] sticky top-0 z-20">
              <div className="font-medium p-2 bg-gray-100 dark:bg-gray-700 text-center">Time</div>
              {DAYS.map((day) => (
                <div key={day} className="font-medium p-2 bg-gray-100 dark:bg-gray-700 text-center">
                  {getFullDayName(day)}
                </div>
              ))}
            </div>

            {/* Time slots - absolutely positioned */}
            <div className="relative min-w-[800px]" style={{ height: `${HOUR_HEIGHT * 15}px` }}>
              {/* Hour markers */}
              {Array.from({ length: 15 }).map((_, i) => {
                const hour = FIRST_HOUR + i
                const timeString = `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700"
                    style={{ top: `${i * HOUR_HEIGHT}px` }}
                  >
                    <div className="absolute left-0 p-1 text-xs font-medium">{timeString}</div>
                  </div>
                )
              })}

              {/* Half-hour markers */}
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={`half-${i}`}
                  className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700"
                  style={{ top: `${(i + 0.5) * HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Course blocks - adjusted 30 minutes up */}
              {selectedCourses.map((course) => {
                const key = `${course.courseCode}-${course.section}`
                const customization = customizations[key] || {}
                const bgColor = customization.color || "#3b82f6"
                const textColor = getContrastColor(bgColor)

                // Calculate exact positions with 30-minute adjustment
                const [startHour, startMinute] = course.timeStart.split(":").map(Number)
                const [endHour, endMinute] = course.timeEnd.split(":").map(Number)

                // Subtract 30 minutes from both start and end times
                let adjustedStartHour = startHour
                let adjustedStartMinute = startMinute - 30
                let adjustedEndHour = endHour
                let adjustedEndMinute = endMinute - 30

                // Handle minute underflow
                if (adjustedStartMinute < 0) {
                  adjustedStartHour -= 1
                  adjustedStartMinute += 60
                }
                if (adjustedEndMinute < 0) {
                  adjustedEndHour -= 1
                  adjustedEndMinute += 60
                }

                const startTop =
                  HEADER_HEIGHT +
                  (adjustedStartHour - FIRST_HOUR) * HOUR_HEIGHT +
                  (adjustedStartMinute / 60) * HOUR_HEIGHT

                const endTop =
                  HEADER_HEIGHT + (adjustedEndHour - FIRST_HOUR) * HOUR_HEIGHT + (adjustedEndMinute / 60) * HOUR_HEIGHT

                const height = endTop - startTop

                return course.parsedDays.map((day) => {
                  const dayIndex = DAYS.indexOf(day)
                  if (dayIndex === -1) return null

                  return (
                    <div
                      key={`${key}-${day}`}
                      className="absolute rounded p-1"
                      style={{
                        left: `${(dayIndex + 1) * (100 / 7)}%`,
                        top: `${startTop}px`,
                        height: `${height}px`,
                        backgroundColor: bgColor,
                        color: textColor,
                        width: `calc(${100 / 7}% - 4px)`,
                        zIndex: 10,
                        margin: "0 2px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "5px 10px 15px",
                        boxSizing: "border-box",
                        overflow: "visible",
                      }}
                    >
                      <div className="font-bold text-sm leading-tight break-words">
                        {customization.customTitle || course.courseCode}
                      </div>
                      <div className="text-xs leading-tight break-words">{course.displayTime}</div>
                      <div className="text-xs leading-tight break-words">{course.displayRoom}</div>
                    </div>
                  )
                })
              })}
            </div>
          </div>
        </div>
      </div>
    )
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
              <h1 className="text-3xl font-bold">Schedule Maker</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Create your perfect class schedule with available course sections
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === "card" ? "table" : "card")}
                className="flex items-center gap-2"
              >
                {viewMode === "card" ? "Table View" : "Card View"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4">
                <Button onClick={openStudentPortal} className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open Student Portal Course Offerings
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Note about Course Tracker integration */}
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Course Tracker Integration</AlertTitle>
          <AlertDescription>
            The Schedule Maker shows available sections for courses marked as "Active" in the Course Tracker. If you
            don't see your desired courses, go back to the Course Tracker and mark them as active.
          </AlertDescription>
        </Alert>

        {/* Courses Needing Petition */}
        {coursesNeedingPetition.length > 0 && showOnlyActive && (
          <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Courses Needing Petition</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                The following active courses don't have available sections. You may need to file a petition for these
                courses:
              </p>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Code</TableHead>
                      <TableHead>Course Name</TableHead>
                      <TableHead>Credits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coursesNeedingPetition.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.code}</TableCell>
                        <TableCell>{course.name}</TableCell>
                        <TableCell>{course.credits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">Loading available courses...</p>
          </div>
        ) : (
          <Tabs defaultValue="available" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="available">Available Courses</TabsTrigger>
              <TabsTrigger value="selected">Selected Courses ({selectedCourses.length})</TabsTrigger>
              <TabsTrigger value="schedule">Schedule View</TabsTrigger>
            </TabsList>

            {/* Available Courses Tab */}
            <TabsContent value="available">
              <div>
                <div className="mb-4 flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:w-1/4">
                    <Label htmlFor="search-courses">Search Courses</Label>
                    <Input
                      id="search-courses"
                      placeholder="Search by code or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.currentTarget.value)}
                    />
                  </div>
                  <div className="w-full md:w-1/4">
                    <Label htmlFor="department-filter">Department</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger id="department-filter">
                        <SelectValue placeholder="Select department..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departmentCodes.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full md:w-1/4">
                    <Label htmlFor="sort-by">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger id="sort-by">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="courseCode">Course Code</SelectItem>
                        <SelectItem value="section">Section</SelectItem>
                        <SelectItem value="remainingSlots">Available Slots</SelectItem>
                        <SelectItem value="meetingDays">Meeting Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full md:w-1/4">
                    <Label htmlFor="sort-order">Order</Label>
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                      <SelectTrigger id="sort-order">
                        <SelectValue placeholder="Sort order..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mb-4">
                  <Switch id="show-active-only" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
                  <Label htmlFor="show-active-only">Show only active courses from Course Tracker</Label>
                </div>

                <p className="mb-4">
                  Found {getFilteredAndSortedCourses().length} course sections
                  {showOnlyActive ? " for your active courses" : ""} (out of {availableCourses.length} total extracted
                  courses).
                </p>

                {getFilteredAndSortedCourses().length === 0 ? (
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded mb-4">
                    <p>
                      No courses match your current filters. Try adjusting your search criteria or department filter.
                    </p>
                    {showOnlyActive && (
                      <div className="mt-4">
                        <Link href="/course-tracker">
                          <Button className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Go to Course Tracker
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {viewMode === "table" && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Department</TableHead>
                              <TableHead>Course Code</TableHead>
                              <TableHead>Course Name</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>Schedule</TableHead>
                              <TableHead>Room</TableHead>
                              <TableHead>Slots</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupCoursesByDepartment(getFilteredAndSortedCourses()).map(({ department, courses }) => (
                              <React.Fragment key={department}>
                                <TableRow className="bg-gray-100 dark:bg-gray-700">
                                  <TableCell colSpan={8} className="font-medium">
                                    Department: {department}
                                  </TableCell>
                                </TableRow>
                                {courses.map((course, index) => {
                                  const courseDetails = activeCourses.find(
                                    (active) => active.code === course.courseCode,
                                  ) || {
                                    name: courseDetailsMap[course.courseCode]?.name || "Unknown Course",
                                    credits: courseDetailsMap[course.courseCode]?.credits || 3,
                                  }
                                  const isConflict = hasScheduleConflict(course)
                                  const isAlreadySelected = selectedCourses.some(
                                    (selected) =>
                                      selected.courseCode === course.courseCode && selected.section === course.section,
                                  )
                                  const hasSameCode = hasSameCourseCode(course) && !isAlreadySelected
                                  const existingCourse = hasSameCode ? getSelectedCourseWithSameCode(course) : null

                                  return (
                                    <TableRow key={`${course.courseCode}-${course.section}-${index}`}>
                                      <TableCell>{department}</TableCell>
                                      <TableCell>{course.courseCode}</TableCell>
                                      <TableCell>{courseDetails.name}</TableCell>
                                      <TableCell>{course.section}</TableCell>
                                      <TableCell>
                                        {cleanTimeString(course.meetingTime)} ({course.meetingDays})
                                      </TableCell>
                                      <TableCell>{cleanRoomString(course.room)}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant={course.hasSlots ? "success" : "destructive"}
                                          className={`px-2 py-1 text-xs font-semibold ${
                                            course.hasSlots
                                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                          }`}
                                        >
                                          {course.hasSlots ? `${course.remainingSlots}/${course.classSize}` : "Full"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {hasSameCode ? (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                                              >
                                                Replace Section
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80">
                                              <div className="space-y-4">
                                                <h4 className="font-medium">Replace Existing Section</h4>
                                                <p className="text-sm">
                                                  You already have {course.courseCode} section {existingCourse?.section}{" "}
                                                  in your schedule. Do you want to replace it with section{" "}
                                                  {course.section}?
                                                </p>
                                                <div className="flex justify-end gap-2">
                                                  <Button size="sm" variant="outline" onClick={() => addCourse(course)}>
                                                    <Check className="h-4 w-4 mr-1" /> Yes, Replace
                                                  </Button>
                                                </div>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant={
                                              isAlreadySelected ? "destructive" : isConflict ? "outline" : "default"
                                            }
                                            disabled={isConflict && !isAlreadySelected}
                                            onClick={() => {
                                              if (isAlreadySelected) {
                                                removeCourse(course.courseCode, course.section)
                                              } else {
                                                addCourse(course)
                                              }
                                            }}
                                          >
                                            {isAlreadySelected ? "Remove" : "Add"}
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {viewMode === "card" && (
                      <div className="space-y-6">
                        {groupCoursesByDepartment(getFilteredAndSortedCourses()).map(({ department, courses }) => (
                          <div key={department} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 font-medium">
                              Department: {department}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                              {courses.map((course, index) => {
                                const courseDetails = activeCourses.find(
                                  (active) => active.code === course.courseCode,
                                ) || {
                                  name: courseDetailsMap[course.courseCode]?.name || "Unknown Course",
                                  credits: courseDetailsMap[course.courseCode]?.credits || 3,
                                }
                                const isConflict = hasScheduleConflict(course)
                                const isAlreadySelected = selectedCourses.some(
                                  (selected) =>
                                    selected.courseCode === course.courseCode && selected.section === course.section,
                                )
                                const hasSameCode = hasSameCourseCode(course) && !isAlreadySelected
                                const existingCourse = hasSameCode ? getSelectedCourseWithSameCode(course) : null

                                return (
                                  <Card
                                    key={index}
                                    className={`bg-white dark:bg-gray-800 shadow-md transition-shadow ${
                                      isConflict ? "border-red-300 dark:border-red-700" : ""
                                    }`}
                                  >
                                    <CardHeader className="pb-2">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="text-sm font-medium">{course.courseCode}</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {courseDetails.name} - Section {course.section}
                                          </p>
                                        </div>
                                        <Badge
                                          variant={course.hasSlots ? "success" : "destructive"}
                                          className={`px-2 py-1 text-xs font-semibold ${
                                            course.hasSlots
                                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                          }`}
                                        >
                                          {course.hasSlots ? `${course.remainingSlots}/${course.classSize}` : "Full"}
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="font-medium">Days:</span>
                                          <span>{course.meetingDays}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Time:</span>
                                          <span>{cleanTimeString(course.meetingTime)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="font-medium">Room:</span>
                                          <span>{cleanRoomString(course.room)}</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                    <CardFooter>
                                      {hasSameCode ? (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              className="w-full bg-transparent"
                                              variant="outline"
                                              className="bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 w-full"
                                            >
                                              Replace Section
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80">
                                            <div className="space-y-4">
                                              <h4 className="font-medium">Replace Existing Section</h4>
                                              <p className="text-sm">
                                                You already have {course.courseCode} section {existingCourse?.section}{" "}
                                                in your schedule. Do you want to replace it with section{" "}
                                                {course.section}?
                                              </p>
                                              <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => addCourse(course)}>
                                                  <Check className="h-4 w-4 mr-1" /> Yes, Replace
                                                </Button>
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      ) : (
                                        <Button
                                          className="w-full"
                                          variant={
                                            isAlreadySelected ? "destructive" : isConflict ? "outline" : "default"
                                          }
                                          disabled={isConflict && !isAlreadySelected}
                                          onClick={() => {
                                            if (isAlreadySelected) {
                                              removeCourse(course.courseCode, course.section)
                                            } else {
                                              addCourse(course)
                                            }
                                          }}
                                        >
                                          {isAlreadySelected ? (
                                            <>
                                              <Trash className="h-4 w-4 mr-2" />
                                              Remove from Schedule
                                            </>
                                          ) : isConflict ? (
                                            <>
                                              <AlertCircle className="h-4 w-4 mr-2" />
                                              Conflicts
                                            </>
                                          ) : (
                                            <>
                                              <Plus className="h-4 w-4 mr-2" />
                                              Add to Schedule
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </CardFooter>
                                  </Card>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Selected Courses Tab */}
            <TabsContent value="selected">
              {selectedCourses.length === 0 ? (
                <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded mb-4">
                  <p>No courses selected yet. Add courses from the Available Courses tab to build your schedule.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCourses.map((course) => {
                    const key = `${course.courseCode}-${course.section}`
                    const customization = customizations[key] || {}
                    const bgColor = customization.color || "#3b82f6"
                    const textColor = getContrastColor(bgColor)

                    return (
                      <Card key={key} className="bg-white dark:bg-gray-800 shadow-md">
                        <CardHeader className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg font-semibold">
                              {customization.customTitle || course.courseCode}
                            </CardTitle>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {course.name} - Section {course.section}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="edit-button bg-transparent">
                                  <Palette className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-4">
                                  <h4 className="font-medium">Customize Course Appearance</h4>
                                  <div>
                                    <Label htmlFor="custom-title">Custom Title</Label>
                                    <Input
                                      id="custom-title"
                                      placeholder="Enter custom title"
                                      value={tempCustomTitle}
                                      onChange={(e) => setTempCustomTitle(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label>Course Color</Label>
                                    <HexColorPicker color={tempCustomColor} onChange={setTempCustomColor} />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setTempCustomTitle(customization.customTitle || "")
                                        setTempCustomColor(customization.color || "#3b82f6")
                                      }}
                                    >
                                      Reset
                                    </Button>
                                    <Button onClick={saveCustomization}>Save</Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeCourse(course.courseCode, course.section)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">Days:</span>
                              <span>{course.meetingDays}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Time:</span>
                              <span>{course.displayTime}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Room:</span>
                              <span>{course.displayRoom}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Credits:</span>
                              <span>{course.credits}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Schedule View Tab */}
            <TabsContent value="schedule">{renderScheduleView()}</TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
