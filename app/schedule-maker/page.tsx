"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  Plus,
  Pencil,
  Trash,
  BookOpen,
  GraduationCap,
  FileWarning,
  ExternalLink,
  Loader2,
  Check,
  Calendar,
  Download,
  Minus,
  Sun,
  Moon,
  X,
  Search,
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
  registerCourseCodeAliases,
  getAliasesForCanonical,
} from "@/lib/course-data"
import { loadCurriculumSignature, loadTrackerPreferences } from "@/lib/course-storage"
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
import { AnimatePresence, motion } from "framer-motion"
import { Checkbox } from "@/components/ui/checkbox"

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

type TermName = "Term 1" | "Term 2" | "Term 3"

const TERM_WINDOWS: { term: TermName; months: number[] }[] = [
  { term: "Term 1", months: [8, 9, 10, 11] },
  { term: "Term 2", months: [12, 1, 2, 3] },
  { term: "Term 3", months: [4, 5, 6, 7] },
]

const deriveTermFromDate = (date = new Date()): TermName => {
  const month = date.getMonth() + 1
  const match = TERM_WINDOWS.find((window) => window.months.includes(month))
  return match?.term ?? "Term 1"
}

const deriveAcademicYearLabel = (date = new Date()): string => {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const startYear = month >= 8 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

const buildTermYearKey = (term: TermName, academicYear: string) => `${academicYear}::${term}`

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

const buildCourseLookupKey = (courseCode: string, section: string) => {
  const normalizedSection = (section ?? "").trim().toUpperCase()
  return `${getCanonicalCourseCode(courseCode)}__${normalizedSection}`
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

interface ScheduleVersion {
  id: string
  name: string
  selectedCourses: SelectedCourse[]
  customizations: Record<string, CourseCustomization>
  scheduleTitle?: string
}

interface TermYearVersionState {
  activeVersionId: string
  versions: ScheduleVersion[]
}

const getDefaultSelectedCourseTitle = (course: SelectedCourse, formatCode?: (code: string) => string) => {
  const safeName = course.name || "Unknown Course"
  const safeSection = course.section || ""
  const codeLabel = formatCode ? formatCode(course.courseCode) : course.courseCode
  return `[${codeLabel}] ${safeName}${safeSection ? ` | ${safeSection}` : ""}`
}

const getSelectedCourseDisplayTitle = (
  course: SelectedCourse,
  customization?: CourseCustomization,
  formatCode?: (code: string) => string,
) => {
  const customTitle = customization?.customTitle?.trim()
  if (customTitle) {
    return customTitle
  }
  return getDefaultSelectedCourseTitle(course, formatCode)
}

const getSelectedCourseIdentifierLabel = (
  course: SelectedCourse,
  formatCode?: (code: string) => string,
) => {
  const safeName = course.name || "Unknown Course"
  const codeLabel = formatCode ? formatCode(course.courseCode) : course.courseCode
  return `${codeLabel} - ${safeName}`
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
const DEFAULT_CUSTOM_COLOR = "#3b82f6"
const DEFAULT_SCHEDULE_TITLE = "Weekly Schedule"
const HEX_COLOR_PATTERN = /^[0-9A-Fa-f]{6}$/

const sanitizeHexColor = (value: string): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  const stripped = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed
  if (!HEX_COLOR_PATTERN.test(stripped)) return null
  return `#${stripped.toUpperCase()}`
}

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
  // Remove whitespace and slashes as separators
  const s = daysString.toUpperCase().replace(/[\s/]+/g, '');

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
  return validPattern.test(days.replace(/[\s/]+/g, ''));
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
  const [customColorInputs, setCustomColorInputs] = useState<Record<string, string>>({})
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
  const scheduleRef = useRef<HTMLDivElement>(null)
  const lastAvailableHashRef = useRef<string>("")
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingImportFollowUpRef = useRef<(() => void) | null>(null)
  const loadingVersionRef = useRef<boolean>(false)
  const hasHydratedVersionRef = useRef<boolean>(false)
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
  const [tempCustomColor, setTempCustomColor] = useState(DEFAULT_CUSTOM_COLOR)
  const [currentTerm, setCurrentTerm] = useState<TermName>(() => deriveTermFromDate())
  const [academicYearLabel, setAcademicYearLabel] = useState<string>(() => deriveAcademicYearLabel())
  const [currentYearLevel, setCurrentYearLevel] = useState<number>(1)
  const [departmentTab, setDepartmentTab] = useState<string>("All")
  const [sectionFilter, setSectionFilter] = useState<string>("all")
  const [dayFilter, setDayFilter] = useState<string>("all")
  const [timeFilter, setTimeFilter] = useState<string>("all")
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([])
  const [versionStore, setVersionStore] = useState<Record<string, TermYearVersionState>>({})
  const [versionsExpanded, setVersionsExpanded] = useState<boolean>(false)
  const [addVersionMenuOpen, setAddVersionMenuOpen] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(0)
  const [searchPanelVisible, setSearchPanelVisible] = useState<boolean>(false)
  const [scheduleTitle, setScheduleTitle] = useState(DEFAULT_SCHEDULE_TITLE)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [scheduleTitleDraft, setScheduleTitleDraft] = useState(DEFAULT_SCHEDULE_TITLE)
  const [curriculumSignature, setCurriculumSignature] = useState<string>("")
  const [importStatus, setImportStatus] = useState<null | { type: "success" | "warning" | "error"; message: string }>(null)
  const [displayAliasMap, setDisplayAliasMap] = useState<Map<string, string>>(new Map())

  const startEditingScheduleTitle = useCallback(() => {
    setScheduleTitleDraft(scheduleTitle)
    setIsEditingTitle(true)
  }, [scheduleTitle])

  const cancelEditingScheduleTitle = useCallback(() => {
    setScheduleTitleDraft(scheduleTitle)
    setIsEditingTitle(false)
  }, [scheduleTitle])

  const saveScheduleTitle = useCallback(() => {
    const nextTitle = scheduleTitleDraft.trim() || DEFAULT_SCHEDULE_TITLE
    setScheduleTitle(nextTitle)
    setScheduleTitleDraft(nextTitle)
    setIsEditingTitle(false)
  }, [scheduleTitleDraft])

  const normalizeAliasState = useCallback(
    (raw: Record<string, unknown> | null | undefined): Record<string, { canonical: string; displayAlias?: boolean }> => {
      if (!raw || typeof raw !== "object") return {}
      const next: Record<string, { canonical: string; displayAlias?: boolean }> = {}
      Object.entries(raw).forEach(([legacy, value]) => {
        if (!legacy) return
        if (typeof value === "string") {
          next[legacy.toUpperCase()] = { canonical: value.toUpperCase(), displayAlias: true }
          return
        }
        if (value && typeof value === "object" && typeof (value as any).canonical === "string") {
          const canonical = (value as any).canonical.toUpperCase()
          const displayAlias = (value as any).displayAlias !== false
          next[legacy.toUpperCase()] = { canonical, displayAlias }
        }
      })
      return next
    },
    [],
  )

  const registerAliases = useCallback(
    (aliases: Record<string, { canonical: string; displayAlias?: boolean }>) => {
      const mappedEntries = Object.entries(aliases || {})
        .map(([legacy, value]) => {
          const canonical = value?.canonical
          return canonical ? [legacy, canonical] : null
        })
        .filter((entry): entry is [string, string] => Array.isArray(entry))

      if (mappedEntries.length > 0) {
        registerCourseCodeAliases(Object.fromEntries(mappedEntries))
      }

      const map = new Map<string, string>()
      Object.entries(aliases || {}).forEach(([legacy, value]) => {
        const canonical = value?.canonical
        const displayAlias = value?.displayAlias !== false
        if (!canonical) return
        const canonicalResolved = resolveCanonicalCourseCode(canonical)
        map.set(canonicalResolved, displayAlias ? canonicalResolved : legacy.toUpperCase())
      })
      setDisplayAliasMap(map)
    },
    [],
  )

  const getDisplayCode = useCallback(
    (code: string) => {
      const canonical = resolveCanonicalCourseCode(code || "")
      const alias = displayAliasMap.get(canonical)
      return alias ?? canonical
    },
    [displayAliasMap],
  )
  const [importErrorDialog, setImportErrorDialog] = useState<ImportDialogConfig | null>(null)
  const [staleImportNotice, setStaleImportNotice] = useState<string | null>(null)
  const [icsDialogOpen, setIcsDialogOpen] = useState(false)
  const [icsDialogStartDate, setIcsDialogStartDate] = useState<string>("")
  const [icsDialogError, setIcsDialogError] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [showMobilePrompt, setShowMobilePrompt] = useState(false)
  const activeTermYearKey = buildTermYearKey(currentTerm, academicYearLabel)

  const scrollToPageTop = useCallback(() => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }, [])

  const persistVersionStore = useCallback((next: Record<string, TermYearVersionState>) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem("scheduleMakerVersionsV1", JSON.stringify(next))
    } catch (err) {
      console.error("Failed to persist version store", err)
    }
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

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem("courseCodeAliases")
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (parsed && typeof parsed === "object") {
        const normalized = normalizeAliasState(parsed)
        registerAliases(normalized)
      }
    } catch (err) {
      console.error("Failed to load course code aliases", err)
    }
  }, [normalizeAliasState, registerAliases])

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

  useEffect(() => {
    const preferences = loadTrackerPreferences()
    if (preferences?.currentYearLevel && Number.isFinite(preferences.currentYearLevel)) {
      setCurrentYearLevel(preferences.currentYearLevel)
    }
    if (preferences?.currentTerm) {
      const normalized = (preferences.currentTerm as TermName) || deriveTermFromDate()
      setCurrentTerm(normalized)
    }

    if (typeof window !== "undefined") {
      const suppressed = window.localStorage.getItem("scheduleMaker.hideMobilePrompt") === "true"
      const isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches
      if (isMobile && !suppressed) {
        setShowMobilePrompt(true)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(max-width: 768px)")

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const suppressed = window.localStorage.getItem("scheduleMaker.hideMobilePrompt") === "true"
      if (!event.matches) {
        setShowMobilePrompt(false)
      } else if (!suppressed) {
        setShowMobilePrompt(true)
      }
    }

    handleChange(media)
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    // Keep previously picked courses in the list even if their sections are temporarily cleared
    setSelectedCourseCodes((prev) => {
      const next = new Set(prev)
      selectedCourses.forEach((course) => next.add(getSelectedCourseCanonicalCode(course)))
      return Array.from(next)
    })
  }, [selectedCourses])

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

  const ensureActiveVersion = useCallback(() => {
    setVersionStore((prev) => {
      const existing = prev[activeTermYearKey]
      const baseVersion: ScheduleVersion = {
        id: existing?.versions?.[0]?.id || "v1",
        name: existing?.versions?.[0]?.name || "Version A",
        selectedCourses,
        customizations,
        scheduleTitle,
      }

      const versions = existing?.versions?.length ? existing.versions : [baseVersion]
      const activeVersionId = existing?.activeVersionId || versions[0].id
      const normalizedVersions = versions.map((version) =>
        version.id === activeVersionId
            ? { ...version, selectedCourses, customizations, scheduleTitle }
          : version,
      )

      const nextStore = {
        ...prev,
        [activeTermYearKey]: {
          activeVersionId,
          versions: normalizedVersions,
        },
      }

      persistVersionStore(nextStore)
      return nextStore
    })
  }, [activeTermYearKey, customizations, persistVersionStore, selectedCourses])

  const setActiveVersion = useCallback(
    (versionId: string) => {
      setVersionStore((prev) => {
        const entry = prev[activeTermYearKey]
        if (!entry) return prev
        const target = entry.versions.find((version) => version.id === versionId)
        if (!target) return prev

        setSelectedCourses(target.selectedCourses.map(normalizeSelectedCourse))
        hasHydratedVersionRef.current = true
        setCustomizations(target.customizations || {})
        const nextTitle = target.scheduleTitle || DEFAULT_SCHEDULE_TITLE
        setScheduleTitle(nextTitle)
        setScheduleTitleDraft(nextTitle)

        const nextStore = {
          ...prev,
          [activeTermYearKey]: { ...entry, activeVersionId: versionId },
        }
        persistVersionStore(nextStore)
        return nextStore
      })
    },
    [activeTermYearKey, persistVersionStore],
  )

  const createVersion = useCallback(
    (mode: "new" | "duplicate" = "new") => {
      setVersionStore((prev) => {
        const entry = prev[activeTermYearKey]
        const versions = entry?.versions ?? []
        const nextId = `v${versions.length + 1}`
        const name = `Version ${String.fromCharCode(65 + versions.length)}`
        const basePayload = mode === "duplicate"
          ? { selectedCourses, customizations }
          : { selectedCourses: [] as SelectedCourse[], customizations: {} as Record<string, CourseCustomization> }

        const nextVersion: ScheduleVersion = {
          id: nextId,
          name,
          selectedCourses: basePayload.selectedCourses,
          customizations: basePayload.customizations,
          scheduleTitle: mode === "duplicate" ? scheduleTitle : DEFAULT_SCHEDULE_TITLE,
        }

        const nextEntry: TermYearVersionState = {
          activeVersionId: nextId,
          versions: [...versions, nextVersion],
        }

        const nextStore = {
          ...prev,
          [activeTermYearKey]: nextEntry,
        }

        setSelectedCourses(nextVersion.selectedCourses)
        setCustomizations(nextVersion.customizations)
        setScheduleTitle(nextVersion.scheduleTitle || DEFAULT_SCHEDULE_TITLE)
        setScheduleTitleDraft(nextVersion.scheduleTitle || DEFAULT_SCHEDULE_TITLE)
        persistVersionStore(nextStore)
        return nextStore
      })
    },
    [activeTermYearKey, customizations, persistVersionStore, scheduleTitle, selectedCourses],
  )

  const deleteVersion = useCallback(
    (versionId: string) => {
      setVersionStore((prev) => {
        const entry = prev[activeTermYearKey]
        if (!entry || entry.versions.length <= 1) return prev

        const filtered = entry.versions.filter((version) => version.id !== versionId)
        const nextActive = entry.activeVersionId === versionId ? filtered[0]?.id : entry.activeVersionId

        const nextStore = {
          ...prev,
          [activeTermYearKey]: {
            activeVersionId: nextActive,
            versions: filtered,
          },
        }

        const activeVersion = filtered.find((version) => version.id === nextActive)
        if (activeVersion) {
          setSelectedCourses(activeVersion.selectedCourses.map(normalizeSelectedCourse))
          setCustomizations(activeVersion.customizations || {})
          const nextTitle = activeVersion.scheduleTitle || DEFAULT_SCHEDULE_TITLE
          setScheduleTitle(nextTitle)
          setScheduleTitleDraft(nextTitle)
        }

        persistVersionStore(nextStore)
        return nextStore
      })
    },
    [activeTermYearKey, persistVersionStore],
  )

  const confirmDeleteVersion = useCallback(
    (versionId: string) => {
      if (window.confirm("Delete this version?")) {
        deleteVersion(versionId)
      }
    },
    [deleteVersion],
  )

  const dismissMobilePrompt = useCallback((remember: boolean) => {
    setShowMobilePrompt(false)
    if (remember && typeof window !== "undefined") {
      window.localStorage.setItem("scheduleMaker.hideMobilePrompt", "true")
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

  useEffect(() => {
    if (!isClient) return
    try {
      const raw = localStorage.getItem("scheduleMakerVersionsV1")
      if (!raw) {
        ensureActiveVersion()
        return
      }
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        setVersionStore(parsed)
        const entry = parsed[activeTermYearKey]
        const activeId = entry?.activeVersionId
        const activeVersion = entry?.versions?.find((v: ScheduleVersion) => v.id === activeId) || entry?.versions?.[0]
        if (activeVersion) {
          setSelectedCourses(activeVersion.selectedCourses.map(normalizeSelectedCourse))
          setCustomizations(activeVersion.customizations || {})
        }
      }
    } catch (err) {
      console.error("Failed to restore versions", err)
      ensureActiveVersion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient])

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
            scheduleTitle,
            curriculumSignature: latestSignature,
          }),
        )
      } catch (err) {
        console.error("Error saving to localStorage:", err)
      }
    }
  }, [selectedCourses, customizations, isClient, curriculumSignature, scheduleTitle])

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

  useEffect(() => {
    if (!isClient) return
    if (loadingVersionRef.current) return

    const entry = versionStore[activeTermYearKey]
    if (!entry) {
      ensureActiveVersion()
      return
    }

    const activeVersion =
      entry.versions.find((version) => version.id === entry.activeVersionId) || entry.versions[0]
    if (!activeVersion) return

    const currentCourseKeys = JSON.stringify(
      selectedCourses.map((course) => course.id || `${course.courseCode}-${course.section}`),
    )
    const versionCourseKeys = JSON.stringify(
      activeVersion.selectedCourses.map((course) => course.id || `${course.courseCode}-${course.section}`),
    )

    const shouldHydrateFromVersion =
      selectedCourses.length === 0 &&
      activeVersion.selectedCourses.length > 0 &&
      !hasHydratedVersionRef.current

    if (shouldHydrateFromVersion) {
      loadingVersionRef.current = true
      hasHydratedVersionRef.current = true
      setSelectedCourses(activeVersion.selectedCourses.map(normalizeSelectedCourse))
      setCustomizations(activeVersion.customizations || {})
      loadingVersionRef.current = false
      return
    }

    if (currentCourseKeys !== versionCourseKeys) {
      ensureActiveVersion()
      return
    }

    const versionCustomizations = activeVersion.customizations || {}
    const currentCustomizationsStr = JSON.stringify(customizations || {})
    const versionCustomizationsStr = JSON.stringify(versionCustomizations)

    if (currentCustomizationsStr !== versionCustomizationsStr) {
      ensureActiveVersion()
    } else if (selectedCourses.length === 0 && activeVersion.selectedCourses.length === 0) {
      hasHydratedVersionRef.current = true
    }
  }, [
    activeTermYearKey,
    customizations,
    ensureActiveVersion,
    isClient,
    normalizeSelectedCourse,
    selectedCourses,
    versionStore,
  ])

  useEffect(() => {
    hasHydratedVersionRef.current = false
  }, [activeTermYearKey])

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

  useEffect(() => {
    console.log('[syncEffect] Running - availableCourses count:', availableCourses.length, 'selectedCourses count:', selectedCourses.length)
    
    if (availableCourses.length === 0) {
      console.log('[syncEffect] No available courses, returning')
      return
    }

    const lookup = new Map<string, CourseSection>()
    availableCourses.forEach((course) => {
      const key = buildCourseLookupKey(course.courseCode, course.section)
      lookup.set(key, course)
      console.log('[syncEffect] Added to lookup:', key)
    })

    setSelectedCourses((prev) => {
      console.log('[syncEffect] State update callback - prev length:', prev.length)
      
      if (prev.length === 0) {
        console.log('[syncEffect] No selected courses, returning')
        return prev
      }

      let changed = false

      const updated = prev.map((selected) => {
        const key = buildCourseLookupKey(selected.canonicalCode || selected.courseCode, selected.section)
        console.log('[syncEffect] Looking for key:', key, 'exists in lookup:', lookup.has(key))
        
        const latest = lookup.get(key)
        if (!latest) {
          console.log('[syncEffect] Not found in lookup, keeping original')
          return selected
        }

        const canonicalCode = getCanonicalCourseCode(latest.courseCode)
        const metadata = getCourseNameAndCredits(latest.courseCode)
        const { start, end, startMinutes, endMinutes } = parseTimeRange(latest.meetingTime)
        const parsedDays = parseDays(latest.meetingDays)
        const displayTime = cleanTimeString(latest.meetingTime)
        const displayRoom = cleanRoomString(latest.room)
        const parsedDaysChanged =
          selected.parsedDays.length !== parsedDays.length ||
          selected.parsedDays.some((day, index) => day !== parsedDays[index])

        const needsUpdate =
          selected.courseCode !== latest.courseCode ||
          selected.classSize !== latest.classSize ||
          selected.remainingSlots !== latest.remainingSlots ||
          selected.meetingDays !== latest.meetingDays ||
          selected.meetingTime !== latest.meetingTime ||
          selected.room !== latest.room ||
          selected.hasSlots !== latest.hasSlots ||
          selected.canonicalCode !== canonicalCode ||
          selected.name !== metadata.name ||
          selected.credits !== metadata.credits ||
          selected.timeStart !== start ||
          selected.timeEnd !== end ||
          selected.startMinutes !== startMinutes ||
          selected.endMinutes !== endMinutes ||
          parsedDaysChanged ||
          selected.displayTime !== displayTime ||
          selected.displayRoom !== displayRoom

        if (!needsUpdate) {
          console.log('[syncEffect] No update needed for', key)
          return selected
        }

        console.log('[syncEffect] Updating', key)
        changed = true
        return {
          ...selected,
          ...latest,
          canonicalCode,
          name: metadata.name,
          credits: metadata.credits,
          timeStart: start,
          timeEnd: end,
          startMinutes,
          endMinutes,
          parsedDays,
          displayTime,
          displayRoom,
        }
      })

      console.log('[syncEffect] Changed:', changed, 'returning length:', updated.length)
      return changed ? updated : prev
    })
  }, [availableCourses, setSelectedCourses])

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

  const handleHexInputChange = useCallback((courseKey: string, value: string) => {
    setCustomColorInputs((prev) => ({
      ...prev,
      [courseKey]: value,
    }))
  }, [])

  const applyHexColorValue = useCallback(
    (courseKey: string, value: string, fallbackColor?: string) => {
      const sanitized = sanitizeHexColor(value)
      if (!sanitized) {
        if (fallbackColor) {
          setCustomColorInputs((prev) => ({
            ...prev,
            [courseKey]: fallbackColor,
          }))
        }
        return
      }

      setCustomColorInputs((prev) => ({
        ...prev,
        [courseKey]: sanitized,
      }))

      setCustomizations((prev) => ({
        ...prev,
        [courseKey]: {
          ...prev[courseKey],
          color: sanitized,
        },
      }))
    },
    [setCustomizations],
  )

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
    console.log('[addCourse] Called with:', { courseCode: course.courseCode, section: course.section })
    
    const canonicalCode = getCanonicalCourseCode(course.courseCode)
    console.log('[addCourse] Canonical code:', canonicalCode)

    const { start, end, startMinutes, endMinutes } = parseTimeRange(course.meetingTime)
    const parsedDays = parseDays(course.meetingDays)
    const metadata = getCourseNameAndCredits(course.courseCode)
    
    console.log('[addCourse] Metadata:', { name: metadata.name, credits: metadata.credits })
    
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

    console.log('[addCourse] About to set selected courses. Current count:', selectedCourses.length)
    console.log('[addCourse] New course object:', newCourse)
    
    setSelectedCourses((prev) => {
      console.log('[addCourse] State update callback - prev length:', prev.length)
      
      // Check for duplicates using the latest state (prev), not the stale closure
      const existingSection = prev.find(
        (selected) => 
          getCanonicalCourseCode(selected.courseCode) === canonicalCode && 
          selected.section === course.section
      )

      if (existingSection) {
        console.log('[addCourse] Section already exists in state, returning unchanged')
        return prev
      }
      
      const next = [...prev, newCourse]
      console.log('[addCourse] After add - next length:', next.length)
      return next
    })
  }

  const toggleCourseSelection = (courseCode: string) => {
    const canonical = getCanonicalCourseCode(courseCode)
    let shouldRemoveSections = false

    setSelectedCourseCodes((prev) => {
      const next = new Set(prev)
      if (next.has(canonical)) {
        next.delete(canonical)
        shouldRemoveSections = true
      } else {
        next.add(canonical)
      }
      return Array.from(next)
    })

    if (shouldRemoveSections) {
      setSelectedCourses((prevCourses) => {
        const [remaining, removed] = prevCourses.reduce<[
          SelectedCourse[],
          SelectedCourse[]
        ]>(
          (acc, course) => {
            if (getSelectedCourseCanonicalCode(course) === canonical) {
              acc[1].push(course)
            } else {
              acc[0].push(course)
            }
            return acc
          },
          [[], []],
        )

        if (removed.length > 0) {
          setCustomizations((prev) => {
            const next = { ...prev }
            removed.forEach((course) => {
              delete next[`${course.courseCode}-${course.section}`]
            })
            return next
          })

          setCustomColorInputs((prev) => {
            const next = { ...prev }
            removed.forEach((course) => {
              delete next[`${course.courseCode}-${course.section}`]
            })
            return next
          })
        }

        return remaining
      })
    }
  }

  const toggleSectionSelection = (section: CourseSection, checked: boolean) => {
    if (checked) {
      addCourse(section)
      const canonical = getCanonicalCourseCode(section.courseCode)
      setSelectedCourseCodes((prev) => Array.from(new Set([...prev, canonical])))
    } else {
      removeCourse(section.courseCode, section.section)
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

    setCustomColorInputs((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
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
      const summary = getSelectedCourseDisplayTitle(course, customizations[customizationKey], getDisplayCode)
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
      `X-WR-CALNAME:${escapeText(scheduleTitle || DEFAULT_SCHEDULE_TITLE)}`,
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
      const canonicalCode = getCanonicalCourseCode(course.courseCode)
      const aliasMatches = getAliasesForCanonical(canonicalCode).map((alias) => alias.toLowerCase())
      const sectionValue = (course.section || "").toLowerCase()
      const meetingDaysValue = (course.meetingDays || "").toLowerCase()
      const meetingTimeRaw = (course.meetingTime || "").toLowerCase()
      const meetingTimeDisplay = cleanTimeString(course.meetingTime).toLowerCase()
      const roomValue = cleanRoomString(course.room).toLowerCase()

      const matchesSearch =
        normalizedSearch === "" ||
        course.courseCode.toLowerCase().includes(normalizedSearch) ||
        canonicalCode.toLowerCase().includes(normalizedSearch) ||
        aliasMatches.some((alias) => alias.includes(normalizedSearch)) ||
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
    if (!error) {
      setErrorDialogOpen(false)
    }
  }, [error])

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
      if (!name) return getDisplayCode(value)
      const creditsLabel = typeof details?.credits === "number" ? `${details.credits} unit${details.credits === 1 ? "" : "s"}` : null
      const displayValue = getDisplayCode(value)
      return creditsLabel ? `${displayValue} - ${name} (${creditsLabel})` : `${displayValue} - ${name}`
    },
    [groupBy, getDisplayCode],
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

  const courseCatalog = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string; credits: number; department: string; sections: CourseSection[]; year?: number; term?: string }>()

    initialCourses.forEach((course) => {
      const canonical = getCanonicalCourseCode(course.code)
      map.set(canonical, {
        code: canonical,
        name: course.name,
        credits: course.credits,
        department: extractDepartmentCode(course.code),
        sections: [],
        year: course.year,
        term: course.term,
      })
    })

    availableCourses.forEach((section) => {
      const canonical = getCanonicalCourseCode(section.courseCode)
      const existing = map.get(canonical) ?? {
        code: canonical,
        name: getCourseNameAndCredits(section.courseCode).name,
        credits: getCourseNameAndCredits(section.courseCode).credits,
        department: extractDepartmentCode(section.courseCode),
        sections: [],
      }
      existing.sections = [...existing.sections, section]
      map.set(canonical, existing)
    })

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [availableCourses])

  const departmentTabs = React.useMemo(() => {
    const dynamic = new Set<string>(courseCatalog.map((course) => course.department))
    const ordered = ["All", "GED", "NSTP", "CPE", ...Array.from(dynamic).sort()]
    return Array.from(new Set(ordered))
  }, [courseCatalog])

  const sectionOptions = React.useMemo(() => {
    const sections = new Set<string>()
    courseCatalog.forEach((course) => {
      course.sections.forEach((section) => {
        const code = (section.section || "").trim().toUpperCase()
        if (code) sections.add(code)
      })
    })
    return Array.from(sections).sort()
  }, [courseCatalog])

  const academicYearOptions = React.useMemo(() => {
    const current = deriveAcademicYearLabel()
    const baseStart = Number.parseInt(current.slice(0, 4), 10)
    return Array.from({ length: 4 }, (_, i) => {
      const start = baseStart - 1 + i
      return `${start}-${start + 1}`
    })
  }, [])

  const suggestedCourses = React.useMemo(() => {
    return courseCatalog
      .filter((course) => course.year === currentYearLevel && course.term === currentTerm)
      .slice(0, 10)
  }, [courseCatalog, currentYearLevel, currentTerm])

  const filteredCatalog = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return courseCatalog.filter((course) => {
      const matchesDept = departmentTab === "All" || course.department === departmentTab
      const matchesSection =
        sectionFilter === "all" ||
        course.sections.some((section) => (section.section || "").trim().toUpperCase() === sectionFilter)
      const matchesDay =
        dayFilter === "all" ||
        course.sections.some((section) => parseDays(section.meetingDays).includes(dayFilter as DayToken))
      const matchesTime = (() => {
        if (timeFilter === "all") return true
        return course.sections.some((section) => {
          const { startMinutes } = parseTimeRange(section.meetingTime)
          if (Number.isNaN(startMinutes)) return false
          const hour = startMinutes / 60
          if (timeFilter === "morning") return hour < 12
          if (timeFilter === "afternoon") return hour >= 12 && hour < 17
          if (timeFilter === "evening") return hour >= 17
          return true
        })
      })()
      const matchesSearch =
        normalizedSearch.length === 0 ||
        course.code.toLowerCase().includes(normalizedSearch) ||
        course.name.toLowerCase().includes(normalizedSearch)
      return matchesDept && matchesSection && matchesDay && matchesTime && matchesSearch
    })
  }, [courseCatalog, departmentTab, sectionFilter, dayFilter, timeFilter, searchTerm])

  const activeVersionState = versionStore[activeTermYearKey]
  const versions = activeVersionState?.versions ?? []

const downloadScheduleImage = async () => {
  if (!scheduleRef.current) return;
  
  // Capture at max zoom for clarity
  const prevZoom = zoomLevel
  setZoomLevel(2)
  // Allow layout to update before capture
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  try {
    const cardEl = scheduleRef.current.closest('[data-schedule-card]') as HTMLElement | null
    if (!cardEl) return

    // Hide edit/chevron icons in header during capture
    const headerEl = cardEl.querySelector('.schedule-card-header') as HTMLElement | null
    const renameButton = headerEl?.querySelector('[aria-label="Rename schedule title"]') as HTMLElement | null
    const headerSvgs = Array.from(headerEl?.querySelectorAll('svg') ?? []) as HTMLElement[]
    const originalRenameDisplay = renameButton?.style.display
    const svgDisplays = headerSvgs.map((el) => el.style.display)
    if (renameButton) renameButton.style.display = 'none'
    headerSvgs.forEach((el) => { el.style.display = 'none' })

    // Temporarily expand and unclip the schedule area for full capture
    const scheduleEl = scheduleRef.current
    const parentEl = scheduleEl.parentElement as HTMLElement | null
    const scrollEl = scheduleEl.querySelector('[data-schedule-scroll]') as HTMLElement | null
    const originalScheduleHeight = scheduleEl.style.height
    const originalScheduleOverflow = scheduleEl.style.overflow
    const originalScheduleWidth = scheduleEl.style.width
    const originalCardWidth = cardEl.style.width
    const originalCardHeight = cardEl.style.height
    const originalParentOverflow = parentEl?.style.overflow
    const originalScrollOverflow = scrollEl?.style.overflow
    const originalScrollWidth = scrollEl?.style.width
    const originalScrollHeight = scrollEl?.style.height
    const originalScrollMaxHeight = scrollEl?.style.maxHeight
    scheduleEl.style.height = `${scheduleEl.scrollHeight}px`
    scheduleEl.style.overflow = "visible"
    if (parentEl) parentEl.style.overflow = "visible"
    if (scrollEl) {
      const fullWidth = scrollEl.scrollWidth || scrollEl.clientWidth
      const fullHeight = Math.max(scrollEl.scrollHeight, scheduleEl.scrollHeight, cardEl.scrollHeight)
      scrollEl.style.overflow = "visible"
      scrollEl.style.width = `${fullWidth}px`
      scrollEl.style.height = `${fullHeight + 160}px`
      scrollEl.style.maxHeight = `${fullHeight + 160}px`
      scheduleEl.style.width = `${fullWidth}px`
      scheduleEl.style.height = `${fullHeight + (headerEl?.offsetHeight ?? 0) + 200}px`
      cardEl.style.width = `${fullWidth + 32}px` // add padding margin headroom
      cardEl.style.height = `${fullHeight + (headerEl?.offsetHeight ?? 0) + 240}px`
    }

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

    const captureWidth = scrollEl?.scrollWidth || cardEl.scrollWidth
    const captureHeight = Math.max(
      scrollEl?.scrollHeight || 0,
      scheduleEl.scrollHeight,
      cardEl.scrollHeight,
    ) + (headerEl?.offsetHeight ?? 0) + 160

    const canvas = await html2canvas(cardEl, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: 'white',
      scrollX: 0,
      scrollY: 0,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      width: captureWidth,
      height: captureHeight
    });

    // Restore overflow/height
    scheduleEl.style.height = originalScheduleHeight;
    scheduleEl.style.overflow = originalScheduleOverflow;
    scheduleEl.style.width = originalScheduleWidth;
    if (parentEl && originalParentOverflow !== undefined) parentEl.style.overflow = originalParentOverflow;
    if (scrollEl) {
      scrollEl.style.overflow = originalScrollOverflow ?? "";
      scrollEl.style.width = originalScrollWidth ?? "";
      scrollEl.style.height = originalScrollHeight ?? ""
      scrollEl.style.maxHeight = originalScrollMaxHeight ?? ""
    }
    cardEl.style.width = originalCardWidth;
    cardEl.style.height = originalCardHeight;

    // Restore header icons
    if (renameButton) renameButton.style.display = originalRenameDisplay ?? ''
    headerSvgs.forEach((el, idx) => { el.style.display = svgDisplays[idx] })

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
  } finally {
    // Restore user zoom
    setZoomLevel(prevZoom)
  }
};

  // Save course customization
  const saveCustomization = () => {
    if (!editingCourse) return
    
    const key = `${editingCourse.courseCode}-${editingCourse.section}`
    setCustomizations(prev => ({
      ...prev,
      [key]: {
        customTitle: tempCustomTitle || getDefaultSelectedCourseTitle(editingCourse, getDisplayCode),
        color: tempCustomColor,
      }
    }))
    setEditingCourse(null)
  }

  // Get course color
  const getCourseColor = (course: SelectedCourse) => {
    const key = `${course.courseCode}-${course.section}`
    return customizations[key]?.color || DEFAULT_CUSTOM_COLOR // Default blue
  }

  const MIN_ZOOM_LEVEL = -2
  const MAX_ZOOM_LEVEL = 2
  const BASE_HOUR_HEIGHT = 76
  const HOUR_HEIGHT_STEP = 22
  const MIN_HOUR_HEIGHT = 30
  const MAX_HOUR_HEIGHT = 120

  const zoomedHourHeight = React.useMemo(() => {
    const computed = BASE_HOUR_HEIGHT + (zoomLevel - 1) * HOUR_HEIGHT_STEP
    return Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, computed))
  }, [zoomLevel])

  const zoomOut = () => setZoomLevel((prev) => Math.max(MIN_ZOOM_LEVEL, prev - 1))
  const zoomIn = () => setZoomLevel((prev) => Math.min(MAX_ZOOM_LEVEL, prev + 1))

const renderScheduleView = () => {
  // Constants for precise alignment
  const HEADER_HEIGHT = 44; // Height of header row in pixels
  const HOUR_HEIGHT = zoomedHourHeight; // Each hour height adjusts with zoom
  const FIRST_HOUR = 7; // Schedule starts at 7AM
  const TIME_COL_WIDTH = 80; // Narrower time column to maximize course space
  const DAY_COUNT = 6; // Monday–Saturday

  const gridVars: React.CSSProperties = {
    // Space for time column, remaining width split across day columns
    ['--time-col' as string]: `${TIME_COL_WIDTH}px`,
    ['--day-width' as string]: `calc((100% - ${TIME_COL_WIDTH}px) / ${DAY_COUNT})`,
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
        ref={scheduleRef}
      >
        <div
          className="relative h-full overflow-auto hide-scrollbar"
          data-schedule-scroll
          style={{
            ...gridVars,
            minWidth: "640px",
            height: "calc(100vh - 160px)",
            maxHeight: "calc(100vh - 160px)",
          }}
        >
          {/* Header row - fixed at top */}
          <div
            className="sticky top-0 z-30 grid min-w-[720px] gap-1 border-b border-slate-200/70 bg-white/95 dark:border-slate-700/80 dark:bg-slate-900/95"
            style={{ gridTemplateColumns: `var(--time-col) repeat(${DAY_COUNT}, minmax(0, 1fr))` }}
          >
            <div className="day-header rounded-md bg-gray-100 p-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              Time
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="day-header rounded-md bg-gray-100 p-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              >
                {getFullDayName(day)}
              </div>
            ))}
          </div>

          {/* Time slots - absolutely positioned */}
          <div className="relative min-w-[720px]" style={{ height: `${HOUR_HEIGHT * 15}px`, ...gridVars }}>
            {/* Hour markers */}
            {Array.from({ length: 15 }).map((_, i) => {
              const hour = FIRST_HOUR + i
              const timeString = `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-slate-200 dark:border-slate-700"
                  style={{ top: `${i * HOUR_HEIGHT}px` }}
                >
                  <div className="absolute left-0 px-2 py-1 text-[11px] font-medium text-slate-500">
                    {timeString}
                  </div>
                </div>
              )
            })}

            {/* Half-hour markers */}
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={`half-${i}`}
                className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700"
                style={{ top: `${(i + 0.5) * HOUR_HEIGHT}px` }}
              />
            ))}

            {/* Course blocks - adjusted 30 minutes up */}
            {selectedCourses.map(course => {
              const key = `${course.courseCode}-${course.section}`;
              const customization = customizations[key] || {};
              const bgColor = customization.color || DEFAULT_CUSTOM_COLOR;
              const textColor = getContrastColor(bgColor);
              const displayTitle = getSelectedCourseDisplayTitle(course, customization, getDisplayCode);
              
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
              const showTime = height >= 64;
              const showRoom = height >= 88;
              const compactTitle = height < 72;
              const blockPadding = height < 56 ? '4px 8px' : '6px 10px 12px';
              const justifyContent = showTime || showRoom ? 'space-between' : 'center';

              return course.parsedDays.map(day => {
                const dayIndex = DAYS.indexOf(day);
                if (dayIndex === -1) return null;

                return (
                  <div
                    key={`${key}-${day}`}
                    className="absolute rounded p-1"
                    style={{
                      left: `calc(var(--time-col) + var(--day-width) * ${dayIndex})`,
                      top: `${startTop}px`,
                      height: `${height}px`,
                      backgroundColor: bgColor,
                      color: textColor,
                      width: `calc(var(--day-width) - 4px)`,
                      zIndex: 10,
                      margin: '0 2px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent,
                      padding: blockPadding,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      gap: showTime || showRoom ? 4 : 0,
                    }}
                  >
                    <div className={`font-bold leading-tight break-words ${compactTitle ? 'text-[11px] line-clamp-2' : 'text-[12px] line-clamp-2'}`}>
                      {displayTitle}
                    </div>
                    {showTime && (
                      <div className="text-[11px] leading-tight break-words">
                        {course.displayTime}
                      </div>
                    )}
                    {showRoom && (
                      <div className="text-[11px] leading-tight break-words">
                        {course.displayRoom}
                      </div>
                    )}
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
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-gray-100">
      <Dialog open={showMobilePrompt} onOpenChange={(open) => setShowMobilePrompt(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Best viewed on desktop</DialogTitle>
            <DialogDescription>
              For the smoothest experience (dragging, exporting, and wide calendar view), please switch to a desktop or larger tablet. You can continue on mobile, but some layouts may be constrained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => dismissMobilePrompt(true)}>
              Don&apos;t show again
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => dismissMobilePrompt(false)}>
              Continue on this device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Dialog
        open={Boolean(error) && errorDialogOpen}
        onOpenChange={(nextOpen) => setErrorDialogOpen(nextOpen)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Something went wrong</DialogTitle>
            <DialogDescription>
              We couldn&apos;t refresh the latest course data.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {error}
          </div>
          <DialogFooter>
            <Button onClick={() => setErrorDialogOpen(false)}>
              Dismiss
            </Button>
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
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-3 lg:px-8 flex flex-col min-h-0">
        <div className="mb-4 shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">Schedule Maker</h1>
            <div className="flex flex-1 justify-center">
              <QuickNavigation />
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button variant="outline" size="icon" onClick={zoomOut} aria-label="Zoom out" className="h-8 w-8">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" onClick={zoomIn} aria-label="Zoom in" className="h-8 w-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData()}
                disabled={loading}
                className="flex h-8 items-center gap-2 px-3 text-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="h-8 w-8 rounded-full border-slate-300 bg-white/70 text-slate-900 transition-colors hover:bg-white dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              {error && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setErrorDialogOpen(true)}
                  aria-label="Show error details"
                  className="h-8 w-8 border-amber-400/70 text-amber-600 transition-colors hover:bg-amber-100/60 dark:border-amber-400/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
                >
                  <FileWarning className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

  <div className="grid flex-1 min-h-0 max-h-full gap-2 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* Left Sidebar */}
          <div className="flex min-h-0 h-full flex-col gap-3 overflow-auto pr-1 hide-scrollbar">
            {/* Combined card for search and selected courses */}
            <Card className="flex flex-col bg-white/60 shadow-sm backdrop-blur-sm dark:bg-slate-900/50">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">My Courses</CardTitle>
                </div>
                {/* Search with floating results */}
                  <div className="relative text-[13px]">
                  <div className="relative">
                    <Input
                      placeholder="Search courses"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.currentTarget.value)}
                      onFocus={() => setSearchPanelVisible(true)}
                      className="h-9 rounded-md border-slate-200 pl-9 text-[13px] shadow-none focus-visible:ring-0 dark:border-slate-700"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                  
                  {/* Floating search results panel (portal to body so it overlays all columns) */}
                  {isClient &&
                    createPortal(
                      <AnimatePresence>
                        {searchPanelVisible && (
                          <motion.div
                            className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-3"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeInOut" }}
                          >
                            <div
                              className="absolute inset-0 bg-black/5 dark:bg-black/30"
                              onClick={() => setSearchPanelVisible(false)}
                            />
                            <motion.div
                              className="relative z-50 w-[min(780px,calc(100vw-32px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                              initial={{ opacity: 0, scale: 0.97, y: -6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.97, y: -6 }}
                              transition={{ duration: 0.18, ease: "easeInOut" }}
                            >
                              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-3 text-[13px] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 rounded-t-lg">
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      placeholder="Search courses"
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                      autoFocus
                                      className="h-9 rounded-md border-slate-200 pl-9 text-[13px] shadow-none focus-visible:ring-0 dark:border-slate-700"
                                    />
                                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setSearchPanelVisible(false)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="mt-3 space-y-2">
                                  <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">Filter by</p>
                                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto hide-scrollbar">
                                    <Select value={departmentTab} onValueChange={setDepartmentTab}>
                                      <SelectTrigger className="h-9 min-w-[120px] border border-slate-200 bg-white px-2 text-left text-[13px] font-medium shadow-none transition hover:bg-slate-50 focus:ring-0 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                                        <SelectValue placeholder="Department" />
                                      </SelectTrigger>
                                      <SelectContent className="text-[13px]">
                                        {departmentTabs.map((dept) => (
                                          <SelectItem key={dept} value={dept}>
                                            {dept}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                                      <SelectTrigger className="h-9 min-w-[110px] border border-slate-200 bg-white px-2 text-left text-[13px] font-medium shadow-none transition hover:bg-slate-50 focus:ring-0 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                                        <SelectValue placeholder="Section" />
                                      </SelectTrigger>
                                      <SelectContent className="text-[13px]">
                                        <SelectItem value="all">Section</SelectItem>
                                        {sectionOptions.map((section) => (
                                          <SelectItem key={section} value={section}>
                                            {section}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <Select value={dayFilter} onValueChange={setDayFilter}>
                                      <SelectTrigger className="h-9 min-w-[110px] border border-slate-200 bg-white px-2 text-left text-[13px] font-medium shadow-none transition hover:bg-slate-50 focus:ring-0 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                                        <SelectValue placeholder="Day" />
                                      </SelectTrigger>
                                      <SelectContent className="text-[13px]">
                                        <SelectItem value="all">Day</SelectItem>
                                        {DAYS.map((day) => (
                                          <SelectItem key={day} value={day}>
                                            {getFullDayName(day)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                                      <SelectTrigger className="h-9 min-w-[120px] border border-slate-200 bg-white px-2 text-left text-[13px] font-medium shadow-none transition hover:bg-slate-50 focus:ring-0 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                                        <SelectValue placeholder="Time" />
                                      </SelectTrigger>
                                      <SelectContent className="text-[13px]">
                                        <SelectItem value="all">Time</SelectItem>
                                        <SelectItem value="morning">Morning</SelectItem>
                                        <SelectItem value="afternoon">Afternoon</SelectItem>
                                        <SelectItem value="evening">Evening</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>

                              <div className="max-h-[420px] overflow-y-auto hide-scrollbar">
                                <div className="p-3 space-y-2 text-[13px]">
                                  {searchTerm.trim() === "" && suggestedCourses.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Suggested</p>
                                      {suggestedCourses.slice(0, 5).map((course) => {
                                        const isSelected = selectedCourseCodes.includes(course.code)
                                        return (
                                          <button
                                            key={`s-${course.code}`}
                                            type="button"
                                            onClick={() => {
                                              toggleCourseSelection(course.code)
                                              setSearchPanelVisible(false)
                                            }}
                                            className={`w-full rounded-lg border px-3 py-2 text-left transition hover:border-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 ${
                                              isSelected ? "border-blue-500 bg-blue-50/80 dark:bg-blue-900/30" : "border-slate-200 dark:border-slate-700"
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-3 text-[13px]">
                                              <div className="min-w-0">
                                                <p className="font-semibold text-[13px] leading-snug">{course.code}</p>
                                                <p className="text-[11px] text-slate-500 leading-snug break-words">{course.name}</p>
                                              </div>
                                              <Badge
                                                variant={isSelected ? "secondary" : "outline"}
                                                className="text-[11px] min-w-[74px] justify-center px-3"
                                              >
                                                {course.sections.length || 0} sections
                                              </Badge>
                                            </div>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {filteredCatalog.map((course) => {
                                    const isSelected = selectedCourseCodes.includes(course.code)
                                    return (
                                      <button
                                        key={course.code}
                                        type="button"
                                        onClick={() => {
                                          toggleCourseSelection(course.code)
                                          setSearchPanelVisible(false)
                                        }}
                                        className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] transition hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 ${
                                          isSelected ? "border-blue-500 bg-blue-50/70 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="font-semibold text-[13px] leading-snug">{course.code}</p>
                                            <p className="text-[11px] text-slate-500 leading-snug break-words">{course.name}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[11px] min-w-[74px] justify-center px-3">
                                              {course.sections.length} sections
                                            </Badge>
                                            {isSelected && <Badge variant="secondary" className="text-[11px]">Added</Badge>}
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>,
                      document.body
                    )}
                </div>
              </CardHeader>

              {/* Selected courses section */}
              <CardContent className="border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Selected courses</h3>
                  <p className="text-xs text-slate-500">Pick sections to send them to the calendar.</p>
                </div>
                <div className="space-y-2 max-h-[560px] overflow-y-auto">
                {selectedCourseCodes.length === 0 && (
                  <p className="text-sm text-slate-500">No courses selected yet.</p>
                )}
                {selectedCourseCodes.map((code) => {
                  const course = courseCatalog.find((c) => c.code === code)
                  if (!course) return null
                  const activeSections = selectedCourses.filter(
                    (section) => getSelectedCourseCanonicalCode(section) === code,
                  )
                  const sectionsCount = course.sections.length
                  return (
                    <div
                      key={code}
                      className="group relative space-y-1.5 border-l border-slate-200 pl-2 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold leading-tight flex items-center gap-1.5">
                            {course.code}
                            <span className="text-[11px] font-medium text-slate-500">({course.credits}U)</span>
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug break-words">{course.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {sectionsCount} section{sectionsCount === 1 ? "" : "s"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedCourses((prev) => prev.filter((c) => getSelectedCourseCanonicalCode(c) !== code))
                              setSelectedCourseCodes((prev) => prev.filter((c) => c !== code))
                            }}
                            className="h-7 w-7 rounded-full p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            title="Remove course from selected list"
                            aria-label={`Remove ${course.code} from selected courses`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {sectionsCount === 0 && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-300">No extracted sections yet.</p>
                        )}
                        {course.sections.map((section) => {
                          const isSelectedSection = activeSections.some(
                            (selected) => selected.section === section.section,
                          )
                          return (
                            <div
                              key={`${section.courseCode}-${section.section}`}
                              className="flex items-start gap-2 rounded-sm px-1.5 py-1.5"
                            >
                              <Checkbox
                                id={`${section.courseCode}-${section.section}`}
                                checked={isSelectedSection}
                                onCheckedChange={(checked) => toggleSectionSelection(section, Boolean(checked))}
                              />
                              <div className="flex-1 text-[12px] leading-snug">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-[12px]">{section.section}</span>
                                  <Badge variant={section.hasSlots ? "secondary" : "destructive"} className="text-[10px] px-2">
                                    {section.hasSlots ? `${section.remainingSlots}/${section.classSize}` : "Full"}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-500">{cleanTimeString(section.meetingTime)}</p>
                                <p className="text-[11px] text-slate-500">{cleanRoomString(section.room)}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel */}
          <div className="flex min-h-0 h-full flex-col overflow-hidden">
            <Card
              data-schedule-card
              className="flex min-h-0 h-full flex-1 flex-col overflow-hidden bg-white/60 shadow-sm backdrop-blur-sm dark:bg-slate-900/50"
            >
              <CardHeader className="schedule-card-header flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 p-6 sm:flex-nowrap">
                <div className="flex items-center gap-2">
                  {isEditingTitle ? (
                    <>
                      <Input
                        value={scheduleTitleDraft}
                        onChange={(e) => setScheduleTitleDraft(e.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            saveScheduleTitle()
                          }
                          if (event.key === "Escape") {
                            event.preventDefault()
                            cancelEditingScheduleTitle()
                          }
                        }}
                        autoFocus
                        className="h-9 w-56"
                        aria-label="Schedule title"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={saveScheduleTitle}
                        aria-label="Save schedule title"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelEditingScheduleTitle}
                        aria-label="Cancel renaming schedule"
                        className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-left text-xl font-semibold leading-tight">{scheduleTitle}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={startEditingScheduleTitle}
                        aria-label="Rename schedule title"
                        className="h-8 w-8 text-slate-500 transition hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <Select value={currentTerm} onValueChange={(value) => setCurrentTerm(value as TermName)}>
                    <SelectTrigger
                      className="h-8 min-w-[120px] border-0 bg-transparent px-0 text-left text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-slate-400"
                      style={{ paddingTop: 4, paddingBottom: 4 }}
                    >
                      <SelectValue placeholder="Term" />
                    </SelectTrigger>
                    <SelectContent align="end" className="w-36">
                      <SelectItem value="Term 1">1st Term</SelectItem>
                      <SelectItem value="Term 2">2nd Term</SelectItem>
                      <SelectItem value="Term 3">3rd Term</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <Select value={academicYearLabel} onValueChange={setAcademicYearLabel}>
                    <SelectTrigger
                      className="h-8 min-w-[120px] border-0 bg-transparent px-0 text-left text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-slate-400"
                      style={{ paddingTop: 4, paddingBottom: 4 }}
                    >
                      <SelectValue placeholder="Academic Year" />
                    </SelectTrigger>
                    <SelectContent align="end" className="w-40">
                      {academicYearOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <div className="flex-1 min-h-0 overflow-hidden px-0 pb-0 pt-0">
                  {renderScheduleView()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="flex min-h-0 h-full flex-col gap-3 overflow-auto pl-1 hide-scrollbar">
            <Card className="flex flex-col bg-white/60 shadow-sm backdrop-blur-sm dark:bg-slate-900/50">
              <CardHeader className="flex items-start justify-start py-3">
                <CardTitle className="text-base font-semibold text-left">Versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {versions.map((version) => {
                    const isActive = version.id === activeVersionState?.activeVersionId
                    const nameParts = version.name.trim().split(" ")
                    const label = nameParts[nameParts.length - 1]?.charAt(0) || version.name.charAt(0)
                    return (
                      <div key={version.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => setActiveVersion(version.id)}
                          aria-label={`Activate ${version.name}`}
                          aria-pressed={isActive}
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition ${
                            isActive
                              ? "border-rose-500 bg-rose-500/20 text-rose-600 dark:border-rose-400 dark:bg-rose-500/20 dark:text-rose-100"
                              : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          }`}
                        >
                          {label}
                        </button>
                        {versions.length > 1 && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              confirmDeleteVersion(version.id)
                            }}
                            className="absolute -top-1 -right-1 hidden h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition group-hover:flex hover:border-rose-500 hover:bg-rose-500 hover:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-400 dark:hover:bg-rose-500/80 dark:hover:text-white"
                            aria-label={`Delete ${version.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <Popover open={addVersionMenuOpen} onOpenChange={setAddVersionMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500 transition hover:border-blue-500 hover:text-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-200"
                        aria-label="Create version"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Add version
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          createVersion("new")
                          setAddVersionMenuOpen(false)
                        }}
                      >
                        Start fresh
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          createVersion("duplicate")
                          setAddVersionMenuOpen(false)
                        }}
                      >
                        Duplicate current
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
                {versionsExpanded && versions.length > 0 && (
                  <div className="space-y-2">
                    {versions.map((version) => {
                      const isActive = version.id === activeVersionState?.activeVersionId
                      return (
                        <div
                          key={`${version.id}-expanded`}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                            isActive
                              ? "border-blue-500 bg-blue-50/70 dark:bg-blue-900/20"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold">{version.name}</p>
                            <p className="text-xs text-slate-500">{version.selectedCourses.length} sections</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isActive && (
                              <Button variant="ghost" size="sm" onClick={() => setActiveVersion(version.id)}>
                                Activate
                              </Button>
                            )}
                            {versions.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => confirmDeleteVersion(version.id)}
                                aria-label="Delete version"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {!versionsExpanded && versions.length === 0 && (
                  <p className="text-sm text-slate-500">No versions yet. Use + to add one.</p>
                )}
                {versions.length > 0 && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVersionsExpanded((prev) => !prev)}
                      className="text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {versionsExpanded ? "See less" : "See more"}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/60 shadow-sm backdrop-blur-sm dark:bg-slate-900/50">
              <CardHeader className="py-3">
                <CardTitle className="text-base font-semibold">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0 text-sm">
                <div className="flex justify-between"><span>Total units</span><span>{totalSelectedCredits}</span></div>
                <div className="flex justify-between"><span>Courses selected</span><span>{selectedCourseCodes.length}</span></div>
                <div className="flex justify-between"><span>Sections added</span><span>{selectedCourses.length}</span></div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 shadow-sm backdrop-blur-sm dark:bg-slate-900/50">
              <CardHeader className="py-3">
                <CardTitle className="text-base font-semibold">Exports & actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <Button variant="outline" className="h-9 w-full justify-start gap-2 text-sm" onClick={downloadScheduleImage}>
                  <Download className="h-3.5 w-3.5" /> Download schedule
                </Button>
                <Button variant="outline" className="h-9 w-full justify-start gap-2 text-sm" onClick={openIcsDialog}>
                  <Calendar className="h-3.5 w-3.5" /> Export to calendar
                </Button>
                <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-sm" disabled>
                  <ExternalLink className="h-3.5 w-3.5" /> Add to SOLAR-OSES (soon)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
