"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  Filter,
  Info,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  BookOpen,
  GraduationCap,
  Palette,
  Edit3,
  Save,
  FileDown,
  Replace,
} from "lucide-react"
import Link from "next/link"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Course section interface
interface CourseSection {
  courseCode: string
  section: string
  classSize: string
  remainingSlots: string
  meetingDays: string
  meetingTime: string
  room: string
  hasSlots: boolean
  program?: string
  department?: string
}

// Schedule course interface (courses added to schedule)
interface ScheduleCourse extends CourseSection {
  id: string
  courseName: string
  credits: number
  color: string
  customTitle?: string
}

// Time slot interface for schedule grid
interface TimeSlot {
  time: string
  courses: { [day: string]: ScheduleCourse | null }
}

// Department grouping interface
interface DepartmentGroup {
  department: string
  courses: CourseSection[]
}

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

// Sample initial courses data (replace with your actual data source)
const initialCourses = [
  { code: "COE123", name: "Sample Course 1", credits: 3 },
  { code: "GED456", name: "Sample Course 2", credits: 2 },
  // Add more courses as needed
]

// Course details map for quick lookup
const courseDetailsMap = initialCourses.reduce((map, course) => {
  map[course.code] = course
  return map
}, {})

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
function parseDays(daysString: string): string[] {
  if (!daysString) return []

  const days: string[] = []
  let i = 0

  while (i < daysString.length) {
    if (i < daysString.length - 1 && daysString.substring(i, i + 2) === "Th") {
      days.push("Thursday")
      i += 2
    } else {
      const dayMap: { [key: string]: string } = {
        M: "Monday",
        T: "Tuesday",
        W: "Wednesday",
        F: "Friday",
        S: "Saturday",
      }
      days.push(dayMap[daysString[i]] || daysString[i])
      i += 1
    }
  }

  return days
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
  const [scheduledCourses, setScheduledCourses] = useState<ScheduleCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("department")
  const [showOnlyWithSlots, setShowOnlyWithSlots] = useState(true)
  const [showAllPrograms, setShowAllPrograms] = useState(false)
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar")
  const [calendarTitle, setCalendarTitle] = useState("My Class Schedule")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState(calendarTitle)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Color palette for course blocks
  const colorPalette = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Yellow
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#F97316", // Orange
    "#06B6D4", // Cyan
    "#84CC16", // Lime
    "#EC4899", // Pink
    "#6B7280", // Gray
  ]

  // Load data on component mount
  useEffect(() => {
    loadData()
    loadScheduleFromStorage()
    loadCalendarTitle()
  }, [])

  // Load calendar title from localStorage
  const loadCalendarTitle = () => {
    const savedTitle = localStorage.getItem("scheduleCalendarTitle")
    if (savedTitle) {
      setCalendarTitle(savedTitle)
      setTempTitle(savedTitle)
    }
  }

  // Save calendar title to localStorage
  const saveCalendarTitle = () => {
    setCalendarTitle(tempTitle)
    localStorage.setItem("scheduleCalendarTitle", tempTitle)
    setIsEditingTitle(false)
  }

  // Load available courses from API
  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/get-available-courses")
      const result = await response.json()

      if (result.success) {
        // Add department information to courses
        const coursesWithDepartment = result.data.map((course: CourseSection) => ({
          ...course,
          department: course.courseCode.substring(0, 3), // Extract department from course code
        }))
        setAvailableCourses(coursesWithDepartment)
      } else {
        throw new Error(result.error || "Failed to fetch available courses")
      }
    } catch (err: any) {
      console.error("Error fetching available courses:", err)
      setError(
        "Could not load available courses. Please make sure you have extracted course data using the Chrome extension and try refreshing the page.",
      )
    }

    setLoading(false)
  }

  // Load schedule from localStorage
  const loadScheduleFromStorage = () => {
    try {
      const savedSchedule = localStorage.getItem("userSchedule")
      if (savedSchedule) {
        const parsedSchedule = JSON.parse(savedSchedule)
        setScheduledCourses(parsedSchedule)
      }
    } catch (error) {
      console.error("Error loading schedule from storage:", error)
    }
  }

  // Save schedule to localStorage
  const saveScheduleToStorage = (schedule: ScheduleCourse[]) => {
    try {
      localStorage.setItem("userSchedule", JSON.stringify(schedule))
    } catch (error) {
      console.error("Error saving schedule to storage:", error)
    }
  }

  // Add course to schedule
  const addCourseToSchedule = (courseSection: CourseSection) => {
    // Check if course is already in schedule
    const existingCourse = scheduledCourses.find(
      (course) => course.courseCode === courseSection.courseCode && course.section === courseSection.section,
    )

    if (existingCourse) {
      alert("This course section is already in your schedule!")
      return
    }

    // Check for time conflicts
    const hasConflict = checkTimeConflict(courseSection)
    if (hasConflict) {
      const confirmAdd = window.confirm(
        "This course has a time conflict with your existing schedule. Do you want to add it anyway?",
      )
      if (!confirmAdd) return
    }

    // Create new schedule course
    const newScheduleCourse: ScheduleCourse = {
      ...courseSection,
      id: `${courseSection.courseCode}-${courseSection.section}`,
      courseName: getCourseName(courseSection.courseCode),
      credits: getCourseCredits(courseSection.courseCode),
      color: colorPalette[scheduledCourses.length % colorPalette.length],
    }

    const updatedSchedule = [...scheduledCourses, newScheduleCourse]
    setScheduledCourses(updatedSchedule)
    saveScheduleToStorage(updatedSchedule)
  }

  // Remove course from schedule
  const removeCourseFromSchedule = (courseId: string) => {
    const updatedSchedule = scheduledCourses.filter((course) => course.id !== courseId)
    setScheduledCourses(updatedSchedule)
    saveScheduleToStorage(updatedSchedule)
  }

  // Replace course section
  const replaceCourseSection = (oldCourseId: string, newSection: CourseSection) => {
    const oldCourse = scheduledCourses.find((course) => course.id === oldCourseId)
    if (!oldCourse) return

    // Check for time conflicts with the new section
    const hasConflict = checkTimeConflict(newSection, oldCourseId)
    if (hasConflict) {
      const confirmReplace = window.confirm(
        "The new section has a time conflict with your existing schedule. Do you want to replace it anyway?",
      )
      if (!confirmReplace) return
    }

    // Create new schedule course with the same color and custom title
    const newScheduleCourse: ScheduleCourse = {
      ...newSection,
      id: `${newSection.courseCode}-${newSection.section}`,
      courseName: oldCourse.courseName,
      credits: oldCourse.credits,
      color: oldCourse.color,
      customTitle: oldCourse.customTitle,
    }

    const updatedSchedule = scheduledCourses.map((course) => (course.id === oldCourseId ? newScheduleCourse : course))
    setScheduledCourses(updatedSchedule)
    saveScheduleToStorage(updatedSchedule)
  }

  // Update course customization
  const updateCourseCustomization = (courseId: string, customTitle: string, color: string) => {
    const updatedSchedule = scheduledCourses.map((course) =>
      course.id === courseId ? { ...course, customTitle, color } : course,
    )
    setScheduledCourses(updatedSchedule)
    saveScheduleToStorage(updatedSchedule)
  }

  // Check for time conflicts
  const checkTimeConflict = (newCourse: CourseSection, excludeCourseId?: string): boolean => {
    const newDays = parseDays(newCourse.meetingDays)
    const newTimeRange = parseTimeRange(newCourse.meetingTime)

    if (!newTimeRange) return false

    return scheduledCourses.some((existingCourse) => {
      if (excludeCourseId && existingCourse.id === excludeCourseId) return false

      const existingDays = parseDays(existingCourse.meetingDays)
      const existingTimeRange = parseTimeRange(existingCourse.meetingTime)

      if (!existingTimeRange) return false

      // Check if there's any day overlap
      const hasDateOverlap = newDays.some((day) => existingDays.includes(day))
      if (!hasDateOverlap) return false

      // Check if there's time overlap
      return (
        (newTimeRange.start < existingTimeRange.end && newTimeRange.end > existingTimeRange.start) ||
        (existingTimeRange.start < newTimeRange.end && existingTimeRange.end > newTimeRange.start)
      )
    })
  }

  // Parse time range (e.g., "08:00-09:30") into start and end times in minutes
  const parseTimeRange = (timeString: string): { start: number; end: number } | null => {
    if (!timeString || timeString === "TBD") return null

    const match = timeString.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
    if (!match) return null

    const [, startHour, startMin, endHour, endMin] = match
    const start = Number.parseInt(startHour) * 60 + Number.parseInt(startMin)
    const end = Number.parseInt(endHour) * 60 + Number.parseInt(endMin)

    return { start, end }
  }

  // Get course name (placeholder - you might want to implement actual course name lookup)
  const getCourseName = (courseCode: string): string => {
    // This is a placeholder. In a real app, you'd have a course database
    const courseNames: { [key: string]: string } = {
      // Add course mappings here
    }
    return courseNames[courseCode] || `Course ${courseCode}`
  }

  // Get course credits (placeholder - you might want to implement actual credits lookup)
  const getCourseCredits = (courseCode: string): number => {
    // This is a placeholder. In a real app, you'd have a course database
    return 3 // Default to 3 credits
  }

  // Filter and sort available courses
  const getFilteredAndSortedCourses = (): CourseSection[] => {
    const filtered = availableCourses.filter((course) => {
      // Search filter
      const matchesSearch =
        course.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.meetingDays.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.meetingTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.room.toLowerCase().includes(searchTerm.toLowerCase())

      // Department filter
      const matchesDepartment = selectedDepartment === "all" || course.department === selectedDepartment

      // Slots filter
      const matchesSlots = !showOnlyWithSlots || course.hasSlots

      // Program filter (show all programs or just CpE)
      const matchesProgram = showAllPrograms || !course.program || course.program.includes("CpE")

      return matchesSearch && matchesDepartment && matchesSlots && matchesProgram
    })

    // Sort courses
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "department":
          return (a.department || "").localeCompare(b.department || "")
        case "courseCode":
          return a.courseCode.localeCompare(b.courseCode)
        case "section":
          return a.section.localeCompare(b.section)
        case "slots":
          return Number.parseInt(b.remainingSlots) - Number.parseInt(a.remainingSlots)
        case "meetingDays":
          return a.meetingDays.localeCompare(b.meetingDays)
        default:
          return 0
      }
    })

    return filtered
  }

  // Group courses by department
  const getCoursesGroupedByDepartment = (): DepartmentGroup[] => {
    const filtered = getFilteredAndSortedCourses()
    const grouped = filtered.reduce(
      (acc, course) => {
        const dept = course.department || "Unknown"
        if (!acc[dept]) {
          acc[dept] = []
        }
        acc[dept].push(course)
        return acc
      },
      {} as { [key: string]: CourseSection[] },
    )

    return Object.entries(grouped)
      .map(([department, courses]) => ({ department, courses }))
      .sort((a, b) => a.department.localeCompare(b.department))
  }

  // Get unique departments
  const getDepartments = (): string[] => {
    const departments = Array.from(new Set(availableCourses.map((course) => course.department || "Unknown")))
    return departments.sort()
  }

  // Generate time slots for calendar view
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = []
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    // Generate time slots from 7:00 AM to 9:00 PM
    for (let hour = 7; hour <= 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        const slot: TimeSlot = {
          time: timeString,
          courses: {},
        }

        days.forEach((day) => {
          slot.courses[day] = null
        })

        slots.push(slot)
      }
    }

    // Fill in scheduled courses
    scheduledCourses.forEach((course) => {
      const courseDays = parseDays(course.meetingDays)
      const timeRange = parseTimeRange(course.meetingTime)

      if (timeRange) {
        const startHour = Math.floor(timeRange.start / 60)
        const startMinute = timeRange.start % 60
        const endHour = Math.floor(timeRange.end / 60)
        const endMinute = timeRange.end % 60

        // Find the slot that matches the start time
        const startSlotIndex = slots.findIndex((slot) => {
          const [slotHour, slotMinute] = slot.time.split(":").map(Number)
          return slotHour === startHour && slotMinute === startMinute
        })

        if (startSlotIndex !== -1) {
          courseDays.forEach((day) => {
            // Calculate how many slots this course spans
            const durationMinutes = timeRange.end - timeRange.start
            const slotsSpanned = Math.ceil(durationMinutes / 30)

            // Mark all spanned slots
            for (let i = 0; i < slotsSpanned && startSlotIndex + i < slots.length; i++) {
              slots[startSlotIndex + i].courses[day] = course
            }
          })
        }
      }
    })

    return slots
  }

  // Export schedule as image
  const exportScheduleAsImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = 1200
    canvas.height = 800

    // Set background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Set font
    ctx.font = "14px Arial"
    ctx.fillStyle = "#000000"

    // Draw title
    ctx.font = "24px Arial"
    ctx.textAlign = "center"
    ctx.fillText(calendarTitle, canvas.width / 2, 40)

    // Draw schedule grid
    const days = ["Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const cellWidth = canvas.width / days.length
    const cellHeight = 30
    const startY = 80

    // Draw headers
    ctx.font = "16px Arial"
    ctx.fillStyle = "#4B5563"
    days.forEach((day, index) => {
      ctx.fillText(day, index * cellWidth + cellWidth / 2, startY)
    })

    // Draw time slots and courses
    const timeSlots = generateTimeSlots()
    ctx.font = "12px Arial"

    timeSlots.forEach((slot, slotIndex) => {
      const y = startY + 30 + slotIndex * cellHeight

      // Draw time
      ctx.fillStyle = "#6B7280"
      ctx.textAlign = "center"
      ctx.fillText(slot.time, cellWidth / 2, y + 20)

      // Draw courses
      days.slice(1).forEach((day, dayIndex) => {
        const course = slot.courses[day]
        const x = (dayIndex + 1) * cellWidth

        if (course) {
          // Draw course block
          ctx.fillStyle = course.color
          ctx.fillRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4)

          // Draw course text
          ctx.fillStyle = "#ffffff"
          ctx.font = "10px Arial"
          const text = course.customTitle || `${course.courseCode} ${course.section}`
          ctx.fillText(text, x + cellWidth / 2, y + 15)
          ctx.fillText(course.room, x + cellWidth / 2, y + 25)
        }

        // Draw grid lines
        ctx.strokeStyle = "#E5E7EB"
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, cellWidth, cellHeight)
      })
    })

    // Download image
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "class-schedule.png"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    })
  }

  // Export schedule as ICS file
  const exportScheduleAsICS = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ComParEng Tools//Schedule Maker//EN\n"

    scheduledCourses.forEach((course) => {
      const courseDays = parseDays(course.meetingDays)
      const timeRange = parseTimeRange(course.meetingTime)

      if (timeRange && courseDays.length > 0) {
        courseDays.forEach((day) => {
          // Create recurring event for each day
          const dayMap: { [key: string]: string } = {
            Monday: "MO",
            Tuesday: "TU",
            Wednesday: "WE",
            Thursday: "TH",
            Friday: "FR",
            Saturday: "SA",
          }

          const startHour = Math.floor(timeRange.start / 60)
          const startMinute = timeRange.start % 60
          const endHour = Math.floor(timeRange.end / 60)
          const endMinute = timeRange.end % 60

          // Format time for ICS (HHMMSS)
          const startTime = `${startHour.toString().padStart(2, "0")}${startMinute.toString().padStart(2, "0")}00`
          const endTime = `${endHour.toString().padStart(2, "0")}${endMinute.toString().padStart(2, "0")}00`

          // Get current date for DTSTART
          const now = new Date()
          const year = now.getFullYear()
          const month = (now.getMonth() + 1).toString().padStart(2, "0")
          const date = now.getDate().toString().padStart(2, "0")

          icsContent += "BEGIN:VEVENT\n"
          icsContent += `UID:${course.id}-${day}@compareng-tools.vercel.app\n`
          icsContent += `DTSTART:${year}${month}${date}T${startTime}\n`
          icsContent += `DTEND:${year}${month}${date}T${endTime}\n`
          icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${dayMap[day]}\n`
          icsContent += `SUMMARY:${course.customTitle || course.courseCode} ${course.section}\n`
          icsContent += `DESCRIPTION:Course: ${course.courseName}\\nSection: ${course.section}\\nCredits: ${course.credits}\n`
          icsContent += `LOCATION:${course.room}\n`
          icsContent += "END:VEVENT\n"
        })
      }
    })

    icsContent += "END:VCALENDAR"

    // Download ICS file
    const blob = new Blob([icsContent], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "class-schedule.ics"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Clear all scheduled courses
  const clearSchedule = () => {
    if (window.confirm("Are you sure you want to clear your entire schedule?")) {
      setScheduledCourses([])
      saveScheduleToStorage([])
    }
  }

  // Open student portal
  const openStudentPortal = () => {
    window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")
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
          </div>
        </div>

        {error && (
          <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300">
            <Info className="h-4 w-4" />
            <AlertTitle>No Course Data Available</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4">
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Button onClick={openStudentPortal} className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Student Portal Course Offerings
                  </Button>
                  <Button onClick={loadData} className="flex items-center gap-2 bg-transparent" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                    Refresh Data
                  </Button>
                </div>
                <p className="mt-2 text-sm">
                  Use the Chrome extension to extract course data from the Student Portal. After extracting the data,
                  click "Refresh Data" to load the available courses.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">Loading available courses...</p>
          </div>
        ) : (
          <Tabs defaultValue="schedule" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule">My Schedule</TabsTrigger>
              <TabsTrigger value="courses">Available Courses</TabsTrigger>
            </TabsList>

            {/* My Schedule Tab */}
            <TabsContent value="schedule" className="space-y-6">
              {/* Schedule Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {isEditingTitle ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            className="text-lg font-semibold"
                            onKeyPress={(e) => e.key === "Enter" && saveCalendarTitle()}
                          />
                          <Button size="sm" onClick={saveCalendarTitle}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setIsEditingTitle(false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-2xl">{calendarTitle}</CardTitle>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(true)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={viewMode} onValueChange={(value: "calendar" | "table") => setViewMode(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="calendar">Calendar View</SelectItem>
                          <SelectItem value="table">Table View</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline">
                      {scheduledCourses.length} course{scheduledCourses.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline">
                      {scheduledCourses.reduce((sum, course) => sum + course.credits, 0)} total credits
                    </Badge>
                    <div className="flex gap-2 ml-auto">
                      <Button onClick={exportScheduleAsImage} size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export as Image
                      </Button>
                      <Button onClick={exportScheduleAsICS} size="sm" variant="outline">
                        <FileDown className="h-4 w-4 mr-2" />
                        Export as Calendar
                      </Button>
                      {scheduledCourses.length > 0 && (
                        <Button onClick={clearSchedule} size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear Schedule
                        </Button>
                      )}
                    </div>
                  </div>

                  {scheduledCourses.length === 0 ? (
                    <div className="text-center py-10">
                      <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Your schedule is empty. Add courses from the "Available Courses" tab.
                      </p>
                    </div>
                  ) : viewMode === "calendar" ? (
                    /* Calendar View */
                    <div className="overflow-x-auto">
                      <div className="min-w-[800px]">
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          <div className="p-2 font-semibold text-center bg-gray-100 dark:bg-gray-800">Time</div>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                            <div key={day} className="p-2 font-semibold text-center bg-gray-100 dark:bg-gray-800">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1">
                          {generateTimeSlots()
                            .filter((slot) => {
                              // Only show time slots that have courses or are between 7 AM and 9 PM
                              const [hour] = slot.time.split(":").map(Number)
                              const hasCourse = Object.values(slot.courses).some((course) => course !== null)
                              return hasCourse || (hour >= 7 && hour <= 21)
                            })
                            .map((slot, index) => (
                              <div key={index} className="grid grid-cols-7 gap-1">
                                <div className="p-2 text-sm text-center bg-gray-50 dark:bg-gray-800 border">
                                  {slot.time}
                                </div>
                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
                                  const course = slot.courses[day]
                                  return (
                                    <div
                                      key={day}
                                      className="p-2 min-h-[60px] border border-gray-200 dark:border-gray-700"
                                      style={{
                                        backgroundColor: course ? course.color + "20" : "transparent",
                                      }}
                                    >
                                      {course && (
                                        <div className="text-xs">
                                          <div className="font-semibold" style={{ color: course.color }}>
                                            {course.customTitle || `${course.courseCode} ${course.section}`}
                                          </div>
                                          <div className="text-gray-600 dark:text-gray-400">{course.room}</div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Table View */
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduledCourses.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{course.courseCode}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{course.courseName}</div>
                              </div>
                            </TableCell>
                            <TableCell>{course.section}</TableCell>
                            <TableCell>
                              <div>
                                <div>{course.meetingDays}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{course.meetingTime}</div>
                              </div>
                            </TableCell>
                            <TableCell>{course.room}</TableCell>
                            <TableCell>{course.credits}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded border" style={{ backgroundColor: course.color }}></div>
                                <Input
                                  type="color"
                                  value={course.color}
                                  onChange={(e) =>
                                    updateCourseCustomization(course.id, course.customTitle || "", e.target.value)
                                  }
                                  className="w-12 h-8 p-0 border-none"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      <Palette className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Customize Course</DialogTitle>
                                      <DialogDescription>
                                        Customize the display title and color for this course.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="customTitle">Custom Title</Label>
                                        <Input
                                          id="customTitle"
                                          value={course.customTitle || ""}
                                          onChange={(e) =>
                                            updateCourseCustomization(course.id, e.target.value, course.color)
                                          }
                                          placeholder={`${course.courseCode} ${course.section}`}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="color">Color</Label>
                                        <div className="flex items-center gap-2">
                                          <Input
                                            id="color"
                                            type="color"
                                            value={course.color}
                                            onChange={(e) =>
                                              updateCourseCustomization(
                                                course.id,
                                                course.customTitle || "",
                                                e.target.value,
                                              )
                                            }
                                            className="w-16 h-10"
                                          />
                                          <div className="flex gap-1">
                                            {colorPalette.map((color) => (
                                              <button
                                                key={color}
                                                className="w-6 h-6 rounded border-2 border-gray-300"
                                                style={{ backgroundColor: color }}
                                                onClick={() =>
                                                  updateCourseCustomization(course.id, course.customTitle || "", color)
                                                }
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      <Replace className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Replace Section</DialogTitle>
                                      <DialogDescription>
                                        Choose a different section for {course.courseCode}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-96 overflow-y-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Section</TableHead>
                                            <TableHead>Schedule</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Slots</TableHead>
                                            <TableHead>Action</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {availableCourses
                                            .filter((section) => section.courseCode === course.courseCode)
                                            .map((section) => (
                                              <TableRow key={section.section}>
                                                <TableCell>{section.section}</TableCell>
                                                <TableCell>
                                                  <div>
                                                    <div>{section.meetingDays}</div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                                      {section.meetingTime}
                                                    </div>
                                                  </div>
                                                </TableCell>
                                                <TableCell>{section.room}</TableCell>
                                                <TableCell>
                                                  <Badge
                                                    variant={section.hasSlots ? "default" : "destructive"}
                                                    className="text-xs"
                                                  >
                                                    {section.remainingSlots} left
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  <Button
                                                    size="sm"
                                                    onClick={() => replaceCourseSection(course.id, section)}
                                                    disabled={section.section === course.section}
                                                  >
                                                    {section.section === course.section ? "Current" : "Replace"}
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeCourseFromSchedule(course.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Available Courses Tab */}
            <TabsContent value="courses" className="space-y-6">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters & Search
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="search">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="search"
                          placeholder="Search courses..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {getDepartments().map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sortBy">Sort By</Label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="department">Department</SelectItem>
                          <SelectItem value="courseCode">Course Code</SelectItem>
                          <SelectItem value="section">Section</SelectItem>
                          <SelectItem value="slots">Available Slots</SelectItem>
                          <SelectItem value="meetingDays">Meeting Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="showOnlyWithSlots"
                          checked={showOnlyWithSlots}
                          onCheckedChange={setShowOnlyWithSlots}
                        />
                        <Label htmlFor="showOnlyWithSlots">Only show courses with available slots</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="showAllPrograms" checked={showAllPrograms} onCheckedChange={setShowAllPrograms} />
                        <Label htmlFor="showAllPrograms">Show all programs (not just CpE)</Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Available Courses */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Available Courses ({getFilteredAndSortedCourses().length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getFilteredAndSortedCourses().length === 0 ? (
                    <div className="text-center py-10">
                      <BookOpen className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">
                        No courses found matching your filters. Try adjusting your search criteria.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {getCoursesGroupedByDepartment().map((group) => (
                        <Collapsible key={group.department} defaultOpen>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{group.department}</h3>
                              <Badge variant="outline">{group.courses.length} courses</Badge>
                            </div>
                            <div className="text-gray-500">Click to toggle</div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Course Code</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>Schedule</TableHead>
                                    <TableHead>Room</TableHead>
                                    <TableHead>Slots</TableHead>
                                    <TableHead>Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.courses.map((course, index) => {
                                    const isInSchedule = scheduledCourses.some(
                                      (scheduled) =>
                                        scheduled.courseCode === course.courseCode &&
                                        scheduled.section === course.section,
                                    )
                                    const hasConflict = checkTimeConflict(course)

                                    return (
                                      <TableRow key={`${course.courseCode}-${course.section}-${index}`}>
                                        <TableCell className="font-medium">{course.courseCode}</TableCell>
                                        <TableCell>{course.section}</TableCell>
                                        <TableCell>
                                          <div>
                                            <div>{course.meetingDays}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                              {course.meetingTime}
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell>{course.room}</TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={course.hasSlots ? "default" : "destructive"}
                                            className="text-xs"
                                          >
                                            {course.remainingSlots} left
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            size="sm"
                                            onClick={() => addCourseToSchedule(course)}
                                            disabled={isInSchedule}
                                            className={hasConflict ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                                          >
                                            {isInSchedule ? (
                                              "Added"
                                            ) : hasConflict ? (
                                              <>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add (Conflict)
                                              </>
                                            ) : (
                                              <>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add
                                              </>
                                            )}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Hidden canvas for image export */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Bottom Navigation */}
        <div className="mt-10 mb-6">
          <QuickNavigation />
        </div>
      </div>
    </div>
  )
}
