"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  Plus,
  Trash,
  AlertCircle,
  BookOpen,
  GraduationCap,
  FileWarning,
  ExternalLink,
  Loader2,
  Check,
  Calendar,
  Download,
  Edit,
  ChevronDown,
  Sun,
  Moon,
  Palette,
  Maximize2,
  Minimize2,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  initialCourses,
  resolveCanonicalCourseCode,
  getCourseDetailsByCode,
  registerExternalCourses,
  registerExternalCourseCodes,
} from "@/lib/course-data"
import { loadCurriculumSignature } from "@/lib/course-storage"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { HexColorPicker } from "react-colorful"
import React from "react"
import html2canvas from "html2canvas"
import { format } from "date-fns"

// Time slot constants
const DAYS = ["M", "Tu", "W", "Th", "F", "S"] as const;
type DayToken = typeof DAYS[number];

const DAY_FILTER_OPTIONS: { value: DayToken; label: string; longLabel: string }[] = [
  { value: "M", label: "Mon", longLabel: "Monday" },
  { value: "Tu", label: "Tue", longLabel: "Tuesday" },
  { value: "W", label: "Wed", longLabel: "Wednesday" },
  { value: "Th", label: "Thu", longLabel: "Thursday" },
  { value: "F", label: "Fri", longLabel: "Friday" },
  { value: "S", label: "Sat", longLabel: "Saturday" },
]

const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", 
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", 
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00"
]

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

const GROUP_BY_OPTIONS = [
  { value: "department", label: "Department" },
  { value: "section", label: "Section" },
  { value: "courseCode", label: "Course Code" },
  { value: "room", label: "Room" },
] as const

type GroupByOption = typeof GROUP_BY_OPTIONS[number]["value"]

const GROUP_LABELS: Record<GroupByOption, string> = {
  department: "Department",
  section: "Section",
  courseCode: "Course Code",
  room: "Room",
}

// Helper to calculate time slot position
const getTimePosition = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours - 7) * 2 + (minutes / 30)
}

// Calculate duration in 30-min slots
const getDurationSlots = (start: string, end: string) => {
  return getTimePosition(end) - getTimePosition(start)
}

type CourseDetail = (typeof initialCourses)[number]

const getCanonicalCourseCode = (courseCode: string): string => {
  return resolveCanonicalCourseCode(courseCode || "")
}

const getCourseDetails = (courseCode: string): CourseDetail | null => {
  return (getCourseDetailsByCode(courseCode) as CourseDetail | null) || null
}

const getCourseNameAndCredits = (courseCode: string) => {
  const details = getCourseDetails(courseCode)
  return {
    name: details?.name || "Unknown Course",
    credits: details?.credits || 3,
  }
}

const getSelectedCourseCanonicalCode = (course: SelectedCourse) => {
  return course.canonicalCode || getCanonicalCourseCode(course.courseCode)
}

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
  canonicalCode: string
  name: string
  credits: number
  timeStart: string
  timeEnd: string
  startMinutes: number
  endMinutes: number
  parsedDays: DayToken[]
  displayTime: string
  displayRoom: string
}

interface CourseCustomization {
  customTitle?: string
  color?: string
}

interface GroupedCourseSet {
  value: string
  courses: CourseSection[]
}

interface ApplyAvailableCoursesOptions {
  lastUpdated?: number | null
  expired?: boolean
  preserveError?: boolean
  skipTimestamp?: boolean
  forceUpdate?: boolean
  isSampleData?: boolean
}

interface ExportedSelectedCourse {
  courseCode: string
  section: string
  meetingDays: string
  meetingTime: string
  room: string
  customTitle?: string | null
  customColor?: string | null
}

interface SelectedCourseExportPayload {
  version: number
  generatedAt: string
  courses: ExportedSelectedCourse[]
}

const SELECTED_COURSE_EXPORT_VERSION = 1
const STALE_IMPORT_NOTICE_STORAGE_KEY = "scheduleMaker.staleImportNotice"

interface ImportDialogConfig {
  title: string
  message: string
  onAcknowledge?: () => void
}

const buildCourseSignature = (course: CourseSection) => {
  if (!course) return ""
  return [
    course.courseCode || "",
    course.section || "",
    course.meetingDays || "",
    course.meetingTime || "",
    course.remainingSlots || "",
    course.hasSlots ? "1" : "0",
    course.room || "",
  ]
    .map((segment) => segment.toString().trim().toUpperCase())
    .join("|")
}

const computeCourseSetHash = (courses: CourseSection[]) => {
  if (!Array.isArray(courses) || courses.length === 0) return ""
  return courses.map(buildCourseSignature).join("::")
}


// Sample data for available courses - used as fallback
const sampleAvailableCourses = [
  {
    courseCode: "CPE0011",
    section: "TE21",
    classSize: "",
    remainingSlots: "",
    meetingDays: "F / T",
    meetingTime: "07:00:00-08:50:00 / 07:00:00-08:50:00",
    room: "ONLINE / ONLINE",
    hasSlots: true,
  },
  {
    courseCode: "CPE0011L",
    section: "TE21",
    classSize: "",
    remainingSlots: "",
    meetingDays: "W",
    meetingTime: "09:00:00-11:50:00",
    room: "F904",
    hasSlots: true,
  },
  {
    courseCode: "CPE0033L",
    section: "TE31A",
    classSize: "",
    remainingSlots: "",
    meetingDays: "M / TH",
    meetingTime: "07:00:00-09:50:00 / 07:00:00-09:50:00",
    room: "E609 / E609",
    hasSlots: true,
  },
  {
    courseCode: "CPE0039L",
    section: "TE31A",
    classSize: "",
    remainingSlots: "",
    meetingDays: "M",
    meetingTime: "14:00:00-16:50:00",
    room: "F1103",
    hasSlots: true,
  },
  {
    courseCode: "COE0049",
    section: "TT31",
    classSize: "",
    remainingSlots: "",
    meetingDays: "F / T",
    meetingTime: "11:00:00-12:20:00 / 11:00:00-12:20:00",
    room: "ONLINE / ASYNCH",
    hasSlots: true,
  },
  {
    courseCode: "COE0019",
    section: "M193",
    classSize: "",
    remainingSlots: "",
    meetingDays: "M / TH",
    meetingTime: "11:00:00-12:50:00 / 11:00:00-12:50:00",
    room: "F712 / F712",
    hasSlots: true,
  },
]

const QuickNavigation = ({ showBackToTop = false }: { showBackToTop?: boolean }) => {
  const handleScrollTop = () => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link href="/">
        <Button variant="outline" className="w-full sm:w-auto flex items-center gap-2 bg-transparent">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </Link>
      <Link href="/course-tracker">
        <Button className="w-full sm:w-auto bg-blue-700 dark:bg-blue-900 bg-gradient-to-r from-blue-600 to-blue-800 hover:bg-blue-800 dark:hover:bg-blue-950 hover:from-blue-700 hover:to-blue-900 text-white flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Course Tracker
        </Button>
      </Link>
      <Link href="/academic-planner">
        <Button className="w-full sm:w-auto bg-green-700 dark:bg-green-900 bg-gradient-to-r from-green-600 to-green-800 hover:bg-green-800 dark:hover:bg-green-950 hover:from-green-700 hover:to-green-900 text-white flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Academic Planner
        </Button>
      </Link>
      {showBackToTop && (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto flex items-center gap-2"
          onClick={handleScrollTop}
        >
          <ArrowUp className="h-4 w-4" />
          Back to Top
        </Button>
      )}
    </div>
  )
}

// Extract department codes from course codes
const extractDepartmentCode = (courseCode: string): string => {
  const match = courseCode.match(/^[A-Z]+/)
  return match ? match[0] : "OTHER"
}

// Updated day mapping
const dayAbbreviationToDay = {
  M: 1,    // Monday
  Tu: 2,   // Tuesday
  W: 3,    // Wednesday
  Th: 4,   // Thursday
  F: 5,    // Friday
  S: 6,    // Saturday
}

// New robust day parser
function parseDays(daysString: string): DayToken[] {
  const tokens: DayToken[] = [];
  let i = 0;
  const s = daysString.toUpperCase().replace(/\s+/g, '');

  while (i < s.length) {
    if (s[i] === 'M') {
      tokens.push('M');
      i++;
    } 
    else if (s[i] === 'W') {
      tokens.push('W');
      i++;
    }
    else if (s[i] === 'F') {
      tokens.push('F');
      i++;
    }
    else if (s[i] === 'S') {
      tokens.push('S');
      i++;
    }
    else if (s[i] === 'T') {
      // Check for Thursday
      if (i + 1 < s.length && s[i+1] === 'H') {
        tokens.push('Th');
        i += 2;
      } 
      // Otherwise it's Tuesday
      else {
        tokens.push('Tu');
        i++;
      }
    }
    else {
      // Skip invalid characters but warn
      console.warn(`Invalid day character: ${s[i]} in "${daysString}"`);
      i++;
    }
  }

  return tokens;
}

// Day string validator
function validateDayString(days: string): boolean {
  const validPattern = /^([MTWFS]|TU|TH)+$/i;
  return validPattern.test(days.replace(/\s+/g, ''));
}

// Helper function to determine text color based on background color
const getContrastColor = (hexColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(hexColor.substr(1, 2), 16)
  const g = parseInt(hexColor.substr(3, 2), 16)
  const b = parseInt(hexColor.substr(5, 2), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black or white depending on luminance
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export default function ScheduleMaker() {
  const { theme, setTheme } = useTheme()

  const [availableCourses, setAvailableCourses] = useState<CourseSection[]>([])
  const [activeCourses, setActiveCourses] = useState<ActiveCourse[]>([])
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([])
  const [customizations, setCustomizations] = useState<Record<string, CourseCustomization>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [noDataDialogOpen, setNoDataDialogOpen] = useState(false)
  const [noDataDialogPaused, setNoDataDialogPaused] = useState(false)
  const [hideNoDataDialog, setHideNoDataDialog] = useState(false)
  const [awaitingDataDialogOpen, setAwaitingDataDialogOpen] = useState(false)
  const [hasRealCourseData, setHasRealCourseData] = useState(false)
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false)
  const [noDataDialogDismissed, setNoDataDialogDismissed] = useState(false)
  const [noActiveDialogOpen, setNoActiveDialogOpen] = useState(false)
  const [hideNoActiveDialog, setHideNoActiveDialog] = useState(false)
  const [noActiveDialogDismissed, setNoActiveDialogDismissed] = useState(false)
  const [viewMode, setViewMode] = useState<"card" | "table">("card")
  const [selectedViewMode, setSelectedViewMode] = useState<"card" | "table">("card")
  const scheduleRef = useRef<HTMLDivElement>(null)
  const lastAvailableHashRef = useRef<string>("")
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingImportFollowUpRef = useRef<(() => void) | null>(null)
  const [showOnlyActive, setShowOnlyActive] = useState(true)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("department")
  const [sortOrder, setSortOrder] = useState("asc")
  const [groupBy, setGroupBy] = useState<GroupByOption>("department")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [dayFilters, setDayFilters] = useState<DayToken[]>([])
  const [isClient, setIsClient] = useState(false)
  const [editingCourse, setEditingCourse] = useState<SelectedCourse | null>(null)
  const [tempCustomTitle, setTempCustomTitle] = useState("")
  const [tempCustomColor, setTempCustomColor] = useState("#3b82f6")
  const [scheduleTitle, setScheduleTitle] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('scheduleTitle') || 'Weekly Schedule' : 'Weekly Schedule'
  )
  const [curriculumSignature, setCurriculumSignature] = useState<string>("")
  const [importStatus, setImportStatus] = useState<null | { type: "success" | "warning" | "error"; message: string }>(null)
  const [importErrorDialog, setImportErrorDialog] = useState<ImportDialogConfig | null>(null)
  const [staleImportNotice, setStaleImportNotice] = useState<string | null>(null)
  const [icsDialogOpen, setIcsDialogOpen] = useState(false)
  const [icsDialogStartDate, setIcsDialogStartDate] = useState<string>("")
  const [icsDialogError, setIcsDialogError] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }, [])


  const persistStaleImportNotice = useCallback((message: string | null) => {
    setStaleImportNotice(message)
    if (typeof window === "undefined") return
    if (message) {
      localStorage.setItem(STALE_IMPORT_NOTICE_STORAGE_KEY, message)
    } else {
      localStorage.removeItem(STALE_IMPORT_NOTICE_STORAGE_KEY)
    }
  }, [])

  const dismissStaleImportNotice = useCallback(() => {
    persistStaleImportNotice(null)
  }, [persistStaleImportNotice])

  const closeImportDialog = useCallback(() => {
    setImportErrorDialog((prev) => {
      if (prev?.onAcknowledge) {
        pendingImportFollowUpRef.current = prev.onAcknowledge
      } else {
        pendingImportFollowUpRef.current = null
      }
      return null
    })
  }, [])

  useEffect(() => {
    if (!importErrorDialog && pendingImportFollowUpRef.current) {
      const followUp = pendingImportFollowUpRef.current
      pendingImportFollowUpRef.current = null
      setTimeout(() => followUp(), 0)
    }
  }, [importErrorDialog])

  useEffect(() => {
    if (typeof window === "undefined") return
    setHideNoDataDialog(localStorage.getItem("scheduleMaker.hideNoDataDialog") === "true")
    setHideNoActiveDialog(localStorage.getItem("scheduleMaker.hideNoActiveDialog") === "true")
    const storedNotice = localStorage.getItem(STALE_IMPORT_NOTICE_STORAGE_KEY)
    if (storedNotice) {
      setStaleImportNotice(storedNotice)
    }
  }, [])

  const noActiveCourses = activeCourses.length === 0

  useEffect(() => {
    const missingExtractedData = hasFetchedOnce && !hasRealCourseData
    const shouldShow =
      !hideNoDataDialog &&
      !noDataDialogPaused &&
      !noDataDialogDismissed &&
      missingExtractedData
    setNoDataDialogOpen(shouldShow)
  }, [hasFetchedOnce, hideNoDataDialog, noDataDialogPaused, hasRealCourseData, noDataDialogDismissed])

  useEffect(() => {
    const shouldShowNoActive =
      hasFetchedOnce &&
      hasRealCourseData &&
      noActiveCourses &&
      !hideNoActiveDialog &&
      !noActiveDialogDismissed

    setNoActiveDialogOpen(shouldShowNoActive)

    if (!noActiveCourses) {
      setNoActiveDialogDismissed(false)
    }
  }, [hasFetchedOnce, hasRealCourseData, noActiveCourses, hideNoActiveDialog, noActiveDialogDismissed])

  useEffect(() => {
    if (!awaitingDataDialogOpen) {
      setNoDataDialogPaused(false)
    }
  }, [awaitingDataDialogOpen])

  useEffect(() => {
    if (hasRealCourseData) {
      setNoDataDialogDismissed(false)
    }
  }, [hasRealCourseData])

  useEffect(() => {
    if (hasRealCourseData) {
      persistStaleImportNotice(null)
    }
  }, [hasRealCourseData, persistStaleImportNotice])

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load data from localStorage only on the client side
  const clearScheduleSelections = useCallback(() => {
    setSelectedCourses([])
    setCustomizations({})
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("scheduleMakerData")
      } catch (error) {
        console.error("Error clearing saved schedule data:", error)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedSchedule = localStorage.getItem("scheduleMakerData")
        const storedSignature = loadCurriculumSignature()
        let scheduleCurriculumMismatch = false
        if (savedSchedule) {
          const parsed = JSON.parse(savedSchedule)
          if (
            parsed?.curriculumSignature &&
            storedSignature &&
            parsed.curriculumSignature !== storedSignature
          ) {
            scheduleCurriculumMismatch = true
          } else {
            if (parsed.selectedCourses) {
              const normalizedCourses = (parsed.selectedCourses as SelectedCourse[]).map((stored) =>
                normalizeSelectedCourse(stored),
              )
              setSelectedCourses(normalizedCourses)
            }
            if (parsed.customizations) {
              setCustomizations(parsed.customizations || {})
            }
          }
        }

        if (scheduleCurriculumMismatch) {
          clearScheduleSelections()
        }
        setCurriculumSignature(storedSignature)

        const filterCourseCode = localStorage.getItem("filterCourseCode")
        if (filterCourseCode) {
          setSearchTerm(filterCourseCode)
          localStorage.removeItem("filterCourseCode")
        }
      } catch (err) {
        console.error("Error loading schedule from localStorage:", err)
      }
    }
  }, [clearScheduleSelections])

  // Save to localStorage whenever selectedCourses or customizations change
  useEffect(() => {
    if (typeof window !== "undefined" && isClient) {
      try {
        const latestSignature = loadCurriculumSignature()
        if (latestSignature !== curriculumSignature) {
          setCurriculumSignature(latestSignature)
        }
        localStorage.setItem(
          "scheduleMakerData",
          JSON.stringify({
            version: 1,
            selectedCourses,
            customizations,
            curriculumSignature: latestSignature,
          }),
        )
      } catch (err) {
        console.error("Error saving to localStorage:", err)
      }
    }
  }, [selectedCourses, customizations, isClient, curriculumSignature])

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
      return time24.split(" / ").map(t => convertTo12Hour(t)).join(" / ")
    }
    
    // Convert single time
    const [hours, minutes] = time24.split(":")
    const hourNum = parseInt(hours, 10)
    
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
    const uniqueRooms = [...new Set(rooms.map(room => room.trim()))]
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

  const timePartRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i

  const parseTimeToMinutes = (time: string): number => {
    const match = timePartRegex.exec(time.trim())
    if (!match) return Number.NaN
    let hours = Number.parseInt(match[1], 10)
    const minutes = Number.parseInt(match[2], 10)
    const meridiem = match[4]?.toUpperCase()

    if (meridiem === "PM" && hours < 12) hours += 12
    if (meridiem === "AM" && hours === 12) hours = 0

    return hours * 60 + minutes
  }

  const minutesToTimeString = (minutes: number): string => {
    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
    const hrs = Math.floor(normalized / 60)
    const mins = normalized % 60
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
  }

  // Parse time string (e.g., "10:00:00-11:30:00") into start/end labels and minute values
  const parseTimeRange = (
    timeString: string,
  ): { start: string; end: string; startMinutes: number; endMinutes: number } => {
    if (!timeString) {
      return { start: "00:00", end: "00:00", startMinutes: Number.NaN, endMinutes: Number.NaN }
    }

    const parts = timeString.split("-")
    const rawStart = parts[0] ?? ""
    const rawEnd = parts[1] ?? parts[0] ?? ""

    const primaryStart = rawStart.split("/")[0]
    const primaryEnd = rawEnd.split("/")[0]

    const startMinutes = parseTimeToMinutes(primaryStart)
    const endMinutes = parseTimeToMinutes(primaryEnd)

    return {
      start: Number.isNaN(startMinutes) ? primaryStart.trim().slice(0, 5) : minutesToTimeString(startMinutes),
      end: Number.isNaN(endMinutes) ? primaryEnd.trim().slice(0, 5) : minutesToTimeString(endMinutes),
      startMinutes,
      endMinutes,
    }
  }

  const normalizeSelectedCourse = (course: any): SelectedCourse => {
    const rangeSource = course?.meetingTime ?? `${course?.timeStart ?? ""}-${course?.timeEnd ?? ""}`
    const derivedRange = parseTimeRange(rangeSource)
    const canonicalCode =
      typeof course?.canonicalCode === "string" && course.canonicalCode.trim() !== ""
        ? getCanonicalCourseCode(course.canonicalCode)
        : getCanonicalCourseCode(course?.courseCode ?? "")

    const startLabelCandidate = course?.timeStart ?? derivedRange.start
    const endLabelCandidate = course?.timeEnd ?? derivedRange.end

    const timeStart = startLabelCandidate && startLabelCandidate.trim() !== ""
      ? startLabelCandidate.trim()
      : "00:00"
    const timeEnd = endLabelCandidate && endLabelCandidate.trim() !== ""
      ? endLabelCandidate.trim()
      : "00:00"

    const startMinutes =
      typeof course?.startMinutes === "number" && !Number.isNaN(course.startMinutes)
        ? course.startMinutes
        : (!Number.isNaN(derivedRange.startMinutes)
            ? derivedRange.startMinutes
            : parseTimeToMinutes(timeStart))

    const endMinutes =
      typeof course?.endMinutes === "number" && !Number.isNaN(course.endMinutes)
        ? course.endMinutes
        : (!Number.isNaN(derivedRange.endMinutes)
            ? derivedRange.endMinutes
            : parseTimeToMinutes(timeEnd))

    const parsedDays =
      Array.isArray(course?.parsedDays) && course.parsedDays.length > 0
        ? course.parsedDays
        : parseDays(course?.meetingDays ?? "")

    const { name: defaultName, credits: defaultCredits } = getCourseNameAndCredits(course?.courseCode ?? canonicalCode)
    const normalizedName =
      typeof course?.name === "string" && course.name.trim() !== ""
        ? course.name
        : defaultName
    const normalizedCredits =
      typeof course?.credits === "number" && !Number.isNaN(course.credits)
        ? course.credits
        : defaultCredits

    return {
      ...course,
      canonicalCode,
      name: normalizedName,
      credits: normalizedCredits,
      timeStart,
      timeEnd,
      startMinutes,
      endMinutes,
      parsedDays,
      displayTime: course?.displayTime ?? cleanTimeString(course?.meetingTime ?? `${timeStart}-${timeEnd}`),
      displayRoom: course?.displayRoom ?? cleanRoomString(course?.room ?? ""),
    } as SelectedCourse
  }

  // Enhanced conflict detection
  const hasScheduleConflict = (course: CourseSection): boolean => {
    if (!course.meetingTime || !course.meetingDays) return false

    const { start: newStart, end: newEnd, startMinutes: newStartMinutes, endMinutes: newEndMinutes } = parseTimeRange(course.meetingTime)
    const newDays = parseDays(course.meetingDays)
    const hasNumericRange = !Number.isNaN(newStartMinutes) && !Number.isNaN(newEndMinutes)
    const canonicalCode = getCanonicalCourseCode(course.courseCode)

    return selectedCourses.some((selected) => {
      if (getSelectedCourseCanonicalCode(selected) === canonicalCode) return false

      // Convert both day sets to Sets for efficient lookup
      const selectedDaysSet = new Set(selected.parsedDays)
      const newDaysSet = new Set(newDays)

      // Check if any days overlap
      const daysOverlap = [...newDaysSet].some(day => selectedDaysSet.has(day))
      if (!daysOverlap) return false

      const selectedStartMinutes =
        typeof selected.startMinutes === "number" && !Number.isNaN(selected.startMinutes)
          ? selected.startMinutes
          : parseTimeToMinutes(selected.timeStart)

      const selectedEndMinutes =
        typeof selected.endMinutes === "number" && !Number.isNaN(selected.endMinutes)
          ? selected.endMinutes
          : parseTimeToMinutes(selected.timeEnd)

      const canCompareNumeric =
        hasNumericRange &&
        !Number.isNaN(selectedStartMinutes) &&
        !Number.isNaN(selectedEndMinutes)

      if (canCompareNumeric) {
        return (
          (newStartMinutes >= selectedStartMinutes && newStartMinutes < selectedEndMinutes) ||
          (newEndMinutes > selectedStartMinutes && newEndMinutes <= selectedEndMinutes) ||
          (newStartMinutes <= selectedStartMinutes && newEndMinutes >= selectedEndMinutes)
        )
      }

      // Fallback to string comparison when timing data cannot be parsed reliably
      return (
        (newStart >= selected.timeStart && newStart < selected.timeEnd) ||
        (newEnd > selected.timeStart && newEnd <= selected.timeEnd) ||
        (newStart <= selected.timeStart && newEnd >= selected.timeEnd)
      )
    })
  }

  // Check if a course with the same code is already selected
  const hasSameCourseCode = (course: CourseSection): boolean => {
    const canonicalCode = getCanonicalCourseCode(course.courseCode)
    return selectedCourses.some((selected) => getSelectedCourseCanonicalCode(selected) === canonicalCode)
  }

  // Get the selected course with the same code
  const getSelectedCourseWithSameCode = (course: CourseSection): SelectedCourse | undefined => {
    const canonicalCode = getCanonicalCourseCode(course.courseCode)
    return selectedCourses.find((selected) => getSelectedCourseCanonicalCode(selected) === canonicalCode)
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
        // sortBy is a dynamic key — narrow to keyof CourseSection when possible
        const key = sortBy as keyof CourseSection
        // @ts-ignore access via dynamic key
        valueA = (a as any)[key]
        // @ts-ignore
        valueB = (b as any)[key]
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
    const canonicalCode = getCanonicalCourseCode(course.courseCode)
    const existingCourse = selectedCourses.find((selected) => getSelectedCourseCanonicalCode(selected) === canonicalCode)

    const { start, end, startMinutes, endMinutes } = parseTimeRange(course.meetingTime)
    const parsedDays = parseDays(course.meetingDays)
    const metadata = getCourseNameAndCredits(course.courseCode)
    
    const newCourse: SelectedCourse = {
      ...course,
      canonicalCode,
      name: metadata.name,
      credits: metadata.credits,
      timeStart: start,
      timeEnd: end,
      startMinutes,
      endMinutes,
      parsedDays,
      displayTime: cleanTimeString(course.meetingTime),
      displayRoom: cleanRoomString(course.room),
    }

    if (existingCourse) {
      setSelectedCourses((prev) =>
        prev.map((selected) =>
          getSelectedCourseCanonicalCode(selected) === canonicalCode ? newCourse : selected
        )
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

  const buildSelectedCourseExportPayload = (): SelectedCourseExportPayload => {
    const courses: ExportedSelectedCourse[] = selectedCourses.map((course) => {
      const key = `${course.courseCode}-${course.section}`
      const customization = customizations[key] || {}
      return {
        courseCode: course.courseCode,
        section: course.section,
        meetingDays: course.meetingDays,
        meetingTime: course.meetingTime,
        room: course.room,
        customTitle: customization.customTitle || null,
        customColor: customization.color || null,
      }
    })

    return {
      version: SELECTED_COURSE_EXPORT_VERSION,
      generatedAt: new Date().toISOString(),
      courses,
    }
  }

  const handleExportSelectedCourses = () => {
    if (selectedCourses.length === 0) {
      setImportStatus({ type: "warning", message: "Add at least one course before exporting selections." })
      return
    }

    try {
      const payload = buildSelectedCourseExportPayload()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `selected-courses-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setImportStatus({ type: "success", message: "Exported selected courses." })
    } catch (err) {
      console.error("Failed to export selected courses:", err)
      setImportStatus({ type: "error", message: "Failed to export selected courses." })
    }
  }

  const triggerImportSelectedCourses = () => {
    if (selectedCourses.length === 0) {
      setImportErrorDialog({
        title: "Selected courses empty",
        message:
          "We recommend importing saved selections only after you've added at least one course so it's easier to verify matches. We'll open the file picker once you dismiss this reminder.",
        onAcknowledge: () => importFileInputRef.current?.click(),
      })
      return
    }
    importFileInputRef.current?.click()
  }

  const handleImportSelectedCourses: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Unsupported file type. Please upload a JSON export from Schedule Maker.")
      }

      if (availableCourses.length === 0) {
        throw new Error("No extracted course data available. Refresh data before importing selections.")
      }

      const text = await file.text()
      const parsed = JSON.parse(text)
      const candidateCourses: ExportedSelectedCourse[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.courses)
          ? parsed.courses
          : []

      if (candidateCourses.length === 0) {
        throw new Error("No course entries found in the imported file.")
      }

      let applied = 0
      let skippedMissing = 0
      let skippedInvalid = 0
      let updatedDetails = 0
      const customizationUpdates: Record<string, CourseCustomization> = {}
      const seenKeys = new Set<string>()

      candidateCourses.forEach((entry) => {
        const courseCode = typeof entry?.courseCode === "string" ? entry.courseCode.trim() : ""
        const section = typeof entry?.section === "string" ? entry.section.trim() : ""
        if (!courseCode || !section) {
          skippedInvalid += 1
          return
        }

        const lookup = availableCourses.find(
          (course) =>
            course.courseCode.trim().toUpperCase() === courseCode.toUpperCase() &&
            course.section.trim().toUpperCase() === section.toUpperCase(),
        )

        if (!lookup) {
          skippedMissing += 1
          return
        }

        const key = `${lookup.courseCode}-${lookup.section}`
        if (!seenKeys.has(key)) {
          addCourse(lookup)
          seenKeys.add(key)
          applied += 1
        }

        const sanitizedTitle = typeof entry.customTitle === "string" ? entry.customTitle : undefined
        const sanitizedColor = typeof entry.customColor === "string" ? entry.customColor : undefined
        if (sanitizedTitle !== undefined || sanitizedColor !== undefined) {
          customizationUpdates[key] = {
            ...customizationUpdates[key],
            ...(customizations[key] || {}),
            ...(sanitizedTitle !== undefined ? { customTitle: sanitizedTitle } : {}),
            ...(sanitizedColor !== undefined ? { color: sanitizedColor } : {}),
          }
        }

        const changedDetails =
          (entry.meetingDays && entry.meetingDays !== lookup.meetingDays) ||
          (entry.meetingTime && entry.meetingTime !== lookup.meetingTime) ||
          (entry.room && entry.room !== lookup.room)
        if (changedDetails) {
          updatedDetails += 1
        }
      })

      if (Object.keys(customizationUpdates).length > 0) {
        setCustomizations((prev) => ({
          ...prev,
          ...customizationUpdates,
        }))
      }

      if (applied === 0 && skippedMissing === 0 && skippedInvalid === 0) {
        throw new Error("No valid course entries found in the imported file.")
      }

      const parts: string[] = []
      if (applied > 0) parts.push(`Imported ${applied} course${applied === 1 ? "" : "s"}.`)
      if (updatedDetails > 0)
        parts.push(`${updatedDetails} course${updatedDetails === 1 ? "" : "s"} had updated schedule details.`)
      if (skippedMissing > 0)
        parts.push(`${skippedMissing} entr${skippedMissing === 1 ? "y was" : "ies were"} not found in the latest extraction.`)
      if (skippedInvalid > 0)
        parts.push(`${skippedInvalid} entr${skippedInvalid === 1 ? "y was" : "ies were"} invalid.`)

      let statusType:
        | "success"
        | "warning"
        | "error" = skippedMissing > 0 || skippedInvalid > 0 ? (applied > 0 ? "warning" : "error") : "success"

      if (!hasRealCourseData) {
        const staleMessage =
          "Latest extracted data is unavailable, so slot counts and schedules might have changed. Refresh with the extension when possible."
        parts.push(staleMessage)
        persistStaleImportNotice(staleMessage)
        if (statusType === "success") {
          statusType = "warning"
        }
      } else {
        persistStaleImportNotice(null)
      }

      setImportStatus({ type: statusType, message: parts.join(" ") })
    } catch (err: any) {
      console.error("Failed to import selected courses:", err)
      const message = err?.message || "Failed to import selected courses."
      setImportStatus({ type: "error", message })
      setImportErrorDialog({ title: "Import error", message })
    } finally {
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  // New ICS file generator
  const downloadICSFile = (baseStartDate: Date = startDate) => {
    if (selectedCourses.length === 0) return

    const pad = (value: number) => String(value).padStart(2, "0")
    const escapeText = (value: string) =>
      value
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")

    const daysToWeekday = (day: DayToken) => {
      switch (day) {
        case "M":
          return { weekday: 1, code: "MO" }
        case "Tu":
          return { weekday: 2, code: "TU" }
        case "W":
          return { weekday: 3, code: "WE" }
        case "Th":
          return { weekday: 4, code: "TH" }
        case "F":
          return { weekday: 5, code: "FR" }
        case "S":
          return { weekday: 6, code: "SA" }
        default:
          return { weekday: 1, code: "MO" }
      }
    }

    const getNextDateForWeekday = (baseDate: Date, targetWeekday: number) => {
      const date = new Date(baseDate)
      const currentWeekday = date.getDay() === 0 ? 7 : date.getDay()
      const delta = (targetWeekday + 7 - currentWeekday) % 7
      date.setDate(date.getDate() + delta)
      return date
    }

    const formatDateTime = (date: Date, timeLabel: string) => {
      const [hourRaw, minuteRaw] = timeLabel.split(":").map(Number)
      const hours = Number.isFinite(hourRaw) ? hourRaw : 0
      const minutes = Number.isFinite(minuteRaw) ? minuteRaw : 0
      const target = new Date(date)
      target.setHours(hours, minutes, 0, 0)
      return `${target.getFullYear()}${pad(target.getMonth() + 1)}${pad(target.getDate())}T${pad(target.getHours())}${pad(target.getMinutes())}00`
    }

    const timezone = "Asia/Manila"
    const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"

    const events = selectedCourses.flatMap((course, courseIndex) => {
      const dayInfo = course.parsedDays.length
        ? course.parsedDays.map(daysToWeekday)
        : [{ weekday: 1, code: "MO" }]

      const customizationKey = `${course.courseCode}-${course.section}`
      const summary =
        customizations[customizationKey]?.customTitle || `${course.courseCode} - ${course.name}`
      const description = `Section: ${course.section}\nRoom: ${course.displayRoom}`

      return dayInfo.map((day, dayIndex) => {
        const eventDate = getNextDateForWeekday(baseStartDate, day.weekday)
        const uid = `${course.courseCode}-${course.section}-${day.code}-${courseIndex}-${dayIndex}@compareng-tools`

        return [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `SUMMARY:${escapeText(summary)}`,
          `DESCRIPTION:${escapeText(description)}`,
          `LOCATION:${escapeText(course.displayRoom || "TBA")}`,
          `DTSTART;TZID=${timezone}:${formatDateTime(eventDate, course.timeStart)}`,
          `DTEND;TZID=${timezone}:${formatDateTime(eventDate, course.timeEnd)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${day.code};COUNT=15`,
          "BEGIN:VALARM",
          "TRIGGER:-PT1H",
          "ACTION:DISPLAY",
          "DESCRIPTION:Reminder",
          "END:VALARM",
          "END:VEVENT",
        ].join("\r\n")
      })
    })

    const calendarContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "PRODID:-//ComParEng Tools//Schedule Maker//EN",
      `X-WR-CALNAME:${escapeText(scheduleTitle || "Weekly Schedule")}`,
      `X-WR-TIMEZONE:${timezone}`,
      ...events,
      "END:VCALENDAR",
    ].join("\r\n")

    const blob = new Blob([calendarContent], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `schedule-${new Date().toISOString().slice(0, 10)}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const openIcsDialog = () => {
    setIcsDialogStartDate(startDate.toISOString().split('T')[0])
    setIcsDialogError(null)
    setIcsDialogOpen(true)
  }

  const handleCloseIcsDialog = () => {
    setIcsDialogOpen(false)
    setIcsDialogError(null)
  }

  const handleConfirmIcsDownload = () => {
    if (!icsDialogStartDate) {
      setIcsDialogError('Please pick a start date.')
      return
    }

    const chosenDate = new Date(icsDialogStartDate)
    if (Number.isNaN(chosenDate.getTime())) {
      setIcsDialogError('Invalid start date.')
      return
    }

    setStartDate(chosenDate)
    downloadICSFile(chosenDate)
    setIcsDialogOpen(false)
  }

  // Dynamically group courses based on user preference
  const groupCourses = (courses: CourseSection[]): GroupedCourseSet[] => {
    const grouped = courses.reduce(
      (acc, course) => {
        let key = ""
        switch (groupBy) {
          case "section":
            key = course.section?.trim() || "Unspecified"
            break
          case "courseCode":
            key = course.courseCode?.trim() || "Unspecified"
            break
          case "room":
            key = cleanRoomString(course.room || "") || "Unspecified"
            break
          case "department":
          default:
            key = extractDepartmentCode(course.courseCode) || "Unspecified"
        }

        if (!acc[key]) acc[key] = []
        acc[key].push(course)
        return acc
      },
      {} as Record<string, CourseSection[]>,
    )

    return Object.entries(grouped)
      .sort(([valueA], [valueB]) => valueA.localeCompare(valueB))
      .map(([value, groupedCourses]): GroupedCourseSet => {
        const normalizedValue = value && value.trim() ? value : "Unspecified"
        return {
          value: normalizedValue,
          courses: groupedCourses,
        }
      })
  }

  const groupCoursesByDepartment = (courses: CourseSection[]): GroupedCourseSet[] => {
    return groupCourses(courses)
  }

  const dayFilterSet = React.useMemo(() => new Set(dayFilters), [dayFilters])

  const toggleDayFilter = (day: DayToken) => {
    setDayFilters((prev) =>
      prev.includes(day) ? prev.filter((existing) => existing !== day) : [...prev, day]
    )
  }

  const clearDayFilters = () => setDayFilters([])

  const getFilteredAndSortedCourses = () => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const filtered = filteredCourses.filter((course) => {
      const courseDetails = getCourseDetails(course.courseCode)
      const courseName = (courseDetails?.name || "").toLowerCase()
      const sectionValue = (course.section || "").toLowerCase()
      const meetingDaysValue = (course.meetingDays || "").toLowerCase()
      const meetingTimeRaw = (course.meetingTime || "").toLowerCase()
      const meetingTimeDisplay = cleanTimeString(course.meetingTime).toLowerCase()
      const roomValue = cleanRoomString(course.room).toLowerCase()

      const matchesSearch =
        normalizedSearch === "" ||
        course.courseCode.toLowerCase().includes(normalizedSearch) ||
        courseName.includes(normalizedSearch) ||
        sectionValue.includes(normalizedSearch) ||
        meetingDaysValue.includes(normalizedSearch) ||
        meetingTimeRaw.includes(normalizedSearch) ||
        meetingTimeDisplay.includes(normalizedSearch) ||
        roomValue.includes(normalizedSearch)

      const matchesDepartment =
        selectedDepartment === "all" || extractDepartmentCode(course.courseCode) === selectedDepartment

      const matchesDay =
        dayFilterSet.size === 0 ||
        parseDays(course.meetingDays).some((day) => dayFilterSet.has(day))

      return matchesSearch && matchesDepartment && matchesDay
    })

    return sortCourses(filtered)
  }

  // Open the student portal course offerings page
  const openStudentPortal = () => {
    window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")
  }

  const openCourseTracker = () => {
    window.open("/course-tracker", "_blank")
  }

  const handleStudentPortalLaunch = () => {
    openStudentPortal()
    setAwaitingDataDialogOpen(true)
    setNoDataDialogPaused(true)
  }

  const handleNoDataDialogToggle = (checked: boolean) => {
    setHideNoDataDialog(checked)
    if (typeof window !== "undefined") {
      localStorage.setItem("scheduleMaker.hideNoDataDialog", checked ? "true" : "false")
    }
    if (checked) {
      setNoDataDialogOpen(false)
      setNoDataDialogDismissed(true)
    } else {
      setNoDataDialogDismissed(false)
    }
  }

  const handleNoDataDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNoDataDialogDismissed(false)
      setNoDataDialogOpen(true)
      return
    }
    setNoDataDialogOpen(false)
    setNoDataDialogDismissed(true)
  }

  const handleNoActiveDialogToggle = (checked: boolean) => {
    setHideNoActiveDialog(checked)
    if (typeof window !== "undefined") {
      localStorage.setItem("scheduleMaker.hideNoActiveDialog", checked ? "true" : "false")
    }
    if (checked) {
      setNoActiveDialogOpen(false)
      setNoActiveDialogDismissed(true)
    } else {
      setNoActiveDialogDismissed(false)
    }
  }

  const handleNoActiveDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNoActiveDialogDismissed(false)
      setNoActiveDialogOpen(true)
      return
    }
    setNoActiveDialogOpen(false)
    setNoActiveDialogDismissed(true)
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
  const fetchAvailableCourses = useCallback(async () => {
    try {
      const response = await fetch("/api/get-available-courses", {
        method: "GET",
        cache: "no-store",
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
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch available courses")
      }

      const payload: CourseSection[] = Array.isArray(result.data) ? result.data : []
      payload.forEach((course: CourseSection) => {
        if (!validateDayString(course.meetingDays)) {
          console.warn(`Invalid day format for ${course.courseCode}: ${course.meetingDays}`)
        }
      })

      const parseTimestamp = (value: any) => {
        if (!value) return null
        if (typeof value === "number") return value
        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      return {
        data: payload,
        lastUpdated: parseTimestamp(result.lastUpdated),
        expired: Boolean(result.isExpired),
      }
    } catch (err: any) {
      console.error("Error fetching available courses:", err)
      throw new Error(err.message || "Error fetching available courses")
    }
  }, [])

  // Load active courses from localStorage
  const loadActiveCourses = () => {
    try {
      if (typeof window !== "undefined") {
        const savedCourses = localStorage.getItem("courseStatuses")
        if (savedCourses) {
          const parsedCourses = JSON.parse(savedCourses)
          const activeCoursesOnly = parsedCourses.filter((course: any) => course.status === "active")
          registerExternalCourses(activeCoursesOnly)
          return activeCoursesOnly
        }
      }
      return []
    } catch (err) {
      console.error("Error loading active courses from localStorage:", err)
      return []
    }
  }

  const applyAvailableCourses = useCallback(
    (courseList: CourseSection[], options: ApplyAvailableCoursesOptions = {}) => {
      const normalized = Array.isArray(courseList) ? courseList : []
      const newHash = computeCourseSetHash(normalized)

      if (!options.forceUpdate && lastAvailableHashRef.current === newHash) {
        return
      }

      lastAvailableHashRef.current = newHash

      const codes = normalized
        .map((course) => course?.courseCode)
        .filter((code): code is string => Boolean(code))
      if (codes.length > 0) {
        registerExternalCourseCodes(codes)
      }

      setAvailableCourses(normalized)
      const hasCourses = normalized.length > 0 && !options.isSampleData
      setHasRealCourseData(hasCourses)

      if (!options.skipTimestamp) {
        if (options.lastUpdated) {
          setLastUpdated(new Date(options.lastUpdated))
        } else if (normalized.length > 0) {
          setLastUpdated(new Date())
        } else {
          setLastUpdated(null)
        }
      }

      if (options.preserveError) {
        return
      }

      if (options.expired) {
        setError("Extracted course data expired after 1 hour. Please re-run the extension to fetch fresh data.")
      } else if (normalized.length === 0) {
        setError("No course data available. Please use the extension to extract course data.")
      } else {
        setError(null)
      }
    },
    [setAvailableCourses, setError, setLastUpdated, setHasRealCourseData],
  )

  // Fetch both available courses and active courses
  const fetchData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      try {
        const result = await fetchAvailableCourses()

        if (result.expired) {
          applyAvailableCourses([], {
            expired: true,
            lastUpdated: result.lastUpdated,
            forceUpdate: true,
          })
        } else if (!result.data || result.data.length === 0) {
          if (!silent) {
            setLastUpdated(null)
            setError("No course data available. Please use the extension to extract course data.")
            applyAvailableCourses(sampleAvailableCourses, {
              preserveError: true,
              skipTimestamp: true,
              isSampleData: true,
            })
          }
        } else {
          applyAvailableCourses(result.data, {
            lastUpdated: result.lastUpdated,
          })
        }

        const activeCoursesData = loadActiveCourses()
        setActiveCourses(activeCoursesData)
      } catch (err: any) {
        console.error("Failed to fetch available courses:", err)
        if (!silent) {
          setError(err.message || "Failed to fetch available courses")
          setLastUpdated(null)
          applyAvailableCourses(sampleAvailableCourses, {
            preserveError: true,
            skipTimestamp: true,
            isSampleData: true,
          })
        }
      } finally {
        if (!silent) {
          setLoading(false)
        }
        setHasFetchedOnce(true)
      }
    },
    [applyAvailableCourses, fetchAvailableCourses],
  )

  useEffect(() => {
    if (isClient) {
      fetchData()
    }
  }, [isClient, fetchData])

  useEffect(() => {
    if (!isClient) return

    const intervalMs = hasRealCourseData ? 60 * 1000 : 1 * 1000
    const interval = setInterval(() => {
      fetchData({ silent: true })
    }, intervalMs)

    return () => clearInterval(interval)
  }, [isClient, fetchData, hasRealCourseData])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "courseCurriculumSignature") {
        const latestSignature = loadCurriculumSignature()
        if (latestSignature !== curriculumSignature) {
          setCurriculumSignature(latestSignature)
          clearScheduleSelections()
          fetchData({ silent: true })
        }
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [curriculumSignature, fetchData, clearScheduleSelections])

  // Filter courses based on active status and curriculum
  const filteredCourses = availableCourses.filter((course) => {
    if (showOnlyActive) {
      const canonicalCode = getCanonicalCourseCode(course.courseCode)
      return activeCourses.some((active) => getCanonicalCourseCode(active.code) === canonicalCode)
    } else {
      return true
    }
  })

  const filteredAndSortedCourses = React.useMemo(
    () => getFilteredAndSortedCourses(),
    [filteredCourses, searchTerm, selectedDepartment, dayFilterSet, sortBy, sortOrder],
  )

  const groupedCourses = React.useMemo(
    () => groupCourses(filteredAndSortedCourses),
    [filteredAndSortedCourses, groupBy],
  )

  const totalSelectedCredits = React.useMemo(() => {
    return selectedCourses.reduce((sum, course) => {
      const creditValue = Number.isFinite(course.credits)
        ? course.credits
        : getCourseNameAndCredits(course.courseCode).credits || 0
      return sum + (Number.isFinite(creditValue) ? creditValue : 0)
    }, 0)
  }, [selectedCourses])

  const areAllGroupsCollapsed =
    groupedCourses.length > 0 &&
    groupedCourses.every(({ value }) => collapsedGroups[`${groupBy}-${value}`])

  const shouldShowAvailableCardCredits = groupBy !== "courseCode"

  const collapseAllGroups = useCallback(() => {
    setCollapsedGroups((prev) => {
      const next = { ...prev }
      groupedCourses.forEach(({ value }) => {
        next[`${groupBy}-${value}`] = true
      })
      return next
    })
  }, [groupBy, groupedCourses])

  const expandAllGroups = useCallback(() => {
    setCollapsedGroups((prev) => {
      const next = { ...prev }
      groupedCourses.forEach(({ value }) => {
        next[`${groupBy}-${value}`] = false
      })
      return next
    })
  }, [groupBy, groupedCourses])

  const currentGroupLabel = GROUP_LABELS[groupBy]

  const getGroupDisplayValue = useCallback(
    (value: string, courses: CourseSection[]) => {
      if (groupBy !== "courseCode") return value
      if (!courses || courses.length === 0) return value

      const canonical = getCanonicalCourseCode(courses[0].courseCode)
      const details = getCourseDetails(canonical) || getCourseDetails(courses[0].courseCode)
      const name = details?.name
      if (!name) return value
      const creditsLabel = typeof details?.credits === "number" ? `${details.credits} unit${details.credits === 1 ? "" : "s"}` : null
      return creditsLabel ? `${value} - ${name} (${creditsLabel})` : `${value} - ${name}`
    },
    [groupBy],
  )

  // Find active courses that don't have available sections
  const coursesNeedingPetition = activeCourses.filter(
    (active) => {
      const activeCanonical = getCanonicalCourseCode(active.code)
      return !availableCourses.some(
        (available) => getCanonicalCourseCode(available.courseCode) === activeCanonical,
      )
    },
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
  if (!scheduleRef.current) return;
  
  try {
    // Store original styles
    const dayHeaders = scheduleRef.current.querySelectorAll('.day-header');
    const originalStyles = Array.from(dayHeaders).map(header => ({
      element: header as HTMLElement,
      display: (header as HTMLElement).style.display,
      alignItems: (header as HTMLElement).style.alignItems,
      justifyContent: (header as HTMLElement).style.justifyContent,
      height: (header as HTMLElement).style.height
    }));

    // Apply temporary styles for perfect centering during capture
    dayHeaders.forEach(header => {
      const el = header as HTMLElement;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.height = '44px'; // Match your header height
    });

    // Hide the edit button temporarily
    const editButtons = scheduleRef.current.querySelectorAll('.edit-button');
    editButtons.forEach(button => (button as HTMLElement).style.display = 'none');

    // Small delay to ensure styles are applied
    await new Promise(resolve => setTimeout(resolve, 50));

    const canvas = await html2canvas(scheduleRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: 'white',
      scrollX: 0,
      scrollY: 0,
      windowWidth: scheduleRef.current.scrollWidth,
      windowHeight: scheduleRef.current.scrollHeight
    });

    // Restore all original styles
    originalStyles.forEach(style => {
      style.element.style.display = style.display;
      style.element.style.alignItems = style.alignItems;
      style.element.style.justifyContent = style.justifyContent;
      style.element.style.height = style.height;
    });

    // Restore the edit buttons
    editButtons.forEach(button => (button as HTMLElement).style.display = '');

    const link = document.createElement('a');
    link.download = `schedule-${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

  } catch (err) {
    console.error('Error generating image:', err);
  }
};

  // Save course customization
  const saveCustomization = () => {
    if (!editingCourse) return
    
    const key = `${editingCourse.courseCode}-${editingCourse.section}`
    setCustomizations(prev => ({
      ...prev,
      [key]: {
        customTitle: tempCustomTitle || editingCourse.courseCode,
        color: tempCustomColor,
      }
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
      localStorage.setItem('scheduleTitle', tempTitle)
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
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
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
  const HEADER_HEIGHT = 44; // Height of header row in pixels
  const HOUR_HEIGHT = 80; // Each hour = 80px tall
  const FIRST_HOUR = 7; // Schedule starts at 7AM

  return (
    <div>
      {/* Header controls */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Label htmlFor="start-date">Start Date:</Label>
          <Input
            type="date"
            id="start-date"
            value={startDate.toISOString().split('T')[0]}
            onChange={(e) => setStartDate(new Date(e.target.value))}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openIcsDialog}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Export as ICS
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={downloadScheduleImage}
            className="flex items-center gap-2"
          >
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
            {DAYS.map(day => (
              <div key={day} className="font-medium p-2 bg-gray-100 dark:bg-gray-700 text-center">
                {getFullDayName(day)}
              </div>
            ))}
          </div>

          {/* Time slots - absolutely positioned */}
          <div className="relative min-w-[800px]" style={{ height: `${HOUR_HEIGHT * 15}px` }}>
            {/* Hour markers */}
            {Array.from({ length: 15 }).map((_, i) => {
              const hour = FIRST_HOUR + i;
              const timeString = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
              return (
                <div 
                  key={hour}
                  className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700"
                  style={{ top: `${i * HOUR_HEIGHT}px` }}
                >
                  <div className="absolute left-0 p-1 text-xs font-medium">
                    {timeString}
                  </div>
                </div>
              );
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
            {selectedCourses.map(course => {
              const key = `${course.courseCode}-${course.section}`;
              const customization = customizations[key] || {};
              const bgColor = customization.color || "#3b82f6";
              const textColor = getContrastColor(bgColor);
              
              // Calculate exact positions with 30-minute adjustment
              const [startHour, startMinute] = course.timeStart.split(':').map(Number);
              const [endHour, endMinute] = course.timeEnd.split(':').map(Number);
              
              // Subtract 30 minutes from both start and end times
              let adjustedStartHour = startHour;
              let adjustedStartMinute = startMinute - 30;
              let adjustedEndHour = endHour;
              let adjustedEndMinute = endMinute - 30;
              
              // Handle minute underflow
              if (adjustedStartMinute < 0) {
                adjustedStartHour -= 1;
                adjustedStartMinute += 60;
              }
              if (adjustedEndMinute < 0) {
                adjustedEndHour -= 1;
                adjustedEndMinute += 60;
              }
              
              const startTop = HEADER_HEIGHT + 
                ((adjustedStartHour - FIRST_HOUR) * HOUR_HEIGHT) + 
                (adjustedStartMinute / 60 * HOUR_HEIGHT);
              
              const endTop = HEADER_HEIGHT + 
                ((adjustedEndHour - FIRST_HOUR) * HOUR_HEIGHT) + 
                (adjustedEndMinute / 60 * HOUR_HEIGHT);
              
              const height = endTop - startTop;

              return course.parsedDays.map(day => {
                const dayIndex = DAYS.indexOf(day);
                if (dayIndex === -1) return null;

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
                      margin: '0 2px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '5px 10px 15px',
                      boxSizing: 'border-box',
                      overflow: 'visible'
                    }}
                  >
                    <div className="font-bold text-sm leading-tight break-words">
                      {customization.customTitle || course.courseCode}
                    </div>
                    <div className="text-xs leading-tight break-words">
                      {course.displayTime}
                    </div>
                    <div className="text-xs leading-tight break-words">
                      {course.displayRoom}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Dialog open={noDataDialogOpen} onOpenChange={handleNoDataDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>No course data detected</DialogTitle>
            <DialogDescription>
              Keep the Student Portal&apos;s Course Offerings tab open with the ComParEng Tools extension enabled so we can import the latest sections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              We haven&apos;t received any extracted offerings yet. Launch the Student Portal so the extension can listen for the Course Offerings table and push it here automatically.
            </p>
            <p className="rounded-md border border-amber-400/40 bg-amber-50/70 p-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Make sure the extension is installed and active <span className="font-semibold">before</span> visiting the Course Offerings page. Otherwise the capture will be empty.
            </p>
            <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200/70 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-sm font-medium">Don&apos;t show again</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hide this reminder even if we still don&apos;t detect course data.</p>
              </div>
              <Switch
                checked={hideNoDataDialog}
                onCheckedChange={(value) => handleNoDataDialogToggle(Boolean(value))}
                aria-label="Don&apos;t show reminder again"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              className="w-full sm:w-auto gap-2"
              onClick={handleStudentPortalLaunch}
            >
              <ExternalLink className="h-4 w-4" />
              Open Student Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noActiveDialogOpen} onOpenChange={handleNoActiveDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>No active courses selected</DialogTitle>
            <DialogDescription>
              Mark at least one course as Active in Course Tracker so we can focus on the sections you actually plan to enroll in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Right now every course in Course Tracker is still marked as <span className="font-semibold">Pending</span> or <span className="font-semibold">Passed</span>. Switch the ones you&apos;re enrolling in to <span className="font-semibold">Active</span> so this page can auto-filter the matching sections and highlight open slots.
            </p>
            <p className="rounded-md border border-blue-300/50 bg-blue-50/80 p-3 text-blue-900 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-50">
              Tip: You can quickly mark courses from the Quick Actions menu inside Course Tracker, then return here to refresh the data.
            </p>
            <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200/70 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-sm font-medium">Don&apos;t show again</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hide this reminder while you work without active courses.</p>
              </div>
              <Switch
                checked={hideNoActiveDialog}
                onCheckedChange={(value) => handleNoActiveDialogToggle(Boolean(value))}
                aria-label="Don&apos;t show no-active reminder again"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto gap-2" onClick={openCourseTracker}>
              <BookOpen className="h-4 w-4" />
              Open Course Tracker
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => handleNoActiveDialogOpenChange(false)}
            >
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={awaitingDataDialogOpen} onOpenChange={setAwaitingDataDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasRealCourseData ? "Course data received" : "Awaiting course data"}</DialogTitle>
            <DialogDescription>
              {hasRealCourseData
                ? "Great! We just pulled fresh sections from the Student Portal."
                : "Keep the Student Portal tab open while the extension copies the Course Offerings list."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            {hasRealCourseData ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <Check className="h-8 w-8" />
              </div>
            ) : (
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {hasRealCourseData
                ? "Your schedule builder is now synced with the newly captured offerings."
                : "We’re listening for the extension to finish scraping. This can take a few moments depending on your connection."}
            </p>
          </div>
          <DialogFooter>
            {hasRealCourseData ? (
              <Button
                className="gap-2"
                onClick={() => setAwaitingDataDialogOpen(false)}
              >
                Let&apos;s get started
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setAwaitingDataDialogOpen(false)}
              >
                Try again later
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={icsDialogOpen} onOpenChange={(nextOpen) => { if (!nextOpen) handleCloseIcsDialog() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Export schedule as ICS</DialogTitle>
            <DialogDescription>
              Confirm the start date we should use for the recurring calendar events before downloading.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ics-start-date">Start date</Label>
            <Input
              id="ics-start-date"
              type="date"
              value={icsDialogStartDate}
              onChange={(event) => {
                setIcsDialogStartDate(event.target.value)
                setIcsDialogError(null)
              }}
            />
            {icsDialogError && <p className="text-sm text-red-500">{icsDialogError}</p>}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleCloseIcsDialog}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleConfirmIcsDownload} disabled={!icsDialogStartDate}>
              Download ICS file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 space-y-4">
          <QuickNavigation />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Schedule Maker</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Create your perfect class schedule with available course sections
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData()}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="rounded-full border-slate-300 bg-white/80 text-slate-900 hover:bg-white transition-colors dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                <Button onClick={handleStudentPortalLaunch} className="flex items-center gap-2">
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
            <TabsList className="mb-4 w-full h-auto flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
              <TabsTrigger value="available" className="flex-1 min-w-[10rem] whitespace-normal">
                Available Courses
              </TabsTrigger>
              <TabsTrigger value="selected" className="flex-1 min-w-[10rem] whitespace-normal">
                Selected Courses ({selectedCourses.length})
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1 min-w-[10rem] whitespace-normal">
                Schedule View
              </TabsTrigger>
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
                  <div className="w-full md:w-1/4">
                    <Label htmlFor="group-by">Group By</Label>
                    <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByOption)}>
                      <SelectTrigger id="group-by">
                        <SelectValue placeholder="Group by..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUP_BY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mb-4">
                  <Label className="mb-2 block">Filter by Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_FILTER_OPTIONS.map((option) => {
                      const isSelected = dayFilters.includes(option.value)
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDayFilter(option.value)}
                          title={`Show classes meeting on ${option.longLabel}`}
                          className={`${isSelected ? "" : "bg-transparent dark:bg-transparent text-slate-900 dark:text-slate-100"} px-3`}
                        >
                          {option.label}
                        </Button>
                      )
                    })}
                    {dayFilters.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearDayFilters}
                        className="px-3"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="show-active-only" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
                    <Label htmlFor="show-active-only">Show only active courses from Course Tracker</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === "card" ? "table" : "card")}
                    className="self-start sm:self-auto"
                  >
                    {viewMode === "card" ? "Switch to Table View" : "Switch to Card View"}
                  </Button>
                </div>

                <p className="mb-4">
                  Found {filteredAndSortedCourses.length} course sections
                  {showOnlyActive ? " for your active courses" : ""} (out of {availableCourses.length} total extracted
                  courses).
                </p>

                {filteredAndSortedCourses.length === 0 ? (
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
                            {groupedCourses.map(({ value, courses }) => {
                              const groupKey = `${groupBy}-${value}`
                              const isCollapsed = collapsedGroups[groupKey] ?? false

                              return (
                                <React.Fragment key={groupKey}>
                                  <TableRow className="bg-gray-100 dark:bg-gray-700">
                                    <TableCell colSpan={8} className="font-medium p-0">
                                      <button
                                        type="button"
                                        className="w-full px-4 py-2 flex items-center justify-between text-left"
                                        onClick={() => toggleGroupCollapse(groupKey)}
                                        aria-expanded={!isCollapsed}
                                        aria-controls={`${groupKey}-table-rows`}
                                      >
                                        <span>
                                          {currentGroupLabel}: {getGroupDisplayValue(value, courses)}
                                        </span>
                                        <ChevronDown
                                          className={`h-4 w-4 transition-transform ${
                                            isCollapsed ? "-rotate-90" : "rotate-0"
                                          }`}
                                        />
                                      </button>
                                    </TableCell>
                                  </TableRow>
                                  {!isCollapsed && (
                                    <React.Fragment>
                                      {courses.map((course, index) => {
                                  const canonicalCode = getCanonicalCourseCode(course.courseCode)
                                  const activeCourseDetails = activeCourses.find(
                                    (active) => getCanonicalCourseCode(active.code) === canonicalCode,
                                  )
                                  const fallbackDetails = getCourseDetails(course.courseCode)
                                  const courseDetails = activeCourseDetails || {
                                    name: fallbackDetails?.name || "Unknown Course",
                                    credits: fallbackDetails?.credits || 3,
                                  }
                                  const departmentValue = extractDepartmentCode(course.courseCode)
                                  const isConflict = hasScheduleConflict(course)
                                  const isAlreadySelected = selectedCourses.some(
                                    (selected) =>
                                      getSelectedCourseCanonicalCode(selected) === canonicalCode &&
                                      selected.section === course.section,
                                  )
                                  const hasSameCode = hasSameCourseCode(course) && !isAlreadySelected
                                  const existingCourse = hasSameCode ? getSelectedCourseWithSameCode(course) : null

                                        return (
                                          <TableRow key={`${course.courseCode}-${course.section}-${index}`}>
                                            <TableCell>{departmentValue}</TableCell>
                                            <TableCell>{course.courseCode}</TableCell>
                                            <TableCell>{courseDetails.name}</TableCell>
                                            <TableCell>{course.section}</TableCell>
                                            <TableCell>
                                              {cleanTimeString(course.meetingTime)} ({course.meetingDays})
                                            </TableCell>
                                            <TableCell>{cleanRoomString(course.room)}</TableCell>
                                            <TableCell>
                                              <Badge
                                                variant={course.hasSlots ? "secondary" : "destructive"}
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
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {viewMode === "card" && (
                      <div className="space-y-6">
                        {groupedCourses.length > 0 && (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={areAllGroupsCollapsed ? expandAllGroups : collapseAllGroups}
                              className="flex items-center gap-2"
                            >
                              {areAllGroupsCollapsed ? (
                                <>
                                  <Maximize2 className="h-4 w-4" />
                                  Expand all groups
                                </>
                              ) : (
                                <>
                                  <Minimize2 className="h-4 w-4" />
                                  Collapse all groups
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        {groupedCourses.map(({ value, courses }) => {
                          const groupKey = `${groupBy}-${value}`
                          const isCollapsed = collapsedGroups[groupKey] ?? false

                          return (
                            <div key={groupKey} className="border rounded-lg overflow-hidden">
                              <button
                                type="button"
                                className="w-full bg-gray-100 dark:bg-gray-700 px-4 py-2 font-medium flex items-center justify-between gap-3 text-left"
                                onClick={() => toggleGroupCollapse(groupKey)}
                                aria-expanded={!isCollapsed}
                                aria-controls={`${groupKey}-courses`}
                              >
                                <span>
                                  {currentGroupLabel}: {getGroupDisplayValue(value, courses)}
                                </span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                                />
                              </button>
                              {!isCollapsed && (
                                <div
                                  id={`${groupKey}-courses`}
                                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
                                >
                              {courses.map((course, index) => {
                                const canonicalCode = getCanonicalCourseCode(course.courseCode)
                                const activeCourseDetails = activeCourses.find(
                                  (active) => getCanonicalCourseCode(active.code) === canonicalCode,
                                )
                                const fallbackDetails = getCourseDetails(course.courseCode)
                                const courseDetails = activeCourseDetails || {
                                  name: fallbackDetails?.name || "Unknown Course",
                                  credits: fallbackDetails?.credits || 3,
                                }
                                const isConflict = hasScheduleConflict(course)
                                const isAlreadySelected = selectedCourses.some(
                                  (selected) =>
                                    getSelectedCourseCanonicalCode(selected) === canonicalCode &&
                                    selected.section === course.section,
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
                                          variant={course.hasSlots ? "secondary" : "destructive"}
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
                                        {shouldShowAvailableCardCredits && (
                                          <div className="flex justify-between">
                                            <span className="font-medium">Credits:</span>
                                            <span>{courseDetails.credits}</span>
                                          </div>
                                        )}
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
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Selected Courses Tab */}
            <TabsContent value="selected">
              <Dialog open={Boolean(importErrorDialog)} onOpenChange={(isOpen) => !isOpen && closeImportDialog()}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{importErrorDialog?.title || "Import error"}</DialogTitle>
                    <DialogDescription>
                      Make sure you upload the JSON file exported from Schedule Maker so we can restore your selections safely.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{importErrorDialog?.message}</p>
                  <DialogFooter>
                    <Button onClick={closeImportDialog}>Got it</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <input
                type="file"
                accept="application/json"
                ref={importFileInputRef}
                className="hidden"
                onChange={handleImportSelectedCourses}
              />
              {importStatus && (
                <Alert
                  className="mb-4"
                  variant={importStatus.type === "error" ? "destructive" : "default"}
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {importStatus.type === "success"
                      ? "Transfer complete"
                      : importStatus.type === "warning"
                        ? "Transfer finished with notices"
                        : "Transfer issue"}
                  </AlertTitle>
                  <AlertDescription>{importStatus.message}</AlertDescription>
                </Alert>
              )}
              {staleImportNotice && (
                <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Extracted data missing</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>{staleImportNotice}</span>
                    <Button variant="outline" size="sm" onClick={dismissStaleImportNotice}>
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {selectedCourses.length === 0 ? (
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-4 py-3 rounded mb-4">
                  <p>No courses selected yet. Add courses from the Available Courses tab to build your schedule.</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={triggerImportSelectedCourses}>
                      Import selection
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportSelectedCourses} disabled>
                      Export selection
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedViewMode(selectedViewMode === "card" ? "table" : "card")}
                        className="flex items-center gap-2"
                      >
                        {selectedViewMode === "card" ? "Table View" : "Card View"}
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2 items-start lg:items-end">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Total credits selected: {totalSelectedCredits}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={triggerImportSelectedCourses}>
                          Import selection
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportSelectedCourses}>
                          Export selection
                        </Button>
                      </div>
                    </div>
                  </div>

                  {selectedViewMode === "table" ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Course Code</TableHead>
                            <TableHead>Custom Title</TableHead>
                            <TableHead>Credits</TableHead>
                            <TableHead>Section</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Slots</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCourses.map((course) => {
                            const key = `${course.courseCode}-${course.section}`
                            const customization = customizations[key] || {}
                            
                            return (
                              <TableRow key={key}>
                                <TableCell>{course.courseCode}</TableCell>
                                <TableCell>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                                        {customization.customTitle || course.courseCode}
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-4">
                                        <h4 className="font-medium">Customize Course</h4>
                                        <div>
                                          <Label>Display Name</Label>
                                          <Input
                                            value={customization.customTitle || course.courseCode}
                                            onChange={(e) => {
                                              setCustomizations(prev => ({
                                                ...prev,
                                                [key]: {
                                                  ...prev[key],
                                                  customTitle: e.target.value
                                                }
                                              }))
                                            }}
                                          />
                                        </div>
                                        <div>
                                          <Label>Color</Label>
                                          <div className="flex items-center gap-2">
                                            <HexColorPicker
                                              color={customization.color || "#3b82f6"}
                                              onChange={(color) => {
                                                setCustomizations(prev => ({
                                                  ...prev,
                                                  [key]: {
                                                    ...prev[key],
                                                    color
                                                  }
                                                }))
                                              }}
                                              className="w-full"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                  <TableCell>{course.credits}</TableCell>
                                <TableCell>{course.section}</TableCell>
                                <TableCell>
                                  {course.displayTime} ({course.meetingDays})
                                </TableCell>
                                <TableCell>{course.displayRoom}</TableCell>
                                <TableCell>
                                  <Badge variant={course.hasSlots ? "secondary" : "destructive"}>
                                    {course.hasSlots ? `${course.remainingSlots}/${course.classSize}` : "Full"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeCourse(course.courseCode, course.section)}
                                  >
                                    <Trash className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedCourses.map((course, index) => {
                        const key = `${course.courseCode}-${course.section}`
                        const customization = customizations[key] || {}
                        const courseColor = customization.color || "#3b82f6"

                        return (
                          <Card key={index} className="relative overflow-hidden" style={{
                            borderLeft: `4px solid ${courseColor}`
                          }}>
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-lg font-bold">
                                    {customization.customTitle || course.courseCode}
                                  </CardTitle>
                                  <p className="text-sm font-medium">{course.name}</p>
                                </div>
                                <Badge variant={course.hasSlots ? "secondary" : "destructive"}>
                                  {course.hasSlots ? `${course.remainingSlots} slots` : "Full"}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Section: {course.section}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Credits: {course.credits}</p>
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
                              </div>
                            </CardContent>

                            <CardFooter className="flex gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="flex-1">
                                    <Palette className="h-4 w-4 mr-1" />
                                    Customize
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                  <div className="space-y-4">
                                    <h4 className="font-medium">Customize Course</h4>
                                    <div>
                                      <Label>Display Name</Label>
                                      <Input
                                        defaultValue={customization.customTitle || course.courseCode}
                                        onChange={(e) => {
                                          setCustomizations(prev => ({
                                            ...prev,
                                            [key]: {
                                              ...prev[key],
                                              customTitle: e.target.value
                                            }
                                          }))
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label>Color</Label>
                                      <div className="flex items-center gap-2">
                                        <HexColorPicker
                                          color={courseColor}
                                          onChange={(color) => {
                                            setCustomizations(prev => ({
                                              ...prev,
                                              [key]: {
                                                ...prev[key],
                                                color
                                              }
                                            }))
                                          }}
                                          className="w-full"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeCourse(course.courseCode, course.section)}
                                className="flex-1"
                              >
                                <Trash className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </CardFooter>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Schedule View Tab */}
            <TabsContent value="schedule">
              {selectedCourses.length === 0 ? (
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-4 py-3 rounded mb-4">
                  <p>No courses selected yet. Add courses from the Available Courses tab to build your schedule.</p>
                </div>
              ) : (
                renderScheduleView()
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-12">
          <QuickNavigation />
        </div>
      </div>
    </div>
  )
}
