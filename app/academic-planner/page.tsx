"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  ArrowUp,
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
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Save,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { initialCourses, curriculumCodes } from "@/lib/course-data"
import { loadCourseStatuses, loadTrackerPreferences, TRACKER_PREFERENCES_KEY } from "@/lib/course-storage"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
} from "@/components/ui/select"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { RECOMMENDED_UNITS_MIN, RECOMMENDED_UNITS_MAX, ALLOW_OVERFLOW_UNITS, PRIORITY_WEIGHTS } from "@/lib/config"
import NonCpeNotice from "@/components/non-cpe-notice"
import FeedbackDialog from "@/components/feedback-dialog"
import { cn } from "@/lib/utils"

// Course status types
type CourseStatus = "passed" | "active" | "pending" | "failed"

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

interface DependentAdjustment {
  courseId: string
  code: string
  name: string
  fromYear: number
  fromTerm: string
  toYear: number
  toTerm: string
}

interface CreditGuardrailReason {
  type: "min" | "max"
  semesterLabel: string
  credits: number
  threshold: number
}

interface CreditGuardrailDialogInfo {
  courseCode: string
  courseName: string
  targetYear: number
  targetTerm: string
  reasons: CreditGuardrailReason[]
}

type RegenerateStrategy = "balanced" | "crucial" | "easy"

interface RegeneratePreviewRow {
  label: string
  credits: number
  minTarget: number
  maxTarget: number
}

interface LinkedPairMove {
  courseId: string
  code: string
  name: string
  fromYear: number
  fromTerm: string
}

interface CreditRebalanceMove {
  courseId: string
  code: string
  name: string
  credits: number
  fromYear: number
  fromTerm: string
  toYear: number
  toTerm: string
}

interface CreditRebalancePreview {
  minCredits: number
  maxCredits: number
  plan: SemesterPlan[]
  moves: CreditRebalanceMove[]
}

interface PrereqBlockerInfo {
  courseId: string
  code: string
  name: string
  reason: "not_scheduled" | "scheduled_too_late"
  scheduledYear?: number
  scheduledTerm?: string
}

interface MoveTermOption {
  year: number
  term: string
  label: string
}

interface BlockedTermOption extends MoveTermOption {
  blockers: PrereqBlockerInfo[]
}

interface BlockedMoveDialogState {
  courseId: string
  courseCode: string
  courseName: string
  targetYear: number
  targetTerm: string
  blockers: PrereqBlockerInfo[]
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

const PERIOD_CONFIRM_PREFIX = "planner.period.confirmed"
const PERIOD_REGULAR_PREFIX = "planner.period.regular"
const CREDIT_LIMITS_STORAGE_KEY = "planner.creditLimits"
const DEFAULT_CURRICULUM_CODE_SET = new Set(
  (curriculumCodes ?? [])
    .map((code) => (typeof code === "string" ? code.toUpperCase() : ""))
    .filter((code) => Boolean(code)),
)

const TERM_ORDER = ["Term 1", "Term 2", "Term 3"] as const
const CREDIT_INPUT_MIN = 1
const CREDIT_INPUT_MAX = 29
const REGENERATE_STRATEGY_STORAGE_KEY = "planner.regenerate.strategy"
const STRICT_GUARDRAILS_STORAGE_KEY = "planner.regenerate.strict"
const REGENERATE_STRATEGY_META: Record<RegenerateStrategy, { title: string; tagline: string; description: string }> = {
  balanced: {
    title: "Balanced",
    tagline: "Evenly distributes credit load",
    description:
      "Uses every remaining term while keeping credit totals as close as possible so you avoid heavy swings.",
  },
  crucial: {
    title: "Crucial Courses First",
    tagline: "Pushes domino prerequisites early",
    description:
      "Prioritizes courses that unlock other requirements. Low-impact subjects only fill gaps once credit targets are met.",
  },
  easy: {
    title: "Easy Courses First",
    tagline: "Stacks lighter courses upfront",
    description:
      "Schedules non-prerequisite courses sooner so tougher chains land later—ideal if you want lighter near-term loads.",
  },
}

const normalizeTermLabel = (term: string): string => {
  const trimmed = term?.toString().trim() ?? ""
  if (trimmed.length === 0) return TERM_ORDER[0]

  const collapsed = trimmed.replace(/\s+/g, " ")
  const lower = collapsed.toLowerCase()

  const aliasMap: Record<string, string> = {
    "term 1": "Term 1",
    term1: "Term 1",
    "trimester 1": "Term 1",
    "1st term": "Term 1",
    "first term": "Term 1",
    "term i": "Term 1",
    "1": "Term 1",
    "term 2": "Term 2",
    term2: "Term 2",
    "trimester 2": "Term 2",
    "2nd term": "Term 2",
    "second term": "Term 2",
    "term ii": "Term 2",
    "2": "Term 2",
    "term 3": "Term 3",
    term3: "Term 3",
    "trimester 3": "Term 3",
    "3rd term": "Term 3",
    "third term": "Term 3",
    "term iii": "Term 3",
    "3": "Term 3",
  }

  if (aliasMap[lower]) return aliasMap[lower]

  const compact = lower.replace(/[^a-z0-9]/g, "")
  if (aliasMap[compact]) return aliasMap[compact]

  const containsTermKeyword = /(term|trim)/.test(lower)
  const digitMatch = lower.match(/([123])/)
  if (digitMatch && (containsTermKeyword || lower.length <= 3)) {
    const digit = Number.parseInt(digitMatch[1], 10)
    if (digit >= 1 && digit <= TERM_ORDER.length) {
      return `Term ${digit}`
    }
  }

  const ordinalWords: Record<string, string> = {
    first: "Term 1",
    second: "Term 2",
    third: "Term 3",
  }
  for (const [word, label] of Object.entries(ordinalWords)) {
    if (lower.includes(word)) {
      return label
    }
  }

  return collapsed
}

const getTermIndex = (term: string): number => TERM_ORDER.indexOf(normalizeTermLabel(term))

const termsMatch = (termA: string, termB: string): boolean => normalizeTermLabel(termA) === normalizeTermLabel(termB)

const courseNeedsPetitionForTerm = (course: Course | PlanCourse | null | undefined, targetTerm: string): boolean => {
  if (!course) return false
  if (typeof course.term !== "string" || course.term.trim() === "") return false
  return !termsMatch(course.term, targetTerm)
}

const applyPetitionFlagsToPlan = (plan: SemesterPlan[]): SemesterPlan[] => {
  if (!Array.isArray(plan)) return plan
  plan.forEach((semester) => {
    const normalizedTerm = normalizeTermLabel(semester.term)
    semester.courses.forEach((course) => {
      course.needsPetition = courseNeedsPetitionForTerm(course, normalizedTerm)
    })
  })
  return plan
}

const getNextTerm = (year: number, term: string): { year: number; term: string } => {
  const normalized = normalizeTermLabel(term)
  if (normalized === "Term 1") return { year, term: "Term 2" }
  if (normalized === "Term 2") return { year, term: "Term 3" }
  return { year: year + 1, term: "Term 1" }
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

interface ParsedPlanImportResult {
  semesters: ImportedPlanData[]
  creditPreferences?: {
    minCreditsPerTerm?: number
    maxCreditsPerTerm?: number
  }
  coursePriorities?: Record<string, keyof typeof PRIORITY_WEIGHTS>
  lockedPlacements?: Record<string, { year: number; term: string }>
}

const sanitizePrioritySnapshot = (input: unknown): Record<string, keyof typeof PRIORITY_WEIGHTS> => {
  if (!input || typeof input !== "object") return {}
  const allowedLevels = Object.keys(PRIORITY_WEIGHTS) as Array<keyof typeof PRIORITY_WEIGHTS>
  const sanitized: Record<string, keyof typeof PRIORITY_WEIGHTS> = {}

  Object.entries(input as Record<string, unknown>).forEach(([courseId, level]) => {
    if (typeof courseId !== "string" || typeof level !== "string") return
    const normalized = level.toLowerCase() as keyof typeof PRIORITY_WEIGHTS
    if (allowedLevels.includes(normalized)) {
      sanitized[courseId] = normalized
    }
  })

  return sanitized
}

const sanitizeLockedPlacementSnapshot = (
  input: unknown,
): Record<string, { year: number; term: string }> => {
  if (!input || typeof input !== "object") return {}
  const sanitized: Record<string, { year: number; term: string }> = {}

  Object.entries(input as Record<string, unknown>).forEach(([courseId, lockData]) => {
    if (typeof courseId !== "string" || !lockData || typeof lockData !== "object") return
    const year = Number((lockData as any).year)
    const term = (lockData as any).term
    if (!Number.isFinite(year) || typeof term !== "string") return
    sanitized[courseId] = {
      year,
      term: normalizeTermLabel(term),
    }
  })

  return sanitized
}

// Quick Navigation Component
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
      <Link href="/schedule-maker">
        <Button className="w-full sm:w-auto bg-purple-700 dark:bg-purple-900 bg-gradient-to-r from-purple-600 to-purple-800 hover:bg-purple-800 dark:hover:bg-purple-950 hover:from-purple-700 hover:to-purple-900 text-white flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Schedule Maker
        </Button>
      </Link>
      <Link href="/course-tracker">
        <Button className="w-full sm:w-auto bg-blue-700 dark:bg-blue-900 bg-gradient-to-r from-blue-600 to-blue-800 hover:bg-blue-800 dark:hover:bg-blue-950 hover:from-blue-700 hover:to-blue-900 text-white flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Course Tracker
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

export default function AcademicPlanner() {
  const { theme, setTheme } = useTheme()

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
  const [pendingPrereqShift, setPendingPrereqShift] = useState<
    {
      courseId: string
      targetYear: number
      targetTerm: string
      adjustments: DependentAdjustment[]
      pair?: LinkedPairMove | null
    } | null
  >(null)
  const [blockedMoveDialog, setBlockedMoveDialog] = useState<BlockedMoveDialogState | null>(null)
  const [creditGuardrailDialog, setCreditGuardrailDialog] = useState<CreditGuardrailDialogInfo | null>(null)
  const [moveSelectResetCounter, setMoveSelectResetCounter] = useState(0)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [overloadDialogOpen, setOverloadDialogOpen] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<
    { courseId: string; targetYear: number; targetTerm: string; reason?: "overload" | "petition" } | null
  >(null)
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictDetail, setConflictDetail] = useState<{ title: string; conflicts: ConflictInfo[] } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccessInfo, setImportSuccessInfo] = useState<{ semesters: number; courses: number } | null>(null)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [plannerStrategy, setPlannerStrategy] = useState<RegenerateStrategy>("balanced")
  const [pendingRegenerateStrategy, setPendingRegenerateStrategy] = useState<RegenerateStrategy>("balanced")
  const [strictGuardrailsEnabled, setStrictGuardrailsEnabled] = useState(false)
  const [pendingStrictGuardrails, setPendingStrictGuardrails] = useState(false)
  const [regeneratePreview, setRegeneratePreview] = useState<{
    plan: SemesterPlan[]
    rows: RegeneratePreviewRow[]
  } | null>(null)
  const [regeneratePreviewLoading, setRegeneratePreviewLoading] = useState(false)
  const [pendingRegenerateMin, setPendingRegenerateMin] = useState(RECOMMENDED_UNITS_MIN)
  const [pendingRegenerateMax, setPendingRegenerateMax] = useState(RECOMMENDED_UNITS_MAX)
  const [regenerateCreditError, setRegenerateCreditError] = useState<string | null>(null)
  const [regenerateToast, setRegenerateToast] = useState<
    { strategy: RegenerateStrategy; strict: boolean; min: number; max: number } | null
  >(null)
  const [lastRegenerateResult, setLastRegenerateResult] = useState<
    { strategy: RegenerateStrategy; strict: boolean; min: number; max: number } | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [unscheduledCoursesRef, setUnscheduledCoursesRef] = useState<HTMLDivElement | null>(null)
  const [showFloatingUnscheduled, setShowFloatingUnscheduled] = useState(false)
  const [planActionsRef, setPlanActionsRef] = useState<HTMLDivElement | null>(null)
  const [showFloatingPlanActions, setShowFloatingPlanActions] = useState(false)
  const [floatingControlsVisible, setFloatingControlsVisible] = useState(false)
  const [planActionsFloatingVisible, setPlanActionsFloatingVisible] = useState(false)
  const [unscheduledFloatingVisible, setUnscheduledFloatingVisible] = useState(false)
  const [floatingControlsEntering, setFloatingControlsEntering] = useState(false)
  const [planActionsFloatingEntering, setPlanActionsFloatingEntering] = useState(false)
  const [unscheduledFloatingEntering, setUnscheduledFloatingEntering] = useState(false)
  const creditSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingCreditSaveCallbacksRef = useRef<(() => void)[]>([])
  const confirmButtonShakeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [planActionsCollapsed, setPlanActionsCollapsed] = useState(false)
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false)
  const [showAllUnscheduled, setShowAllUnscheduled] = useState(false)
  const topHeaderRef = useRef<HTMLDivElement | null>(null)
  const graduationSummaryRef = useRef<HTMLDivElement | null>(null)
  const [topContentVisible, setTopContentVisible] = useState(true)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [minCreditsPerTerm, setMinCreditsPerTerm] = useState(RECOMMENDED_UNITS_MIN)
  const [maxCreditsPerTerm, setMaxCreditsPerTerm] = useState(RECOMMENDED_UNITS_MAX)
  const [draftMinCreditsPerTerm, setDraftMinCreditsPerTerm] = useState(RECOMMENDED_UNITS_MIN)
  const [draftMaxCreditsPerTerm, setDraftMaxCreditsPerTerm] = useState(RECOMMENDED_UNITS_MAX)
  const [creditLimitsDirty, setCreditLimitsDirty] = useState(false)
  const [creditSaveMessage, setCreditSaveMessage] = useState<string | null>(null)
  const [creditLimitError, setCreditLimitError] = useState<string | null>(null)
  const [confirmButtonShaking, setConfirmButtonShaking] = useState(false)
  const [creditPreview, setCreditPreview] = useState<CreditRebalancePreview | null>(null)
  const [creditPreviewDialogOpen, setCreditPreviewDialogOpen] = useState(false)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(false)
  const bottomNavigationRef = useRef<HTMLDivElement | null>(null)
  const resetMoveSelects = useCallback(() => {
    setMoveSelectResetCounter((prev) => prev + 1)
  }, [])

  const scrollToPageTop = useCallback(() => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])
  // Track if we've already shown the regular-student curriculum notice
  const [regularNoticeShown, setRegularNoticeShown] = useState(false)
  const [regularNoticeTerm, setRegularNoticeTerm] = useState<{ year: number; term: string } | null>(null)
  const [regularNoticeOpen, setRegularNoticeOpen] = useState(false)
  // Course priorities and locked placements (persisted)
  const [coursePriorities, setCoursePriorities] = useState<Record<string, keyof typeof PRIORITY_WEIGHTS>>({})
  const [lockedPlacements, setLockedPlacements] = useState<Record<string, { year: number; term: string }>>({})
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [periodDialogKey, setPeriodDialogKey] = useState<string | null>(null)
  const [regularPeriodDialogOpen, setRegularPeriodDialogOpen] = useState(false)
  const [regularPeriodInfo, setRegularPeriodInfo] = useState<{ year: number; term: string; courses: Course[] } | null>(null)
  const hasCustomCurriculum = useMemo(
    () => courses.some((course) => !DEFAULT_CURRICULUM_CODE_SET.has((course.code || "").toUpperCase())),
    [courses],
  )
  const shouldPromptCreditConfirmation =
    hasCustomCurriculum &&
    ((minCreditsPerTerm === RECOMMENDED_UNITS_MIN && maxCreditsPerTerm === RECOMMENDED_UNITS_MAX) || creditLimitsDirty)
  const isMaxCreditsAtOrBelowMin = draftMaxCreditsPerTerm <= draftMinCreditsPerTerm
  const normalizedAppliedMaxPreference = Number.isFinite(maxCreditsPerTerm)
    ? Math.min(CREDIT_INPUT_MAX, Math.max(CREDIT_INPUT_MIN, Math.trunc(maxCreditsPerTerm)))
    : RECOMMENDED_UNITS_MAX
  const effectiveMaxCreditsPerTerm = normalizedAppliedMaxPreference
  const effectiveMaxCreditsWithOverflow = effectiveMaxCreditsPerTerm + ALLOW_OVERFLOW_UNITS

  const dependentCoursesMap = useMemo(() => {
    const map = new Map<string, Course[]>()
    courses.forEach((courseItem) => {
      const prereqs = Array.isArray((courseItem as any).prerequisites) ? courseItem.prerequisites : []
      prereqs.forEach((prereqId) => {
        if (!map.has(prereqId)) {
          map.set(prereqId, [])
        }
        const linked = map.get(prereqId)!
        if (!linked.some((dependentCourse) => dependentCourse.id === courseItem.id)) {
          linked.push(courseItem)
        }
      })
    })
    return map
  }, [courses])

  useEffect(() => {
    if (!shouldPromptCreditConfirmation) {
      setCreditLimitError(null)
    }
  }, [shouldPromptCreditConfirmation])

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateVisibilityStates = () => {
      setShowJumpButton(window.scrollY > 400)

      if (!bottomNavigationRef.current) {
        setIsBottomNavVisible(false)
        return
      }

      const rect = bottomNavigationRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      setIsBottomNavVisible(rect.top < viewportHeight && rect.bottom >= 0)
    }

    updateVisibilityStates()
    window.addEventListener("scroll", updateVisibilityStates)
    window.addEventListener("resize", updateVisibilityStates)

    return () => {
      window.removeEventListener("scroll", updateVisibilityStates)
      window.removeEventListener("resize", updateVisibilityStates)
    }
  }, [])

  // Load persisted settings
  useEffect(() => {
    try {
      const p = localStorage.getItem("planner.priorities")
      const l = localStorage.getItem("planner.locks")
      if (p) setCoursePriorities(JSON.parse(p))
      if (l) {
        const parsedLocks = JSON.parse(l)
        setLockedPlacements(normalizeLockPairsWithLinkedCourses(parsedLocks))
      }
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem("planner.priorities", JSON.stringify(coursePriorities)) } catch {}
  }, [coursePriorities])
  useEffect(() => {
    try { localStorage.setItem("planner.locks", JSON.stringify(lockedPlacements)) } catch {}
  }, [lockedPlacements])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(CREDIT_LIMITS_STORAGE_KEY)
      if (!stored) {
        setDraftMinCreditsPerTerm(RECOMMENDED_UNITS_MIN)
        setDraftMaxCreditsPerTerm(RECOMMENDED_UNITS_MAX)
        setCreditLimitsDirty(false)
        setCreditSaveMessage(null)
        return
      }
      const parsed = JSON.parse(stored)
      let resolvedMin = RECOMMENDED_UNITS_MIN
      let resolvedMax = RECOMMENDED_UNITS_MAX
      if (typeof parsed?.min === "number" && Number.isFinite(parsed.min)) {
        resolvedMin = normalizeCreditInput(parsed.min)
      }
      if (typeof parsed?.max === "number" && Number.isFinite(parsed.max)) {
        resolvedMax = normalizeCreditInput(parsed.max)
      }
      setMinCreditsPerTerm(resolvedMin)
      setMaxCreditsPerTerm(resolvedMax)
      setDraftMinCreditsPerTerm(resolvedMin)
      setDraftMaxCreditsPerTerm(resolvedMax)
    } catch (err) {
      console.error("Error loading credit limits:", err)
    }
    setCreditLimitsDirty(false)
    setCreditSaveMessage(null)
  }, [])

  useEffect(() => {
    return () => {
      clearCreditSaveMessageTimeout()
      clearConfirmShakeTimeout()
    }
  }, [])

  // Load saved course statuses and available sections on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Load course statuses
      const savedCourses = loadCourseStatuses()
      if (savedCourses) {
        // Normalize saved courses by merging with initial course definitions to ensure stable fields
        const baseById = new Map((initialCourses as any[]).map((c: any) => [c.id, c]))
        const normalized: Course[] = savedCourses.map((c: any) => {
          const base = baseById.get(c.id) || {}
          return {
            // Base first to provide defaults, then saved overrides
            ...(base as any),
            ...(c as any),
            // Ensure required fields exist and are well-typed
            prerequisites: Array.isArray(c.prerequisites)
              ? c.prerequisites
              : Array.isArray((base as any).prerequisites)
              ? (base as any).prerequisites
              : [],
            description:
              typeof c.description === "string" || c.description === null
                ? c.description
                : (base as any).description ?? null,
            credits: Number.isFinite(c.credits) ? c.credits : (base as any).credits ?? 0,
            year: Number.isFinite(c.year) ? c.year : (base as any).year ?? new Date().getFullYear(),
            term:
              typeof c.term === "string"
                ? normalizeTermLabel(c.term)
                : (typeof (base as any).term === "string" ? normalizeTermLabel((base as any).term) : "Term 1"),
            status: (c.status as CourseStatus) ?? (base as any).status ?? "pending",
          } as Course
        })
        setCourses(normalized)

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

  useEffect(() => {
    if (typeof window === "undefined") return

    const applyTrackerPreferences = () => {
      const prefs = loadTrackerPreferences()
      if (!prefs) return

      let resolvedStartYear: number | null = null
      if (
        typeof prefs.startYear === "number" &&
        Number.isFinite(prefs.startYear) &&
        prefs.startYear >= 2000 &&
        prefs.startYear <= 2100
      ) {
        resolvedStartYear = Math.floor(prefs.startYear)
        setStartYear(resolvedStartYear)
        try {
          window.localStorage.setItem("startYear", resolvedStartYear.toString())
        } catch {}
      }

      let baseStartYear = resolvedStartYear
      if (baseStartYear === null) {
        const storedYear = Number.parseInt(window.localStorage.getItem("startYear") || "", 10)
        if (!Number.isNaN(storedYear)) {
          baseStartYear = storedYear
        }
      }

      if (
        typeof prefs.currentYearLevel === "number" &&
        Number.isFinite(prefs.currentYearLevel) &&
        prefs.currentYearLevel >= 1 &&
        baseStartYear !== null
      ) {
        const sanitizedLevel = Math.max(1, Math.floor(prefs.currentYearLevel))
        setCurrentYear(baseStartYear + sanitizedLevel - 1)
      }

      if (typeof prefs.currentTerm === "string") {
        const normalizedPrefTerm = normalizeTermLabel(prefs.currentTerm)
        if (TERM_ORDER.includes(normalizedPrefTerm as (typeof TERM_ORDER)[number])) {
          setCurrentTerm(normalizedPrefTerm)
        }
      }
    }

    applyTrackerPreferences()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === TRACKER_PREFERENCES_KEY) {
        applyTrackerPreferences()
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedStrategy = window.localStorage.getItem(REGENERATE_STRATEGY_STORAGE_KEY) as RegenerateStrategy | null
    if (storedStrategy === "balanced" || storedStrategy === "crucial" || storedStrategy === "easy") {
      setPlannerStrategy(storedStrategy)
      setPendingRegenerateStrategy(storedStrategy)
    }
    const strictRaw = window.localStorage.getItem(STRICT_GUARDRAILS_STORAGE_KEY)
    if (strictRaw !== null) {
      const strictValue = strictRaw === "true"
      setStrictGuardrailsEnabled(strictValue)
      setPendingStrictGuardrails(strictValue)
    }
  }, [])

  // Generate graduation plan when courses or available sections change
  useEffect(() => {
    if (!loading) {
      generateGraduationPlan()
    }
  }, [courses, availableSections, loading, currentYear, currentTerm])
  // Regenerate when priorities/locks change
  useEffect(() => {
    if (!loading) {
      generateGraduationPlan()
    }
  }, [coursePriorities, lockedPlacements])

  // Detect conflicts whenever graduation plan changes
  useEffect(() => {
    detectConflicts()
  }, [
    graduationPlan,
    strictGuardrailsEnabled,
    minCreditsPerTerm,
    effectiveMaxCreditsPerTerm,
    effectiveMaxCreditsWithOverflow,
    lastRegenerateResult,
  ])

  const activeCourses = useMemo(() => courses.filter((course) => course.status === "active"), [courses])
  const activeCourseHash = useMemo(() => JSON.stringify(activeCourses.map((course) => course.id).sort()), [activeCourses])

  const currentTermPlanCourses = useMemo(() => {
    const semester = graduationPlan.find((plan) => plan.year === currentYear && termsMatch(plan.term, currentTerm))
    if (semester) return semester.courses

    const curriculumYear = currentYear - startYear + 1
    return courses.filter((course) => {
      if (!Number.isFinite(course.year)) return false
      const courseCalendarYear = startYear + (course.year - 1)
      return courseCalendarYear === currentYear && termsMatch(course.term, currentTerm)
    })
  }, [graduationPlan, currentYear, currentTerm, courses, startYear])

  const currentTermPlanUnits = useMemo(
    () => currentTermPlanCourses.reduce((total, course) => total + (Number(course.credits) || 0), 0),
    [currentTermPlanCourses],
  )

  const summarizeCreditSpread = (
    plan: SemesterPlan[],
    targets?: { min?: number; max?: number },
  ): RegeneratePreviewRow[] => {
    if (!Array.isArray(plan) || plan.length === 0) {
      return []
    }
    const minTargetValue = typeof targets?.min === "number" ? targets.min : minCreditsPerTerm
    const maxTargetValue = typeof targets?.max === "number" ? targets.max : effectiveMaxCreditsPerTerm
    return plan.map((semester) => ({
      label: `${formatAcademicYear(semester.year)} ${semester.term}`,
      credits: semester.courses.reduce((sum, course) => sum + (course.credits ?? 0), 0),
      minTarget: minTargetValue,
      maxTarget: maxTargetValue,
    }))
  }

  const creditPreviewMoves = creditPreview?.moves ?? []
  const creditPreviewMoveCount = creditPreviewMoves.length

  const dependentsMap = useMemo(() => {
    const map = new Map<string, string[]>()
    courses.forEach((course) => {
      const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []
      prereqs.forEach((prereqId) => {
        if (!map.has(prereqId)) {
          map.set(prereqId, [])
        }
        map.get(prereqId)!.push(course.id)
      })
    })
    return map
  }, [courses])

  const dependentsCount = useMemo(() => {
    const counts = new Map<string, number>()
    dependentsMap.forEach((dependents, prereqId) => counts.set(prereqId, dependents.length))
    return counts
  }, [dependentsMap])

  useEffect(() => {
    if (graduationPlan.length === 0) return
    setGraduationPlan((prevPlan) => {
      if (!prevPlan || prevPlan.length === 0) return prevPlan
      const balanced = rebalancePlanForCreditLimits(prevPlan, {
        allowCurrentTermActiveMoves: true,
        minCredits: strictGuardrailsEnabled ? minCreditsPerTerm : undefined,
        maxCredits: strictGuardrailsEnabled ? effectiveMaxCreditsPerTerm : undefined,
      })
      if (balanced === prevPlan) return prevPlan
      return applyPetitionFlagsToPlan(balanced)
    })
  }, [
    graduationPlan,
    effectiveMaxCreditsPerTerm,
    coursePriorities,
    dependentsCount,
    dependentsMap,
    lockedPlacements,
    minCreditsPerTerm,
    currentYear,
    currentTerm,
    courses,
    strictGuardrailsEnabled,
  ])

  useEffect(() => {
    if (!regenerateDialogOpen) return
    if (typeof window === "undefined") return
    setRegeneratePreviewLoading(true)
    const validationMessage = getCreditLimitValidationMessage(pendingRegenerateMin, pendingRegenerateMax)
    if (validationMessage) {
      setRegeneratePreview(null)
      setRegeneratePreviewLoading(false)
      return
    }
    const timer = window.setTimeout(() => {
      const previewPlan =
        generateGraduationPlan({
          strategy: pendingRegenerateStrategy,
          strictCredits: pendingStrictGuardrails,
          previewOnly: true,
          minCredits: pendingRegenerateMin,
          maxCredits: pendingRegenerateMax,
        }) ?? []
      setRegeneratePreview({
        plan: previewPlan,
        rows: summarizeCreditSpread(previewPlan, {
          min: pendingRegenerateMin,
          max: pendingRegenerateMax,
        }),
      })
      setRegeneratePreviewLoading(false)
    }, 80)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    regenerateDialogOpen,
    pendingRegenerateStrategy,
    pendingStrictGuardrails,
    courses,
    coursePriorities,
    lockedPlacements,
    currentYear,
    currentTerm,
    minCreditsPerTerm,
    effectiveMaxCreditsPerTerm,
    pendingRegenerateMin,
    pendingRegenerateMax,
  ])

  const openRegeneratePlanDialog = useCallback(() => {
    setPendingRegenerateStrategy(plannerStrategy)
    setPendingStrictGuardrails(strictGuardrailsEnabled)
    setPendingRegenerateMin(minCreditsPerTerm)
    setPendingRegenerateMax(maxCreditsPerTerm)
    setRegenerateCreditError(null)
    setRegenerateDialogOpen(true)
  }, [plannerStrategy, strictGuardrailsEnabled, minCreditsPerTerm, maxCreditsPerTerm])

  const handleRegenerateImportClick = () => {
    setRegenerateDialogOpen(false)
    const openImport = () => setImportDialogOpen(true)
    if (typeof window !== "undefined") {
      window.setTimeout(openImport, 80)
    } else {
      openImport()
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const key = `${currentYear}-${currentTerm}`
    setPeriodDialogKey(key)
    const hashKey = `${PERIOD_CONFIRM_PREFIX}:${key}:hash`
    const previousHash = window.sessionStorage.getItem(hashKey)
    if (!previousHash || previousHash !== activeCourseHash) {
      window.sessionStorage.removeItem(`${PERIOD_CONFIRM_PREFIX}:${key}`)
      window.sessionStorage.setItem(hashKey, activeCourseHash)
    }
    const confirmed = window.sessionStorage.getItem(`${PERIOD_CONFIRM_PREFIX}:${key}`) === "true"
    if (!confirmed) {
      setPeriodDialogOpen(true)
    }
  }, [currentYear, currentTerm, activeCourseHash])

  const finalizePeriodDialogConfirmation = useCallback(() => {
    let nextRegularInfo: { year: number; term: string; courses: Course[] } | null = null
    if (typeof window !== "undefined") {
      if (periodDialogKey) {
        try {
          window.sessionStorage.setItem(`${PERIOD_CONFIRM_PREFIX}:${periodDialogKey}`, "true")
          window.sessionStorage.setItem(`${PERIOD_CONFIRM_PREFIX}:${periodDialogKey}:hash`, activeCourseHash)
        } catch {
          // ignore write errors
        }
      }

      nextRegularInfo = (() => {
        if (!currentTermPlanCourses.length) return null
        const curriculumYear = currentYear - startYear + 1
        if (!Number.isFinite(curriculumYear) || curriculumYear < 1) return null
        const curriculumCourses = (initialCourses as unknown as Course[]).filter(
          (course) => course.year === curriculumYear && termsMatch(course.term, currentTerm),
        )
        if (!curriculumCourses.length) return null
        if (curriculumCourses.length !== currentTermPlanCourses.length) return null
        const planIds = new Set(currentTermPlanCourses.map((course) => course.id))
        const allMatch = curriculumCourses.every((course) => planIds.has(course.id))
        return allMatch ? { year: currentYear, term: currentTerm, courses: curriculumCourses as Course[] } : null
      })()

      if (nextRegularInfo) {
        const matchKey = `${nextRegularInfo.year}-${nextRegularInfo.term}`
        const storageKey = `${PERIOD_REGULAR_PREFIX}:${matchKey}`
        const alreadyShown = window.sessionStorage.getItem(storageKey) === "true"
        if (!alreadyShown) {
          try {
            window.sessionStorage.setItem(storageKey, "true")
          } catch {
            // ignore write errors
          }
          setRegularPeriodInfo(nextRegularInfo)
          setRegularPeriodDialogOpen(true)
        }
      }
    }

    setPeriodDialogOpen(false)
    openRegeneratePlanDialog()
  }, [
    activeCourseHash,
    currentTerm,
    currentTermPlanCourses,
    currentYear,
    periodDialogKey,
    startYear,
    openRegeneratePlanDialog,
  ])

  const confirmPeriodDialog = () => {
    if (shouldPromptCreditConfirmation) {
      const validationMessage = getCreditLimitValidationMessage(draftMinCreditsPerTerm, draftMaxCreditsPerTerm)
      if (validationMessage) {
        setCreditLimitError(validationMessage)
        triggerConfirmButtonShake()
        return
      }
      setCreditLimitError(null)
    }

    if (creditLimitsDirty) {
      handleSaveCreditPreferences(() => finalizePeriodDialogConfirmation())
      return
    }

    finalizePeriodDialogConfirmation()
  }

  // Auto-detect "regular student" semesters: if a generated semester contains all
  // curriculum courses for its curriculum year+term, show a one-time popup notice
  // informing that the planner will prefer curriculum defaults for that term.
  useEffect(() => {
    if (!graduationPlan || graduationPlan.length === 0 || regularNoticeShown) return

    for (const semester of graduationPlan) {
      // Convert calendar year back to curriculum relative year
      const curriculumYear = semester.year - startYear + 1

      // Find curriculum's courses for that curriculum year and term from initialCourses
      const curriculumCourses = (initialCourses as any[]).filter(
        (c: any) => c.year === curriculumYear && termsMatch(c.term, semester.term),
      )

      if (!curriculumCourses || curriculumCourses.length === 0) continue

      const curriculumIds = new Set(curriculumCourses.map((c: any) => c.id))
      const semesterIds = new Set(semester.courses.map((c: any) => c.id))

      // If semester contains all curriculum course IDs, we consider it a regular-student term
      const allIncluded = [...curriculumIds].every((id) => semesterIds.has(id))
      if (!allIncluded) continue

      setRegularNoticeTerm({ year: semester.year, term: normalizeTermLabel(semester.term) })
      setRegularNoticeOpen(true)
      setRegularNoticeShown(true)
      break
    }
  }, [graduationPlan, startYear, regularNoticeShown])

  // Track visibility of unscheduled courses section
  useEffect(() => {
    if (!unscheduledCoursesRef) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingUnscheduled(!entry.isIntersecting && getUnscheduledCourses().length > 0 && !topContentVisible)
      },
      { threshold: 0.1 },
    )

    observer.observe(unscheduledCoursesRef)

    return () => observer.disconnect()
  }, [unscheduledCoursesRef, graduationPlan, topContentVisible])

  // Track visibility of plan actions section
  useEffect(() => {
    if (!planActionsRef) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingPlanActions(!entry.isIntersecting && !topContentVisible)
      },
      { threshold: 0.1 },
    )

    observer.observe(planActionsRef)

    return () => observer.disconnect()
  }, [planActionsRef, topContentVisible])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (isMobile) {
      setPlanActionsCollapsed(true)
      setUnscheduledCollapsed(true)
    } else {
      setPlanActionsCollapsed(false)
      setUnscheduledCollapsed(false)
    }
  }, [isMobile])

  useEffect(() => {
    const targets = [topHeaderRef.current, graduationSummaryRef.current].filter(Boolean) as Element[]
    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.1)
        setTopContentVisible(visible)
      },
      { threshold: [0, 0.1, 0.25, 0.5] },
    )

    targets.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  const floatingControlsActive = showFloatingPlanActions || showFloatingUnscheduled

  // Smooth visibility transitions for floating controls
  useEffect(() => {
    if (floatingControlsActive) {
      setFloatingControlsVisible(true)
      const raf = window.requestAnimationFrame(() => setFloatingControlsEntering(true))
      return () => window.cancelAnimationFrame(raf)
    }

    setFloatingControlsEntering(false)
    const timeout = window.setTimeout(() => setFloatingControlsVisible(false), 250)
    return () => window.clearTimeout(timeout)
  }, [floatingControlsActive])

  useEffect(() => {
    if (showFloatingPlanActions) {
      setPlanActionsFloatingVisible(true)
      const raf = window.requestAnimationFrame(() => setPlanActionsFloatingEntering(true))
      return () => window.cancelAnimationFrame(raf)
    }

    setPlanActionsFloatingEntering(false)
    const timeout = window.setTimeout(() => setPlanActionsFloatingVisible(false), 250)
    return () => window.clearTimeout(timeout)
  }, [showFloatingPlanActions])

  useEffect(() => {
    if (showFloatingUnscheduled) {
      setUnscheduledFloatingVisible(true)
      const raf = window.requestAnimationFrame(() => setUnscheduledFloatingEntering(true))
      return () => window.cancelAnimationFrame(raf)
    }

    setUnscheduledFloatingEntering(false)
    const timeout = window.setTimeout(() => setUnscheduledFloatingVisible(false), 250)
    return () => window.clearTimeout(timeout)
  }, [showFloatingUnscheduled])

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

  const openConflictDialog = (title: string, entries: ConflictInfo[]) => {
    if (!entries || entries.length === 0) return
    setConflictDetail({ title, conflicts: entries })
    setConflictDialogOpen(true)
  }

  // Find a course by its code
  const findCourseByCode = (code: string): Course | undefined => {
    return courses.find((course) => course.code === code)
  }

  // Check if all prerequisites for a course are passed
  const arePrerequisitesMet = (course: Course): boolean => {
    const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []
    if (prereqs.length === 0) return true

    return prereqs.every((prereqId) => {
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
  const normalizeCreditInput = (value: number) => {
    if (!Number.isFinite(value)) return 0
    const whole = Math.trunc(value)
    return Math.min(CREDIT_INPUT_MAX, Math.max(0, whole))
  }

  const getCreditLimitValidationMessage = (nextMin: number, nextMax: number) => {
    if (nextMin < CREDIT_INPUT_MIN || nextMax < CREDIT_INPUT_MIN) {
      return `Enter at least ${CREDIT_INPUT_MIN} unit${CREDIT_INPUT_MIN === 1 ? "" : "s"} for both fields.`
    }
    if (nextMin > CREDIT_INPUT_MAX || nextMax > CREDIT_INPUT_MAX) {
      return `Unit limits cannot exceed ${CREDIT_INPUT_MAX}.`
    }
    if (nextMax <= nextMin) {
      return "Maximum units must be greater than minimum units."
    }
    return null
  }

  const clearCreditSaveMessageTimeout = () => {
    if (creditSaveTimeoutRef.current) {
      clearTimeout(creditSaveTimeoutRef.current)
      creditSaveTimeoutRef.current = null
    }
  }

  const clearConfirmShakeTimeout = () => {
    if (confirmButtonShakeTimeoutRef.current) {
      clearTimeout(confirmButtonShakeTimeoutRef.current)
      confirmButtonShakeTimeoutRef.current = null
    }
  }

  const triggerConfirmButtonShake = () => {
    setConfirmButtonShaking(true)
    clearConfirmShakeTimeout()
    confirmButtonShakeTimeoutRef.current = setTimeout(() => {
      setConfirmButtonShaking(false)
      confirmButtonShakeTimeoutRef.current = null
    }, 550)
  }

  const computeCreditRebalanceMoves = (currentPlan: SemesterPlan[], nextPlan: SemesterPlan[]): CreditRebalanceMove[] => {
    if (!Array.isArray(currentPlan) || !Array.isArray(nextPlan)) return []

    const currentPlacement = new Map<string, { year: number; term: string; course?: PlanCourse }>()
    currentPlan.forEach((semester) => {
      semester.courses.forEach((course) => {
        currentPlacement.set(course.id, { year: semester.year, term: semester.term, course })
      })
    })

    const nextPlacement = new Map<string, { year: number; term: string }>()
    nextPlan.forEach((semester) => {
      semester.courses.forEach((course) => {
        nextPlacement.set(course.id, { year: semester.year, term: semester.term })
      })
    })

    const moves: CreditRebalanceMove[] = []
    currentPlacement.forEach((fromPlacement, courseId) => {
      const destination = nextPlacement.get(courseId)
      if (!destination) return
      if (fromPlacement.year === destination.year && termsMatch(fromPlacement.term, destination.term)) return

      const courseDetails = fromPlacement.course || findCourseById(courseId)
      moves.push({
        courseId,
        code: courseDetails?.code || "",
        name: courseDetails?.name || "Untitled Course",
        credits: courseDetails?.credits ?? 0,
        fromYear: fromPlacement.year,
        fromTerm: normalizeTermLabel(fromPlacement.term),
        toYear: destination.year,
        toTerm: normalizeTermLabel(destination.term),
      })
    })

    moves.sort((a, b) => {
      const fromComparison = compareSemesters(a.fromYear, a.fromTerm, b.fromYear, b.fromTerm)
      if (fromComparison !== 0) return fromComparison
      return compareSemesters(a.toYear, a.toTerm, b.toYear, b.toTerm)
    })

    return moves
  }

  const synchronizeCreditDirtyState = useCallback(
    (nextMin: number, nextMax: number) => {
      const changed = nextMin !== minCreditsPerTerm || nextMax !== maxCreditsPerTerm
      setCreditLimitsDirty(changed)
      if (changed) {
        setCreditSaveMessage(null)
        clearCreditSaveMessageTimeout()
      }
    },
    [minCreditsPerTerm, maxCreditsPerTerm],
  )

  const handleMinCreditsChange = (value: number) => {
    const sanitized = normalizeCreditInput(value)
    setDraftMinCreditsPerTerm(sanitized)
    synchronizeCreditDirtyState(sanitized, draftMaxCreditsPerTerm)
    if (shouldPromptCreditConfirmation) {
      setCreditLimitError(getCreditLimitValidationMessage(sanitized, draftMaxCreditsPerTerm))
    }
  }

  const handleMaxCreditsChange = (value: number) => {
    const sanitized = normalizeCreditInput(value)
    setDraftMaxCreditsPerTerm(sanitized)
    synchronizeCreditDirtyState(draftMinCreditsPerTerm, sanitized)
    if (shouldPromptCreditConfirmation) {
      setCreditLimitError(getCreditLimitValidationMessage(draftMinCreditsPerTerm, sanitized))
    }
  }

  const handlePendingRegenerateMinChange = (value: number) => {
    const sanitized = normalizeCreditInput(value)
    setPendingRegenerateMin(sanitized)
    setRegenerateCreditError(getCreditLimitValidationMessage(sanitized, pendingRegenerateMax))
  }

  const handlePendingRegenerateMaxChange = (value: number) => {
    const sanitized = normalizeCreditInput(value)
    setPendingRegenerateMax(sanitized)
    setRegenerateCreditError(getCreditLimitValidationMessage(pendingRegenerateMin, sanitized))
  }

  const resetCreditLimitPreferences = () => {
    setDraftMinCreditsPerTerm(RECOMMENDED_UNITS_MIN)
    setDraftMaxCreditsPerTerm(RECOMMENDED_UNITS_MAX)
    synchronizeCreditDirtyState(RECOMMENDED_UNITS_MIN, RECOMMENDED_UNITS_MAX)
    setCreditLimitError(null)
  }

  const handleSaveCreditPreferences = useCallback(
    (afterApply?: () => void) => {
      const validationMessage = getCreditLimitValidationMessage(draftMinCreditsPerTerm, draftMaxCreditsPerTerm)
      if (validationMessage) {
        setCreditLimitError(validationMessage)
        triggerConfirmButtonShake()
        return
      }

      setCreditLimitError(null)
      if (!creditLimitsDirty) {
        if (afterApply) afterApply()
        return
      }

      if (afterApply) {
        pendingCreditSaveCallbacksRef.current = [...pendingCreditSaveCallbacksRef.current, afterApply]
      }

      const sanitizedMin = normalizeCreditInput(draftMinCreditsPerTerm)
      const sanitizedMax = normalizeCreditInput(draftMaxCreditsPerTerm)
      const previewPlan = rebalancePlanForCreditLimits(graduationPlan, {
        allowCurrentTermActiveMoves: true,
        minCredits: sanitizedMin,
        maxCredits: sanitizedMax,
      })

      const moves = computeCreditRebalanceMoves(graduationPlan, previewPlan)
      setCreditPreview({
        minCredits: sanitizedMin,
        maxCredits: sanitizedMax,
        plan: previewPlan,
        moves,
      })
      setCreditPreviewDialogOpen(true)
    },
    [
      draftMinCreditsPerTerm,
      draftMaxCreditsPerTerm,
      creditLimitsDirty,
      graduationPlan,
      triggerConfirmButtonShake,
    ],
  )

  const handleCreditPreviewConfirm = () => {
    if (!creditPreview) {
      setCreditPreviewDialogOpen(false)
      return
    }

    const { minCredits, maxCredits, plan } = creditPreview
    setMinCreditsPerTerm(minCredits)
    setMaxCreditsPerTerm(maxCredits)
    setDraftMinCreditsPerTerm(minCredits)
    setDraftMaxCreditsPerTerm(maxCredits)
    setCreditLimitsDirty(false)
    setCreditLimitError(null)

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          CREDIT_LIMITS_STORAGE_KEY,
          JSON.stringify({ min: minCredits, max: maxCredits }),
        )
      } catch (err) {
        console.error("Error saving credit limits:", err)
      }
    }

    clearCreditSaveMessageTimeout()
    setCreditSaveMessage("Unit limits saved")
    creditSaveTimeoutRef.current = setTimeout(() => setCreditSaveMessage(null), 4000)

    if (plan !== graduationPlan) {
      setGraduationPlan(applyPetitionFlagsToPlan(plan))
    }

    setCreditPreview(null)
    setCreditPreviewDialogOpen(false)

    const callbacks = pendingCreditSaveCallbacksRef.current
    pendingCreditSaveCallbacksRef.current = []
    callbacks.forEach((callback, index) => {
      if (typeof callback !== "function") {
        if (callback != null) {
          console.warn(`Skipping non-function credit-save callback at index ${index}`)
        }
        return
      }
      try {
        callback()
      } catch (err) {
        console.error("Error running post-save callback:", err)
      }
    })
  }

  const handleCreditPreviewCancel = () => {
    pendingCreditSaveCallbacksRef.current = []
    setCreditPreviewDialogOpen(false)
    setCreditPreview(null)
  }

  // Helper to get the previous term
  const getPreviousTerm = (year: number, term: string): { year: number; term: string } => {
    const normalized = normalizeTermLabel(term)
    if (normalized === "Term 3") return { year, term: "Term 2" }
    if (normalized === "Term 2") return { year, term: "Term 1" }
    return { year: year - 1, term: "Term 3" }
  }

  const isCurrentSemester = (year: number, term: string) => year === currentYear && termsMatch(term, currentTerm)

  const compareSemesters = (aYear: number, aTerm: string, bYear: number, bTerm: string): number => {
    if (aYear !== bYear) return aYear - bYear
    const aIndex = getTermIndex(aTerm)
    const bIndex = getTermIndex(bTerm)
    if (aIndex === -1 || bIndex === -1) {
      return normalizeTermLabel(aTerm).localeCompare(normalizeTermLabel(bTerm))
    }
    return aIndex - bIndex
  }

  const getCourseLocationInPlan = (courseId: string): { year: number; term: string } | null => {
    for (const semester of graduationPlan) {
      if (semester.courses.some((course) => course.id === courseId)) {
        return { year: semester.year, term: semester.term }
      }
    }
    return null
  }

  const getPlanCourseEntry = (courseId: string): { course: PlanCourse; year: number; term: string } | null => {
    for (const semester of graduationPlan) {
      const course = semester.courses.find((c) => c.id === courseId)
      if (course) {
        return { course, year: semester.year, term: semester.term }
      }
    }
    return null
  }

  const looksLikeLabCourse = (course?: Course | PlanCourse | null): boolean => {
    if (!course) return false
    const normalizedName = (course.name || "").toUpperCase()
    return course.id.endsWith("L") || normalizedName.includes("(LAB") || normalizedName.includes("LABORATORY")
  }

  const looksLikeLectureCourse = (course?: Course | PlanCourse | null): boolean => {
    if (!course) return false
    if (course.id.endsWith("L")) return false
    const normalizedName = (course.name || "").toUpperCase()
    if (normalizedName.includes("(LEC") || normalizedName.includes("LECTURE")) {
      return true
    }
    return courses.some((candidate) => candidate.id === `${course.id}L`)
  }

  const getPairedCourseId = (course?: Course | PlanCourse | null): string | null => {
    if (!course) return null
    if (looksLikeLabCourse(course)) {
      if (course.id.endsWith("L")) {
        const baseId = course.id.slice(0, -1)
        if (courses.some((candidate) => candidate.id === baseId)) {
          return baseId
        }
      }
      return null
    }
    if (looksLikeLectureCourse(course)) {
      const labId = `${course.id}L`
      if (courses.some((candidate) => candidate.id === labId)) {
        return labId
      }
    }
    return null
  }

  const resolveLockPairCourseId = (courseId: string): string | null => {
    const baseCourse = findCourseById(courseId) ?? getPlanCourseEntry(courseId)?.course ?? null
    if (!baseCourse) return null
    return getPairedCourseId(baseCourse)
  }

  function normalizeLockPairsWithLinkedCourses(
    locks: Record<string, { year?: number; term?: string }> | null | undefined,
  ): Record<string, { year: number; term: string }> {
    if (!locks || typeof locks !== "object") return {}

    const normalized: Record<string, { year: number; term: string }> = {}

    Object.entries(locks).forEach(([courseId, placement]) => {
      if (!placement || typeof placement !== "object") return
      const year = Number((placement as any).year)
      const termValue = (placement as any).term
      if (!Number.isFinite(year) || typeof termValue !== "string" || termValue.trim() === "") return

      const normalizedTerm = normalizeTermLabel(termValue)
      normalized[courseId] = { year, term: normalizedTerm }

      const pairId = resolveLockPairCourseId(courseId)
      if (pairId && pairId !== courseId) {
        normalized[pairId] = { year, term: normalizedTerm }
      }
    })

    return normalized
  }

  const getLinkedPairMoveInfo = (
    courseId: string,
    targetYear: number,
    targetTerm: string,
  ): LinkedPairMove | null => {
    const entry = getPlanCourseEntry(courseId)
    if (!entry) return null
    const pairId = getPairedCourseId(entry.course)
    if (!pairId) return null
    const pairEntry = getPlanCourseEntry(pairId)
    if (!pairEntry) return null
    if (pairEntry.year === targetYear && termsMatch(pairEntry.term, targetTerm)) return null

    const pairCourse = findCourseById(pairId) ?? pairEntry.course
    return {
      courseId: pairId,
      code: pairCourse.code,
      name: pairCourse.name,
      fromYear: pairEntry.year,
      fromTerm: pairEntry.term,
    }
  }

  const getDependentAdjustments = (courseId: string, targetYear: number, targetTerm: string): DependentAdjustment[] => {
    const dependents: DependentAdjustment[] = []

    graduationPlan.forEach((semester) => {
      semester.courses.forEach((course) => {
        const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []
        if (prereqs.includes(courseId) && !isAtLeastOneTermAfter(semester.year, semester.term, targetYear, targetTerm)) {
          dependents.push({
            courseId: course.id,
            code: course.code,
            name: course.name,
            fromYear: semester.year,
            fromTerm: normalizeTermLabel(semester.term),
            toYear: semester.year,
            toTerm: semester.term,
          })
        }
      })
    })

    if (dependents.length === 0) return []

    dependents.sort((a, b) => compareSemesters(a.fromYear, a.fromTerm, b.fromYear, b.fromTerm))

    let cursor = getNextTerm(targetYear, targetTerm)
    return dependents.map((dependent) => {
      const planned = {
        ...dependent,
        toYear: cursor.year,
        toTerm: cursor.term,
      }
      cursor = getNextTerm(cursor.year, cursor.term)
      return planned
    })
  }
    const rebalancePlanForCreditLimits = (
      inputPlan: SemesterPlan[],
      options?: { allowCurrentTermActiveMoves?: boolean; minCredits?: number; maxCredits?: number },
    ): SemesterPlan[] => {
      if (!Array.isArray(inputPlan) || inputPlan.length === 0) {
        return inputPlan
      }

      const normalizedOptionMax = Number.isFinite(options?.maxCredits)
        ? Math.min(CREDIT_INPUT_MAX, Math.max(CREDIT_INPUT_MIN, Math.trunc(options!.maxCredits!)))
        : null
      const normalizedOptionMin = Number.isFinite(options?.minCredits)
        ? Math.min(CREDIT_INPUT_MAX, Math.max(CREDIT_INPUT_MIN, Math.trunc(options!.minCredits!)))
        : null

      const limit = normalizedOptionMax ?? effectiveMaxCreditsPerTerm
      if (!Number.isFinite(limit) || limit <= 0) {
        return inputPlan
      }

      const minTarget = normalizedOptionMin ?? minCreditsPerTerm

      const allowCurrentTermActiveMoves = Boolean(options?.allowCurrentTermActiveMoves)

      type MoveBundle = {
        courses: PlanCourse[]
        totalCredits: number
      }

      let mutated = false
      const plan = inputPlan.map((semester) => ({
        ...semester,
        term: normalizeTermLabel(semester.term),
        courses: [...semester.courses],
      }))

      const courseScheduleMap = new Map<string, { year: number; term: string }>()
      plan.forEach((semester) => {
        semester.courses.forEach((course) => {
          courseScheduleMap.set(course.id, { year: semester.year, term: semester.term })
        })
      })

      const priorityScore = (id: string) => PRIORITY_WEIGHTS[coursePriorities[id] || "medium"] || 0

      const dependentsRemainAfterMove = (course: PlanCourse, targetYear: number, targetTerm: string) => {
        const dependents = dependentsMap.get(course.id) || []
        return dependents.every((dependentId) => {
          const placement = courseScheduleMap.get(dependentId)
          if (!placement) return true
          return isAtLeastOneTermAfter(placement.year, placement.term, targetYear, targetTerm)
        })
      }

      const canScheduleCourse = (course: PlanCourse, targetYear: number, targetTerm: string) => {
        const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []
        if (prereqs.length === 0) return true
        return prereqs.every((prereqId) => {
          const prereqCourse = findCourseById(prereqId)
          if (prereqCourse && prereqCourse.status === "passed") return true
          const placement = courseScheduleMap.get(prereqId)
          if (!placement) return false
          return isAtLeastOneTermAfter(targetYear, targetTerm, placement.year, placement.term)
        })
      }

      const sumCredits = (semester: SemesterPlan) => semester.courses.reduce((sum, course) => sum + course.credits, 0)
      const containsInternship = (semester: SemesterPlan) => semester.courses.some((course) => isInternshipCourse(course))

      const ensureFutureSemester = (bundle: MoveBundle): SemesterPlan | null => {
        if (plan.length === 0) return null
        if (bundle.totalCredits > limit) return null
        let anchorYear = plan[plan.length - 1].year
        let anchorTerm = plan[plan.length - 1].term
        const MAX_ITER = 12
        for (let iter = 0; iter < MAX_ITER; iter++) {
          const next = getNextTerm(anchorYear, anchorTerm)
          anchorYear = next.year
          anchorTerm = next.term
          if (!bundle.courses.every((bundleCourse) => canScheduleCourse(bundleCourse, anchorYear, anchorTerm))) continue
          if (!bundle.courses.every((bundleCourse) => dependentsRemainAfterMove(bundleCourse, anchorYear, anchorTerm))) continue
          const newSemester: SemesterPlan = { year: anchorYear, term: normalizeTermLabel(anchorTerm), courses: [] }
          plan.push(newSemester)
          return newSemester
        }
        return null
      }

      const findTargetSemester = (
        bundle: MoveBundle,
        fromSemester: SemesterPlan,
        fromIndex: number,
      ): SemesterPlan | null => {
        const candidates: { semester: SemesterPlan; index: number; load: number; belowMin: boolean }[] = []
        const movesNonInternshipCourse = bundle.courses.some((bundleCourse) => !isInternshipCourse(bundleCourse))

        for (let idx = fromIndex + 1; idx < plan.length; idx++) {
          const candidate = plan[idx]
          if (!isAtLeastOneTermAfter(candidate.year, candidate.term, fromSemester.year, fromSemester.term)) continue
          if (!bundle.courses.every((bundleCourse) => canScheduleCourse(bundleCourse, candidate.year, candidate.term))) continue
          if (!bundle.courses.every((bundleCourse) => dependentsRemainAfterMove(bundleCourse, candidate.year, candidate.term))) continue
          if (containsInternship(candidate) && movesNonInternshipCourse) continue

          const currentLoad = sumCredits(candidate)
          if (currentLoad + bundle.totalCredits > limit) continue

          const belowMin = currentLoad < minTarget && !containsInternship(candidate)
          candidates.push({ semester: candidate, index: idx, load: currentLoad, belowMin })
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            if (a.belowMin !== b.belowMin) return a.belowMin ? -1 : 1
            if (a.load !== b.load) return a.load - b.load
            return a.index - b.index
          })
          return candidates[0].semester
        }

        return ensureFutureSemester(bundle)
      }

      const isMovable = (course: PlanCourse, semester: SemesterPlan) => {
        if (lockedPlacements[course.id]) return false
        if (isInternshipCourse(course)) return false
        if (
          !allowCurrentTermActiveMoves &&
          semester.year === currentYear &&
          termsMatch(semester.term, currentTerm) &&
          course.status === "active"
        ) {
          return false
        }
        return true
      }

      const createMoveBundle = (course: PlanCourse, fromSemester: SemesterPlan): MoveBundle | null => {
        const stillInSemester = fromSemester.courses.some((candidate) => candidate.id === course.id)
        if (!stillInSemester) return null

        const bundleCourses: PlanCourse[] = [course]
        const pairId = getPairedCourseId(course)
        if (pairId) {
          const pairedCourse = fromSemester.courses.find((candidate) => candidate.id === pairId)
          if (pairedCourse) {
            if (!isMovable(pairedCourse, fromSemester)) {
              return null
            }
            if (!bundleCourses.some((existing) => existing.id === pairedCourse.id)) {
              bundleCourses.push(pairedCourse)
            }
          }
        }

        const totalCredits = bundleCourses.reduce((sum, bundleCourse) => sum + (bundleCourse.credits ?? 0), 0)
        if (totalCredits <= 0) return null

        return { courses: bundleCourses, totalCredits }
      }

      const findCourseForUnderloadedSemester = (targetSemester: SemesterPlan, targetIndex: number) => {
        if (containsInternship(targetSemester)) return null
        const targetLoad = sumCredits(targetSemester)
        const remainingCapacity = limit - targetLoad
        if (remainingCapacity <= 0) return null

        const candidates: {
          bundle: MoveBundle
          sourceSemester: SemesterPlan
          sourceIndex: number
          priority: number
        }[] = []

        for (let idx = plan.length - 1; idx > targetIndex; idx--) {
          const sourceSemester = plan[idx]
          if (sourceSemester.courses.length === 0) continue
          if (!isAtLeastOneTermAfter(sourceSemester.year, sourceSemester.term, targetSemester.year, targetSemester.term)) continue

          const sourceContainsInternship = containsInternship(sourceSemester)
          if (sourceContainsInternship) continue

          for (const course of sourceSemester.courses) {
            if (!isMovable(course, sourceSemester)) continue
            const bundle = createMoveBundle(course, sourceSemester)
            if (!bundle) continue
            if (bundle.totalCredits > remainingCapacity) continue
            if (!bundle.courses.every((bundleCourse) => canScheduleCourse(bundleCourse, targetSemester.year, targetSemester.term))) continue
            if (!bundle.courses.every((bundleCourse) => dependentsRemainAfterMove(bundleCourse, targetSemester.year, targetSemester.term))) continue

            const priority = bundle.courses.reduce(
              (score, bundleCourse) => Math.max(score, priorityScore(bundleCourse.id)),
              Number.NEGATIVE_INFINITY,
            )

            candidates.push({
              bundle,
              sourceSemester,
              sourceIndex: idx,
              priority: Number.isFinite(priority) ? priority : priorityScore(course.id),
            })
          }
        }

        if (candidates.length === 0) return null

        candidates.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority
          if (a.bundle.totalCredits !== b.bundle.totalCredits) return b.bundle.totalCredits - a.bundle.totalCredits
          return a.sourceIndex - b.sourceIndex
        })

        return candidates[0]
      }

      for (let i = 0; i < plan.length; i++) {
        const semester = plan[i]
        if (semester.courses.length === 0) continue
        if (containsInternship(semester)) continue

        let total = sumCredits(semester)
        if (total <= limit) continue

        const movable = semester.courses.filter((course) => isMovable(course, semester))
        if (movable.length === 0) continue

        movable.sort((a, b) => {
          const pa = priorityScore(a.id)
          const pb = priorityScore(b.id)
          if (pa !== pb) return pa - pb

          const strategyDelta = strategyBias(b) - strategyBias(a)
          if (strategyDelta !== 0) return strategyDelta
          const depA = dependentsCount.get(a.id) || 0
          const depB = dependentsCount.get(b.id) || 0
          if (depA !== depB) return depA - depB
          return b.credits - a.credits
        })

        for (const course of movable) {
          if (!semester.courses.some((candidate) => candidate.id === course.id)) continue
          total = sumCredits(semester)
          if (total <= limit) break

          const bundle = createMoveBundle(course, semester)
          if (!bundle) continue

          const targetSemester = findTargetSemester(bundle, semester, i)
          if (!targetSemester) continue
          if (!isAtLeastOneTermAfter(targetSemester.year, targetSemester.term, semester.year, semester.term)) continue
          if (sumCredits(targetSemester) + bundle.totalCredits > limit) continue

          const removedCourses: PlanCourse[] = []
          let removalSucceeded = true
          for (const bundleCourse of bundle.courses) {
            const removeIndex = semester.courses.findIndex((c) => c.id === bundleCourse.id)
            if (removeIndex === -1) {
              removalSucceeded = false
              break
            }
            const [removedCourse] = semester.courses.splice(removeIndex, 1)
            removedCourses.push(removedCourse ?? bundleCourse)
          }

          if (!removalSucceeded) {
            semester.courses.push(...removedCourses)
            continue
          }

          removedCourses.forEach((movedCourse) => {
            targetSemester.courses.push(movedCourse)
            courseScheduleMap.set(movedCourse.id, { year: targetSemester.year, term: targetSemester.term })
          })
          mutated = true
        }
      }

      const MAX_PULL_ITERATIONS = 50
      const enforceMinimumCredits = Number.isFinite(minTarget) && minTarget > 0
      if (enforceMinimumCredits) {
        for (let i = 0; i < plan.length; i++) {
          const semester = plan[i]
          if (semester.courses.length === 0) continue

          const hasRegularCourses = semester.courses.some((course) => !isInternshipCourse(course))
          if (!hasRegularCourses) continue

          let total = sumCredits(semester)
          if (total >= minTarget) continue

          let iterations = 0
          while (total < minTarget && iterations < MAX_PULL_ITERATIONS) {
            const candidate = findCourseForUnderloadedSemester(semester, i)
            if (!candidate) break

            const removedCourses: PlanCourse[] = []
            let removalSucceeded = true
            for (const bundleCourse of candidate.bundle.courses) {
              const removeIndex = candidate.sourceSemester.courses.findIndex((c) => c.id === bundleCourse.id)
              if (removeIndex === -1) {
                removalSucceeded = false
                break
              }
              const [removedCourse] = candidate.sourceSemester.courses.splice(removeIndex, 1)
              removedCourses.push(removedCourse ?? bundleCourse)
            }

            if (!removalSucceeded) {
              candidate.sourceSemester.courses.push(...removedCourses)
              iterations += 1
              continue
            }

            removedCourses.forEach((movedCourse) => {
              semester.courses.push(movedCourse)
              courseScheduleMap.set(movedCourse.id, { year: semester.year, term: semester.term })
            })
            mutated = true
            total = sumCredits(semester)
            iterations += 1
          }
        }
      }

      const internshipOnlySemesters = plan.filter(
        (semester) =>
          semester.courses.length > 0 && semester.courses.every((course) => isInternshipCourse(course)),
      )
      const nonInternshipSemesters = plan.filter((semester) =>
        semester.courses.some((course) => !isInternshipCourse(course)),
      )

      if (internshipOnlySemesters.length > 0 && nonInternshipSemesters.length > 0) {
        const lastNonInternship = nonInternshipSemesters.reduce<SemesterPlan | null>((latest, semester) => {
          if (!latest) return semester
          return compareSemesters(semester.year, semester.term, latest.year, latest.term) > 0 ? semester : latest
        }, null)

        if (lastNonInternship) {
          let cursorYear = lastNonInternship.year
          let cursorTerm = lastNonInternship.term
          const orderedInternships = [...internshipOnlySemesters].sort((a, b) =>
            compareSemesters(a.year, a.term, b.year, b.term),
          )

          orderedInternships.forEach((internshipSemester) => {
            const nextSlot = getNextTerm(cursorYear, cursorTerm)
            cursorYear = nextSlot.year
            cursorTerm = normalizeTermLabel(nextSlot.term)
            if (internshipSemester.year !== cursorYear || !termsMatch(internshipSemester.term, cursorTerm)) {
              internshipSemester.year = cursorYear
              internshipSemester.term = cursorTerm
              mutated = true
            }
          })
        }
      }

      if (!mutated) {
        return inputPlan
      }

      const filtered = plan.filter((semester) => semester.courses.length > 0)
      filtered.sort((a, b) => (a.year === b.year ? getTermIndex(a.term) - getTermIndex(b.term) : a.year - b.year))
      return applyPetitionFlagsToPlan(filtered)
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
      const laterIndex = getTermIndex(laterTerm)
      const earlierIndex = getTermIndex(earlierTerm)
      if (laterIndex === -1 || earlierIndex === -1) return false
      return laterIndex > earlierIndex
    }
    return false
  }

  const getPrereqBlockersForTerm = (
    course: PlanCourse | Course,
    targetYear: number,
    targetTerm: string,
  ): PrereqBlockerInfo[] => {
    const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []
    const blockers: PrereqBlockerInfo[] = []

    prereqs.forEach((prereqId) => {
      const prereqCourse = findCourseById(prereqId)
      const prereqLabel = {
        code: prereqCourse?.code ?? prereqId,
        name: prereqCourse?.name ?? prereqCourse?.code ?? prereqId,
      }

      if (prereqCourse && prereqCourse.status === "passed") {
        return
      }

      const prereqLocation = getCourseLocationInPlan(prereqId)
      if (!prereqLocation) {
        blockers.push({
          courseId: prereqId,
          code: prereqLabel.code,
          name: prereqLabel.name,
          reason: "not_scheduled",
        })
        return
      }

      if (!isAtLeastOneTermAfter(targetYear, targetTerm, prereqLocation.year, prereqLocation.term)) {
        blockers.push({
          courseId: prereqId,
          code: prereqLabel.code,
          name: prereqCourse?.name ?? prereqLabel.code,
          reason: "scheduled_too_late",
          scheduledYear: prereqLocation.year,
          scheduledTerm: prereqLocation.term,
        })
      }
    })

    return blockers
  }

  interface PlannedCreditMove {
    courseId: string
    toYear: number
    toTerm: string
  }

  const getCreditGuardrailReasonsForMoves = (plannedMoves: PlannedCreditMove[]): CreditGuardrailReason[] => {
    if (!Array.isArray(plannedMoves) || plannedMoves.length === 0) return []

    const snapshots = new Map<
      string,
      { year: number; term: string; credits: number; totalCourses: number; nonInternshipCount: number }
    >()

    graduationPlan.forEach((semester) => {
      snapshots.set(`${semester.year}-${semester.term}`, {
        year: semester.year,
        term: semester.term,
        credits: semester.courses.reduce((sum, course) => sum + (course.credits ?? 0), 0),
        totalCourses: semester.courses.length,
        nonInternshipCount: semester.courses.filter((course) => !isInternshipCourse(course)).length,
      })
    })

    const affectedKeys = new Set<string>()

    plannedMoves.forEach((move) => {
      const entry = getPlanCourseEntry(move.courseId)
      if (!entry) return

      const credits = entry.course.credits ?? 0
      if (!Number.isFinite(credits) || credits <= 0) return

      const courseIsInternship = isInternshipCourse(entry.course)

      const fromKey = `${entry.year}-${entry.term}`
      const fromSnapshot = snapshots.get(fromKey)
      if (fromSnapshot) {
        fromSnapshot.credits = Math.max(0, fromSnapshot.credits - credits)
        fromSnapshot.totalCourses = Math.max(0, fromSnapshot.totalCourses - 1)
        if (!courseIsInternship) {
          fromSnapshot.nonInternshipCount = Math.max(0, fromSnapshot.nonInternshipCount - 1)
        }
        affectedKeys.add(fromKey)
      }

      const normalizedTargetTerm = normalizeTermLabel(move.toTerm)
      const toKey = `${move.toYear}-${normalizedTargetTerm}`
      let toSnapshot = snapshots.get(toKey)
      if (!toSnapshot) {
        toSnapshot = {
          year: move.toYear,
          term: normalizedTargetTerm,
          credits: 0,
          totalCourses: 0,
          nonInternshipCount: 0,
        }
        snapshots.set(toKey, toSnapshot)
      }
      toSnapshot.credits += credits
      toSnapshot.totalCourses += 1
      if (!courseIsInternship) {
        toSnapshot.nonInternshipCount += 1
      }
      affectedKeys.add(toKey)
    })

    const reasons: CreditGuardrailReason[] = []
    affectedKeys.forEach((key) => {
      const snapshot = snapshots.get(key)
      if (!snapshot) return
      const label = `${formatAcademicYear(snapshot.year)} ${snapshot.term}`

      if (snapshot.credits > effectiveMaxCreditsPerTerm) {
        reasons.push({
          type: "max",
          semesterLabel: label,
          credits: snapshot.credits,
          threshold: effectiveMaxCreditsPerTerm,
        })
      }

      const hasRegularCourses = snapshot.nonInternshipCount > 0
      if (hasRegularCourses && snapshot.credits < minCreditsPerTerm) {
        reasons.push({
          type: "min",
          semesterLabel: label,
          credits: snapshot.credits,
          threshold: minCreditsPerTerm,
        })
      }
    })

    return reasons
  }

  const summarizeBlockerCodes = (blockers: PrereqBlockerInfo[]): string => {
    if (blockers.length === 0) return ""
    if (blockers.length <= 3) {
      return blockers.map((blocker) => blocker.code).join(", ")
    }
    const displayed = blockers.slice(0, 3).map((blocker) => blocker.code)
    return `${displayed.join(", ")} +${blockers.length - 3} more`
  }

  // Helper to check if a course can be scheduled in a given term (considering prerequisites)
  const canScheduleInTerm = (course: PlanCourse, targetYear: number, targetTerm: string): boolean => {
    return getPrereqBlockersForTerm(course, targetYear, targetTerm).length === 0
  }

  // Detect conflicts in the graduation plan
  const detectConflicts = () => {
    const newConflicts: ConflictInfo[] = []
    const lowLoadSemesters: { semester: SemesterPlan; total: number }[] = []
    const strictRangeActive = Boolean(lastRegenerateResult?.strict && strictGuardrailsEnabled)
    const strictHighViolations: { semester: SemesterPlan; total: number }[] = []
    const strictLowViolations: { semester: SemesterPlan; total: number }[] = []
    const minTarget = Number.isFinite(minCreditsPerTerm)
      ? Math.min(CREDIT_INPUT_MAX, Math.max(CREDIT_INPUT_MIN, Math.trunc(minCreditsPerTerm)))
      : RECOMMENDED_UNITS_MIN

    graduationPlan.forEach((semester) => {
      // Check credit limits (configurable)
      const totalCredits = semester.courses.reduce((sum, course) => sum + course.credits, 0)
      const hardMax = effectiveMaxCreditsWithOverflow
      if (totalCredits > hardMax) {
        newConflicts.push({
          type: "credit_limit",
          severity: "error",
          message: `${formatAcademicYear(semester.year)} ${semester.term} exceeds the maximum permitted load: ${totalCredits} credits (limit: ${effectiveMaxCreditsPerTerm} + ${ALLOW_OVERFLOW_UNITS} overflow).`,
          affectedCourses: semester.courses.map((c) => c.id),
        })
      } else if (totalCredits > effectiveMaxCreditsPerTerm) {
        newConflicts.push({
          type: "credit_limit",
          severity: "warning",
          message: `${formatAcademicYear(semester.year)} ${semester.term} exceeds your maximum target load: ${totalCredits} credits (target max: ${effectiveMaxCreditsPerTerm}).`,
          affectedCourses: semester.courses.map((c) => c.id),
        })
        if (strictRangeActive) {
          strictHighViolations.push({ semester, total: totalCredits })
        }
      } else if (totalCredits < minTarget) {
        // Defer below-min warnings for a single aggregated message later, excluding internship-only terms
        const isInternshipOnly = semester.courses.length > 0 && semester.courses.every((c) => isInternshipCourse(c))
        if (!isInternshipOnly) {
          lowLoadSemesters.push({ semester, total: totalCredits })
          if (strictRangeActive) {
            strictLowViolations.push({ semester, total: totalCredits })
          }
        }
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
        const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []
        prereqs.forEach((prereqId) => {
          const prereqCourse = findCourseById(prereqId)
          if (prereqCourse && prereqCourse.status !== "passed") {
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

      // Check schedule conflicts (same time slots) only for the current term where section data is reliable
      if (isCurrentSemester(semester.year, semester.term)) {
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
      }
    })

    // Aggregate below-min load semesters into one warning to avoid repetition
    if (lowLoadSemesters.length > 0) {
      const labels = lowLoadSemesters
        .map(({ semester, total }) => `${formatAcademicYear(semester.year)} ${semester.term} (${total} credits)`) 
        .join("; ")
      const affected = lowLoadSemesters.flatMap(({ semester }) => semester.courses.map((c) => c.id))
      newConflicts.push({
        type: "credit_limit",
        severity: "warning",
        message: `Some terms fall below your minimum target of ${minCreditsPerTerm} credits: ${labels}. Consider rebalancing your plan.`,
        affectedCourses: affected,
      })
    }

    if (strictRangeActive && (strictHighViolations.length > 0 || strictLowViolations.length > 0)) {
      const formatViolation = (entry: { semester: SemesterPlan; total: number }, type: "high" | "low") =>
        `${formatAcademicYear(entry.semester.year)} ${entry.semester.term} ${
          type === "high" ? "above" : "below"
        } range (${entry.total}u)`
      const summaryParts = [
        ...strictHighViolations.map((entry) => formatViolation(entry, "high")),
        ...strictLowViolations.map((entry) => formatViolation(entry, "low")),
      ]
      const strictSummary = summaryParts.join("; ")
      const affectedStrictCourses = Array.from(
        new Set(
          [...strictHighViolations, ...strictLowViolations].flatMap((entry) => entry.semester.courses.map((c) => c.id)),
        ),
      )
      newConflicts.push({
        type: "credit_limit",
        severity: "warning",
        message: `Strict guardrails (${minCreditsPerTerm}-${effectiveMaxCreditsPerTerm}u) couldn't be matched exactly: ${strictSummary}. Consider importing a saved plan or loosening the range.`,
        affectedCourses: affectedStrictCourses,
      })
    }

    setConflicts(newConflicts)
  }

  const getTermMoveOptions = (
    course: PlanCourse,
  ): { available: MoveTermOption[]; blocked: BlockedTermOption[] } => {
    const available: MoveTermOption[] = []
    const blocked: BlockedTermOption[] = []
    const maxYears = 5

    for (let yearOffset = 0; yearOffset < maxYears; yearOffset++) {
      const year = currentYear + yearOffset

      for (const term of TERM_ORDER) {
        if (year === currentYear) {
          const currentTermIndex = getTermIndex(currentTerm)
          const termIndex = getTermIndex(term)
          if (termIndex < currentTermIndex) continue
        } else if (year < currentYear) {
          continue
        }

        const option: MoveTermOption = {
          year,
          term,
          label: `${formatAcademicYear(year)} - ${term}`,
        }
        const blockers = getPrereqBlockersForTerm(course, year, term)

        if (blockers.length === 0) {
          available.push(option)
        } else {
          blocked.push({ ...option, blockers })
        }
      }
    }

    return { available, blocked }
  }

  // Generate available terms for moving a course
  const getAvailableTermsForMove = (course: PlanCourse): MoveTermOption[] => {
    return getTermMoveOptions(course).available
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
        courseTerms.some((ct) => ct.year === term.year && termsMatch(ct.term, term.term)),
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
        // For single moves, some entries may include linked labs/labs or dependents; restore each change
        lastMove.changes.forEach((change) => {
          moveCourseToTermSilent(change.courseId, change.fromYear, change.fromTerm)
        })
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
        (semester) => semester.year === targetYear && termsMatch(semester.term, targetTerm),
      )

      if (targetSemesterIndex !== -1) {
        // Add to existing semester
        updatedPlan[targetSemesterIndex].courses.push(courseToMove)
      } else {
        // Create new semester
        const newSemester: SemesterPlan = {
          year: targetYear,
          term: normalizeTermLabel(targetTerm),
          courses: [courseToMove],
        }

        // Insert in chronological order
        let insertIndex = updatedPlan.length
        for (let i = 0; i < updatedPlan.length; i++) {
          const semester = updatedPlan[i]
          if (
            semester.year > targetYear ||
            (semester.year === targetYear && getTermIndex(semester.term) > getTermIndex(targetTerm))
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
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      return applyPetitionFlagsToPlan(updatedPlan)
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

      return applyPetitionFlagsToPlan(updatedPlan)
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

  const handleCourseMoveRequest = (courseId: string, targetYear: number, targetTerm: string) => {
    const adjustments = getDependentAdjustments(courseId, targetYear, targetTerm)
    const pairMove = getLinkedPairMoveInfo(courseId, targetYear, targetTerm)

    if (adjustments.length === 0 && !pairMove) {
      const creditReasons = getCreditGuardrailReasonsForMoves([
        { courseId, toYear: targetYear, toTerm: targetTerm },
      ])
      if (creditReasons.length > 0) {
        const course = findCourseById(courseId)
        setCreditGuardrailDialog({
          courseCode: course?.code ?? courseId,
          courseName: course?.name ?? course?.code ?? courseId,
          targetYear,
          targetTerm: normalizeTermLabel(targetTerm),
          reasons: creditReasons,
        })
        resetMoveSelects()
        return
      }
      moveCourseToTerm(courseId, targetYear, targetTerm)
      resetMoveSelects()
      return
    }

    setPendingPrereqShift({ courseId, targetYear, targetTerm, adjustments, pair: pairMove ?? null })
  }

  const openBlockedMoveDialog = (courseId: string, targetYear: number, targetTerm: string): boolean => {
    const course = findCourseById(courseId)
    if (!course) return false
    const blockers = getPrereqBlockersForTerm(course, targetYear, targetTerm)
    if (blockers.length === 0) return false

    setBlockedMoveDialog({
      courseId,
      courseCode: course.code,
      courseName: course.name,
      targetYear,
      targetTerm: normalizeTermLabel(targetTerm),
      blockers,
    })
    return true
  }

  const handleBlockedMoveAttempt = (
    courseId: string,
    targetYear: number,
    targetTerm: string,
    shouldResetMoveSelect = false,
  ) => {
    const dialogOpened = openBlockedMoveDialog(courseId, targetYear, targetTerm)
    if (dialogOpened && shouldResetMoveSelect) {
      resetMoveSelects()
    }
  }

  const handleMoveSelectChange = (courseId: string, rawValue: string) => {
    if (!rawValue) return
    if (rawValue.startsWith("blocked|")) {
      const [, yearStr, termLabel] = rawValue.split("|")
      const parsedYear = Number.parseInt(yearStr, 10)
      if (Number.isFinite(parsedYear) && termLabel) {
        handleBlockedMoveAttempt(courseId, parsedYear, termLabel, true)
      }
      return
    }

    const [yearStr, term] = rawValue.split("-")
    if (!yearStr || !term) return
    const parsedYear = Number.parseInt(yearStr, 10)
    if (!Number.isFinite(parsedYear)) return
    handleCourseMoveRequest(courseId, parsedYear, term)
  }

  const handleAddCourseSelectChange = (courseId: string, rawValue: string) => {
    if (!rawValue) return
    if (rawValue.startsWith("blocked|")) {
      const [, yearStr, termLabel] = rawValue.split("|")
      const parsedYear = Number.parseInt(yearStr, 10)
      if (Number.isFinite(parsedYear) && termLabel) {
        handleBlockedMoveAttempt(courseId, parsedYear, termLabel)
      }
      return
    }

    const [yearStr, term] = rawValue.split("-")
    if (!yearStr || !term) return
    const parsedYear = Number.parseInt(yearStr, 10)
    if (!Number.isFinite(parsedYear)) return
    addCourseToTerm(courseId, parsedYear, term)
  }

  const persistRegeneratePreferences = (strategy: RegenerateStrategy, strict: boolean) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(REGENERATE_STRATEGY_STORAGE_KEY, strategy)
      window.localStorage.setItem(STRICT_GUARDRAILS_STORAGE_KEY, strict ? "true" : "false")
    } catch (err) {
      console.warn("Unable to persist regenerate preferences", err)
    }
  }

  const handleConfirmRegeneratePlan = () => {
    const validationMessage = getCreditLimitValidationMessage(pendingRegenerateMin, pendingRegenerateMax)
    if (validationMessage) {
      setRegenerateCreditError(validationMessage)
      return
    }

    const nextMin = normalizeCreditInput(pendingRegenerateMin)
    const nextMax = normalizeCreditInput(pendingRegenerateMax)
    setRegenerateCreditError(null)

    if (nextMin !== minCreditsPerTerm || nextMax !== maxCreditsPerTerm) {
      setMinCreditsPerTerm(nextMin)
      setMaxCreditsPerTerm(nextMax)
      setDraftMinCreditsPerTerm(nextMin)
      setDraftMaxCreditsPerTerm(nextMax)
      setCreditLimitsDirty(false)
      setCreditSaveMessage(null)
      setCreditLimitError(null)
      clearCreditSaveMessageTimeout()
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(CREDIT_LIMITS_STORAGE_KEY, JSON.stringify({ min: nextMin, max: nextMax }))
        } catch (err) {
          console.warn("Unable to persist regenerate credit limits", err)
        }
      }
    }

    generateGraduationPlan({
      strategy: pendingRegenerateStrategy,
      strictCredits: pendingStrictGuardrails,
      minCredits: nextMin,
      maxCredits: nextMax,
    })
    setPlannerStrategy(pendingRegenerateStrategy)
    setStrictGuardrailsEnabled(pendingStrictGuardrails)
    persistRegeneratePreferences(pendingRegenerateStrategy, pendingStrictGuardrails)
    setLastRegenerateResult({
      strategy: pendingRegenerateStrategy,
      strict: pendingStrictGuardrails,
      min: nextMin,
      max: nextMax,
    })
    setRegenerateDialogOpen(false)
    setRegenerateToast({
      strategy: pendingRegenerateStrategy,
      strict: pendingStrictGuardrails,
      min: nextMin,
      max: nextMax,
    })
  }

  const confirmPrereqShiftMove = () => {
    if (!pendingPrereqShift) return

    const { courseId, targetYear, targetTerm, adjustments, pair } = pendingPrereqShift
    const origin = getCourseLocationInPlan(courseId)
    if (!origin) {
      setPendingPrereqShift(null)
      resetMoveSelects()
      return
    }

    const targetTermNormalized = normalizeTermLabel(targetTerm)
    const plannedMoves: PlannedCreditMove[] = [
      { courseId, toYear: targetYear, toTerm: targetTermNormalized },
    ]
    if (pair) {
      plannedMoves.push({ courseId: pair.courseId, toYear: targetYear, toTerm: targetTermNormalized })
    }
    if (adjustments.length > 0) {
      adjustments.forEach((adjustment) => {
        plannedMoves.push({ courseId: adjustment.courseId, toYear: adjustment.toYear, toTerm: adjustment.toTerm })
      })
    }

    const creditReasons = getCreditGuardrailReasonsForMoves(plannedMoves)
    if (creditReasons.length > 0) {
      const course = findCourseById(courseId)
      setCreditGuardrailDialog({
        courseCode: course?.code ?? courseId,
        courseName: course?.name ?? course?.code ?? courseId,
        targetYear,
        targetTerm: targetTermNormalized,
        reasons: creditReasons,
      })
      return
    }

    const changes: MoveHistoryEntry["changes"] = []

    moveCourseToTermSilent(courseId, targetYear, targetTermNormalized)
    changes.push({
      courseId,
      fromYear: origin.year,
      fromTerm: origin.term,
      toYear: targetYear,
      toTerm: targetTermNormalized,
    })

    if (pair) {
      moveCourseToTermSilent(pair.courseId, targetYear, targetTermNormalized)
      changes.push({
        courseId: pair.courseId,
        fromYear: pair.fromYear,
        fromTerm: pair.fromTerm,
        toYear: targetYear,
        toTerm: targetTermNormalized,
      })
    }

    adjustments.forEach((adjustment) => {
      moveCourseToTermSilent(adjustment.courseId, adjustment.toYear, adjustment.toTerm)
      changes.push({
        courseId: adjustment.courseId,
        fromYear: adjustment.fromYear,
        fromTerm: adjustment.fromTerm,
        toYear: adjustment.toYear,
        toTerm: adjustment.toTerm,
      })
    })

    const movedCourse = findCourseById(courseId)
    const summaryBits: string[] = []
    if (pair) {
      summaryBits.push(`${pair.code} lab/lec partner`)
    }
    if (adjustments.length === 1) {
      summaryBits.push(adjustments[0].code)
    } else if (adjustments.length > 1) {
      summaryBits.push(`${adjustments.length} dependent courses`)
    }

    const baseDescription = `${movedCourse?.code || "Course"} moved to ${formatAcademicYear(targetYear)} ${targetTerm}`
    const description = summaryBits.length > 0 ? `${baseDescription}; also moved ${summaryBits.join(" and ")}` : baseDescription

    addToMoveHistory({
      type: "single",
      description,
      changes,
    })

    setPendingPrereqShift(null)
    resetMoveSelects()
  }

  const cancelPrereqShiftMove = () => {
    setPendingPrereqShift(null)
    resetMoveSelects()
  }

  // Move multiple courses to the same term
  const moveMultipleCoursesToTerm = (courseIds: string[], targetYear: number, targetTerm: string) => {
    const changes: MoveHistoryEntry["changes"] = []

    // Find current locations
    const courseLocations = new Map<string, { year: number; term: string }>()
    for (const semester of graduationPlan) {
      for (const course of semester.courses) {
        if (courseIds.includes(course.id)) {
          courseLocations.set(course.id, { year: semester.year, term: normalizeTermLabel(semester.term) })
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
        (semester) => semester.year === targetYear && termsMatch(semester.term, targetTerm),
      )

      if (targetSemesterIndex !== -1) {
        // Add to existing semester
        updatedPlan[targetSemesterIndex].courses.push(...coursesToMove)
      } else {
        // Create new semester
        const newSemester: SemesterPlan = {
          year: targetYear,
          term: normalizeTermLabel(targetTerm),
          courses: coursesToMove,
        }

        // Insert in chronological order
        let insertIndex = updatedPlan.length
        for (let i = 0; i < updatedPlan.length; i++) {
          const semester = updatedPlan[i]
          if (
            semester.year > targetYear ||
            (semester.year === targetYear && getTermIndex(semester.term) > getTermIndex(targetTerm))
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
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      return applyPetitionFlagsToPlan(updatedPlan)
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
    const planData = graduationPlan.map((semester) => {
      const semesterIsCurrent = isCurrentSemester(semester.year, semester.term)

      return {
        year: semester.year,
        term: semester.term,
        courses: semester.courses.map((course) => {
          const sectionDetails = semesterIsCurrent ? course.recommendedSection : undefined
          return {
            code: course.code,
            name: course.name,
            credits: course.credits,
            section: sectionDetails?.section || "TBD",
            schedule: sectionDetails
              ? `${sectionDetails.meetingDays} ${sectionDetails.meetingTime}`
              : "TBD",
            room: sectionDetails?.room || "TBD",
          }
        }),
      }
    })

    const creditPreferenceSnapshot = {
      minCreditsPerTerm,
      maxCreditsPerTerm,
    }

    const prioritySnapshot = sanitizePrioritySnapshot(coursePriorities)
    const lockedSnapshot = sanitizeLockedPlacementSnapshot(lockedPlacements)
    const priorityJson = Object.keys(prioritySnapshot).length > 0 ? JSON.stringify(prioritySnapshot) : null
    const lockedJson = Object.keys(lockedSnapshot).length > 0 ? JSON.stringify(lockedSnapshot) : null

    const exportTimestamp = new Date().toISOString()

    let content = ""
    let filename = ""
    let mimeType = ""

    switch (format) {
      case "json":
        content = JSON.stringify(
          {
            version: 2,
            exportedAt: exportTimestamp,
            creditPreferences: creditPreferenceSnapshot,
            semesters: planData,
            ...(priorityJson ? { coursePriorities: prioritySnapshot } : {}),
            ...(lockedJson ? { lockedPlacements: lockedSnapshot } : {}),
          },
          null,
          2,
        )
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
        content += `\n# Credit Preferences\n`
        content += `# MinCreditsPerTerm:${creditPreferenceSnapshot.minCreditsPerTerm}\n`
        content += `# MaxCreditsPerTerm:${creditPreferenceSnapshot.maxCreditsPerTerm}\n`
        if (priorityJson) {
          content += `# COURSE_PRIORITIES_JSON=${priorityJson}\n`
        }
        if (lockedJson) {
          content += `# LOCKED_PLACEMENTS_JSON=${lockedJson}\n`
        }
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
        content += "CREDIT PREFERENCES\n"
        content += `Min Credits Per Term: ${creditPreferenceSnapshot.minCreditsPerTerm}\n`
        content += `Max Credits Per Term: ${creditPreferenceSnapshot.maxCreditsPerTerm}\n`
        if (priorityJson) {
          content += `COURSE_PRIORITIES_JSON=${priorityJson}\n`
        }
        if (lockedJson) {
          content += `LOCKED_PLACEMENTS_JSON=${lockedJson}\n`
        }
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
  const parseImportedData = (content: string, format: "json" | "csv" | "txt"): ParsedPlanImportResult => {
    const coerceNumber = (value: unknown): number | undefined => {
      if (typeof value === "number" && Number.isFinite(value)) return value
      if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
      return undefined
    }

    const extractCreditPreferences = (source: any): ParsedPlanImportResult["creditPreferences"] => {
      if (!source || typeof source !== "object") return undefined
      const min = coerceNumber(source.minCreditsPerTerm ?? source.min ?? source.minimum)
      const max = coerceNumber(source.maxCreditsPerTerm ?? source.max ?? source.maximum)
      if (min === undefined && max === undefined) return undefined
      return {
        minCreditsPerTerm: min,
        maxCreditsPerTerm: max,
      }
    }

    const mapSemesters = (data: any[]): ImportedPlanData[] => {
      return data.map((semester: any) => ({
        year: Number(semester.year),
        term: normalizeTermLabel(semester.term),
        courses: (Array.isArray(semester.courses) ? semester.courses : []).map((course: any) => ({
          code: course.code,
          name: course.name,
          credits: Number(course.credits),
          section: course.section,
          schedule: course.schedule,
          room: course.room,
        })),
      }))
    }

    switch (format) {
      case "json":
        try {
          const data = JSON.parse(content)
          if (Array.isArray(data)) {
            return { semesters: mapSemesters(data) }
          }
          if (!Array.isArray(data?.semesters)) {
            throw new Error("JSON must contain a semesters array")
          }
          const priorityMeta = sanitizePrioritySnapshot(data.coursePriorities)
          const lockedMeta = sanitizeLockedPlacementSnapshot(data.lockedPlacements)
          return {
            semesters: mapSemesters(data.semesters),
            creditPreferences: extractCreditPreferences(data.creditPreferences ?? data),
            coursePriorities: Object.keys(priorityMeta).length > 0 ? priorityMeta : undefined,
            lockedPlacements: Object.keys(lockedMeta).length > 0 ? lockedMeta : undefined,
          }
        } catch (error) {
          throw new Error("Invalid JSON format")
        }

      case "csv":
        try {
          const lines = content.trim().split("\n")
          const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith("#"))
          if (headerIndex === -1) {
            throw new Error("Invalid CSV format - missing required headers")
          }
          const headerLine = lines[headerIndex]
          if (!headerLine.includes("Year,Term,Course Code")) {
            throw new Error("Invalid CSV format - missing required headers")
          }

          const semesterMap = new Map<string, ImportedPlanData>()
          let creditPreferences: ParsedPlanImportResult["creditPreferences"]
          let coursePrioritiesSnapshot: ParsedPlanImportResult["coursePriorities"]
          let lockedPlacementSnapshot: ParsedPlanImportResult["lockedPlacements"]

          const assignCreditPreference = (
            key: keyof NonNullable<ParsedPlanImportResult["creditPreferences"]>,
            value: number,
          ) => {
            if (!Number.isFinite(value)) return
            if (!creditPreferences) {
              creditPreferences = {}
            }
            creditPreferences[key] = value
          }

          for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            if (line.startsWith("#")) {
              const minMatch = line.match(/mincreditsperterm\s*[:=]\s*(\d+)/i)
              const maxMatch = line.match(/maxcreditsperterm\s*[:=]\s*(\d+)/i)
              if (minMatch) assignCreditPreference("minCreditsPerTerm", Number(minMatch[1]))
              if (maxMatch) assignCreditPreference("maxCreditsPerTerm", Number(maxMatch[1]))

              const metadataMatch = line.replace(/^#+\s*/, "").match(/^([A-Z_]+)\s*[:=]\s*(.+)$/i)
              if (metadataMatch) {
                const key = metadataMatch[1].trim().toUpperCase()
                const jsonPayload = metadataMatch[2].trim()
                if (key === "COURSE_PRIORITIES_JSON") {
                  try {
                    const parsed = JSON.parse(jsonPayload)
                    const sanitized = sanitizePrioritySnapshot(parsed)
                    if (Object.keys(sanitized).length > 0) {
                      coursePrioritiesSnapshot = sanitized
                    }
                  } catch (err) {
                    console.warn("Failed to parse COURSE_PRIORITIES_JSON metadata:", err)
                  }
                  continue
                }
                if (key === "LOCKED_PLACEMENTS_JSON") {
                  try {
                    const parsed = JSON.parse(jsonPayload)
                    const sanitized = sanitizeLockedPlacementSnapshot(parsed)
                    if (Object.keys(sanitized).length > 0) {
                      lockedPlacementSnapshot = sanitized
                    }
                  } catch (err) {
                    console.warn("Failed to parse LOCKED_PLACEMENTS_JSON metadata:", err)
                  }
                  continue
                }
              }

              continue
            }

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

          return {
            semesters: Array.from(semesterMap.values()),
            creditPreferences,
            coursePriorities: coursePrioritiesSnapshot,
            lockedPlacements: lockedPlacementSnapshot,
          }
        } catch (error) {
          throw new Error("Invalid CSV format")
        }

      case "txt":
        try {
          const sections = content.split(/\n\s*\n/)
          const planData: ImportedPlanData[] = []
          let creditPreferences: ParsedPlanImportResult["creditPreferences"]
          let coursePrioritiesSnapshot: ParsedPlanImportResult["coursePriorities"]
          let lockedPlacementSnapshot: ParsedPlanImportResult["lockedPlacements"]

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

          const minMatch = content.match(/Min Credits Per Term:\s*(\d+)/i)
          const maxMatch = content.match(/Max Credits Per Term:\s*(\d+)/i)
          if (minMatch) {
            creditPreferences = creditPreferences ?? {}
            creditPreferences.minCreditsPerTerm = Number(minMatch[1])
          }
          if (maxMatch) {
            creditPreferences = creditPreferences ?? {}
            creditPreferences.maxCreditsPerTerm = Number(maxMatch[1])
          }

          const priorityMatch = content.match(/COURSE_PRIORITIES_JSON\s*[:=]\s*([^\r\n]+)/i)
          if (priorityMatch) {
            try {
              const parsed = JSON.parse(priorityMatch[1].trim())
              const sanitized = sanitizePrioritySnapshot(parsed)
              if (Object.keys(sanitized).length > 0) {
                coursePrioritiesSnapshot = sanitized
              }
            } catch (err) {
              console.warn("Failed to parse COURSE_PRIORITIES_JSON metadata:", err)
            }
          }

          const lockedMatch = content.match(/LOCKED_PLACEMENTS_JSON\s*[:=]\s*([^\r\n]+)/i)
          if (lockedMatch) {
            try {
              const parsed = JSON.parse(lockedMatch[1].trim())
              const sanitized = sanitizeLockedPlacementSnapshot(parsed)
              if (Object.keys(sanitized).length > 0) {
                lockedPlacementSnapshot = sanitized
              }
            } catch (err) {
              console.warn("Failed to parse LOCKED_PLACEMENTS_JSON metadata:", err)
            }
          }

          return {
            semesters: planData,
            creditPreferences,
            coursePriorities: coursePrioritiesSnapshot,
            lockedPlacements: lockedPlacementSnapshot,
          }
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

      const {
        semesters: importedSemesters,
        creditPreferences: importedCreditPrefs,
        coursePriorities: importedPriorities,
        lockedPlacements: importedLocks,
      } = parseImportedData(content, format)

      if (importedSemesters.length === 0) {
        throw new Error("No valid semester data found in the file")
      }

      // Convert imported data to graduation plan format
      const newPlan: SemesterPlan[] = []

      for (const semesterData of importedSemesters) {
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
          const needsPetition = courseNeedsPetitionForTerm(course, semesterData.term)
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
            prerequisites: Array.isArray((course as any).prerequisites) ? course.prerequisites : [],
            availableSections,
            needsPetition,
            recommendedSection,
          }

          semesterCourses.push(planCourse)
        }

        if (semesterCourses.length > 0) {
          newPlan.push({
            year: semesterData.year,
            term: normalizeTermLabel(semesterData.term),
            courses: semesterCourses,
          })
        }
      }

      // Sort semesters chronologically
      newPlan.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      const balancedImportedPlan = rebalancePlanForCreditLimits(newPlan, { allowCurrentTermActiveMoves: true })
      const finalPlan = balancedImportedPlan === newPlan ? newPlan : balancedImportedPlan

      // Update graduation plan
      setGraduationPlan(applyPetitionFlagsToPlan(finalPlan))

      syncOpenSemesters(finalPlan)

      // Clear move history since we're starting fresh
      setMoveHistory([])

      // Close import dialog
      setImportDialogOpen(false)
      const totalCourses = finalPlan.reduce((sum, s) => sum + s.courses.length, 0)
      setImportSuccessInfo({ semesters: finalPlan.length, courses: totalCourses })

      if (importedCreditPrefs) {
        const hasImportedMin = typeof importedCreditPrefs.minCreditsPerTerm === "number"
        const hasImportedMax = typeof importedCreditPrefs.maxCreditsPerTerm === "number"
        if (hasImportedMin || hasImportedMax) {
          const nextMin = hasImportedMin
            ? normalizeCreditInput(importedCreditPrefs.minCreditsPerTerm as number)
            : minCreditsPerTerm
          const nextMax = hasImportedMax
            ? normalizeCreditInput(importedCreditPrefs.maxCreditsPerTerm as number)
            : maxCreditsPerTerm

          setMinCreditsPerTerm(nextMin)
          setMaxCreditsPerTerm(nextMax)
          setDraftMinCreditsPerTerm(nextMin)
          setDraftMaxCreditsPerTerm(nextMax)
          setCreditLimitsDirty(false)
          setCreditSaveMessage(null)
          setCreditLimitError(null)
          clearCreditSaveMessageTimeout()

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                CREDIT_LIMITS_STORAGE_KEY,
                JSON.stringify({ min: nextMin, max: nextMax }),
              )
            } catch (err) {
              console.error("Error saving imported credit limits:", err)
            }
          }
        }
      }

      setCoursePriorities(importedPriorities ?? {})
      setLockedPlacements(normalizeLockPairsWithLinkedCourses(importedLocks))
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

  const syncOpenSemesters = useCallback(
    (plan: SemesterPlan[]) => {
      setOpenSemesters((prev) => {
        if (!Array.isArray(plan) || plan.length === 0) {
          return {}
        }

        const next: { [key: string]: boolean } = {}
        let hasOpen = false
        const normalizedCurrentTerm = normalizeTermLabel(currentTerm)

        plan.forEach((semester, index) => {
          const key = `${semester.year}-${semester.term}`
          const prevValue = prev[key]
          const isCurrentSemester =
            semester.year === currentYear && termsMatch(semester.term, normalizedCurrentTerm)
          const shouldOpen =
            typeof prevValue === "boolean" ? prevValue : isCurrentSemester ? true : index === 0

          next[key] = shouldOpen
          if (shouldOpen) {
            hasOpen = true
          }
        })

        if (!hasOpen && plan.length > 0) {
          const currentKey = `${currentYear}-${normalizedCurrentTerm}`
          if (currentKey in next) {
            next[currentKey] = true
          } else {
            const firstKey = `${plan[0].year}-${plan[0].term}`
            next[firstKey] = true
          }
        }

        return next
      })
    },
    [currentYear, currentTerm],
  )

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
  const generateGraduationPlan = (
    options?: {
      strategy?: RegenerateStrategy
      strictCredits?: boolean
      previewOnly?: boolean
      minCredits?: number
      maxCredits?: number
    },
  ): SemesterPlan[] | undefined => {
    const selectedStrategy = options?.strategy ?? plannerStrategy
    const enforceStrictCredits = options?.strictCredits ?? strictGuardrailsEnabled
    const plannerMinCredits =
      typeof options?.minCredits === "number" ? options.minCredits : minCreditsPerTerm
    const plannerMaxCredits =
      typeof options?.maxCredits === "number" ? options.maxCredits : effectiveMaxCreditsPerTerm
    let lastGeneratedPlan: SemesterPlan[] | null = null

    // Get all pending, active, and failed courses
    const pendingCourses = courses.filter((course) => course.status === "pending")
    const activeCourses = courses.filter((course) => course.status === "active")
    const failedCourses = courses.filter((course) => course.status === "failed")

    console.log("Generating plan with:", {
      pendingCount: pendingCourses.length,
      activeCount: activeCourses.length,
      totalCourses: courses.length,
    })

    const finalizePlan = (semesters: SemesterPlan[]) => {
      const ordered = [...semesters].sort((a, b) =>
        a.year === b.year ? getTermIndex(a.term) - getTermIndex(b.term) : a.year - b.year,
      )

      const flagged = applyPetitionFlagsToPlan(ordered)
      lastGeneratedPlan = flagged

      if (options?.previewOnly) {
        return flagged
      }

      syncOpenSemesters(flagged)
      setGraduationPlan(flagged)
      setMoveHistory([])
      return flagged
    }

    // If we have no courses to plan, return early
    if (pendingCourses.length === 0 && activeCourses.length === 0 && failedCourses.length === 0) {
      return finalizePlan([])
    }

    // If no courses are marked as active or passed, recommend the curriculum order (group by original year/term)
    const anyProgress = courses.some((c) => c.status === "active" || c.status === "passed")
    if (!anyProgress) {
      // Group by year and term using the course.year/course.term from initial data
      const grouped = new Map<string, SemesterPlan>()

      // sort courses by year then term to preserve curriculum order
      const sorted = [...courses].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      for (const c of sorted) {
        if (c.status === "pending" || c.status === "active") {
          const key = `${c.year}-${c.term}`
          if (!grouped.has(key)) grouped.set(key, { year: c.year, term: c.term, courses: [] })
          const planCourse: PlanCourse = {
            ...c,
            availableSections: getAvailableSections(c.code),
            needsPetition: courseNeedsPetitionForTerm(c, c.term),
            recommendedSection: findBestSection(c.code),
          }
          grouped.get(key)!.courses.push(planCourse)
        }
      }

      const planArray = Array.from(grouped.values())
      return finalizePlan(planArray)
    }

    // Separate internship and regular courses
    const allCoursesToSchedule = [...failedCourses, ...activeCourses, ...pendingCourses]
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
      dependencyGraph.set(course.id, Array.isArray((course as any).prerequisites) ? course.prerequisites : [])
    })

    // Perform topological sort to respect prerequisites for regular courses
    const sortedRegularCourses = topologicalSort(regularCourses, dependencyGraph)

    console.log("Sorted regular courses:", sortedRegularCourses.length)

    // (moved) Locked and Active pre-placement happens after plan and schedule map are initialized below

    // Group regular courses into semesters with prerequisite gap enforcement
    const plan: SemesterPlan[] = []
    let currentPlanYear = currentYear
    let currentPlanTerm = currentTerm
    let currentSemesterCourses: PlanCourse[] = []
    let currentSemesterCredits = 0
    const TARGET_MAX_CREDITS = plannerMaxCredits

    const upsertSemesterCourses = (year: number, term: string, coursesToAdd: PlanCourse[]) => {
      if (!coursesToAdd || coursesToAdd.length === 0) return
      const normalizedTerm = normalizeTermLabel(term)
      const existing = plan.find((s) => s.year === year && termsMatch(s.term, normalizedTerm))
      if (existing) {
        const existingIds = new Set(existing.courses.map((c) => c.id))
        coursesToAdd.forEach((course) => {
          if (!existingIds.has(course.id)) {
            existing.courses.push(course)
            existingIds.add(course.id)
          }
        })
      } else {
        plan.push({ year, term: normalizedTerm, courses: [...coursesToAdd] })
      }
    }

    // Reserved internship terms (determine from curriculum)
    // Reserved terms disabled; internships will be scheduled dynamically after regular courses
    const reservedTermsLocal = new Set<string>()

    // Track when each course was scheduled (for prerequisite gap enforcement)
    const courseScheduleMap = new Map<string, { year: number; term: string }>()

    // Add passed courses to the schedule map so prerequisites work correctly
    courses
      .filter((c) => c.status === "passed")
      .forEach((course) => {
        // Assume passed courses were completed in their original term or earlier
        courseScheduleMap.set(course.id, { year: course.year + startYear - 1, term: course.term })
      })

    // Helper to construct PlanCourse
    const toEnhance = (c: Course): PlanCourse => ({
      ...c,
      // normalize prerequisites to avoid runtime errors from legacy saved data
      prerequisites: Array.isArray((c as any).prerequisites) ? c.prerequisites : [],
      availableSections: getAvailableSections(c.code),
      needsPetition: false,
      recommendedSection: findBestSection(c.code),
    })

    const detectRegularStudent = () => {
      const passedList = courses.filter((c) => c.status === "passed")
      if (passedList.length === 0) {
        return {
          isRegular: false,
          latestCalendarYear: 0,
          latestTermIndex: 0,
          latestTerm: "Term 1",
          latestCurriculumYear: 0,
          nextYear: 0,
          nextTerm: "Term 1",
          nextCurriculumYear: 0,
        }
      }

      let latestYear = -Infinity
      let latestTermIndex = -1

      passedList.forEach((pc) => {
        const calendarYear = pc.year + startYear - 1
        const termIndex = getTermIndex(pc.term)
        if (calendarYear > latestYear || (calendarYear === latestYear && termIndex > latestTermIndex)) {
          latestYear = calendarYear
          latestTermIndex = termIndex
        }
      })

      if (latestYear === -Infinity || latestTermIndex === -1) {
        return {
          isRegular: false,
          latestCalendarYear: 0,
          latestTermIndex: 0,
          latestTerm: "Term 1",
          latestCurriculumYear: 0,
          nextYear: 0,
          nextTerm: "Term 1",
          nextCurriculumYear: 0,
        }
      }

      const latestTerm = TERM_ORDER[latestTermIndex] || "Term 1"
      const latestCurriculumYear = latestYear - startYear + 1
      const curriculumCoursesForLatest = (initialCourses as any[]).filter(
        (c: any) => c.year === latestCurriculumYear && c.term === latestTerm,
      )

      if (curriculumCoursesForLatest.length === 0) {
        return {
          isRegular: false,
          latestCalendarYear: latestYear,
          latestTermIndex,
          latestTerm,
          latestCurriculumYear,
          nextYear: 0,
          nextTerm: "Term 1",
          nextCurriculumYear: 0,
        }
      }

      const passedIds = new Set(passedList.map((p) => p.id))
      const allPassed = curriculumCoursesForLatest.every((c: any) => passedIds.has(c.id))

      if (!allPassed) {
        return {
          isRegular: false,
          latestCalendarYear: latestYear,
          latestTermIndex,
          latestTerm,
          latestCurriculumYear,
          nextYear: 0,
          nextTerm: "Term 1",
          nextCurriculumYear: 0,
        }
      }

      const next = getNextTerm(latestYear, latestTerm)
      const nextCurriculumYear = latestCurriculumYear + (termsMatch(latestTerm, "Term 3") ? 1 : 0)

      return {
        isRegular: true,
        latestCalendarYear: latestYear,
        latestTermIndex,
        latestTerm,
        latestCurriculumYear,
        nextYear: next.year,
        nextTerm: next.term,
        nextCurriculumYear,
      }
    }

    const buildRegularCurriculumPlan = (info: ReturnType<typeof detectRegularStudent>): SemesterPlan[] => {
      const sortedCurriculum = [...(initialCourses as any[])].sort((a: any, b: any) => {
        if (a.year !== b.year) return a.year - b.year
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      const planByKey = new Map<string, SemesterPlan>()

      sortedCurriculum.forEach((curriculumCourse: any) => {
        const actualCourse = courses.find((c) => c.id === curriculumCourse.id)
        if (!actualCourse) return
        if (actualCourse.status === "passed") return

        const calendarYear = startYear + (curriculumCourse.year - 1)
        if (calendarYear < info.nextYear) return
        if (calendarYear === info.nextYear) {
          const currTermIndex = getTermIndex(curriculumCourse.term)
          const nextTermIndex = getTermIndex(info.nextTerm)
          if (nextTermIndex !== -1 && currTermIndex < nextTermIndex) return
        }

        const key = `${calendarYear}-${curriculumCourse.term}`
        let semester = planByKey.get(key)
        if (!semester) {
          semester = { year: calendarYear, term: curriculumCourse.term, courses: [] }
          planByKey.set(key, semester)
        }

        semester.courses.push(toEnhance(actualCourse))
      })

      return Array.from(planByKey.values())
    }

    const regularInfo = detectRegularStudent()
    if (regularInfo.isRegular) {
      const regularPlan = buildRegularCurriculumPlan(regularInfo)
      return finalizePlan(regularPlan)
    }

    // Pre-place locked courses into their specified terms
    const lockedIds = new Set(Object.keys(lockedPlacements))
    if (lockedIds.size > 0) {
      allCoursesToSchedule.forEach((c) => {
        if (lockedIds.has(c.id)) {
          const lock = lockedPlacements[c.id]
          if (lock) {
            const pc = toEnhance(c)
            upsertSemesterCourses(lock.year, lock.term, [pc])
            courseScheduleMap.set(c.id, { year: lock.year, term: normalizeTermLabel(lock.term) })
          }
        }
      })
    }

    // Pre-place active courses in the current term (unless locked elsewhere)
    const prePlacedActiveIds = new Set<string>()
    activeCourses.forEach((c) => {
      if (lockedIds.has(c.id)) return
      const pc = toEnhance(c)
      currentSemesterCourses.push(pc)
      currentSemesterCredits += pc.credits
      courseScheduleMap.set(pc.id, { year: currentPlanYear, term: currentPlanTerm })
      prePlacedActiveIds.add(pc.id)
    })

    // Build unlocked pools excluding locked and already pre-placed actives
    const unlockedRegular = regularCourses.filter((c) => !lockedIds.has(c.id) && !prePlacedActiveIds.has(c.id))
    const unlockedInternships = internshipCourses.filter((c) => !lockedIds.has(c.id) && !prePlacedActiveIds.has(c.id))

    // Enhance remaining courses with section availability info
    const enhancedRegularCourses: PlanCourse[] = topologicalSort(unlockedRegular, dependencyGraph).map(toEnhance)
    const enhancedInternshipCourses: PlanCourse[] = unlockedInternships.map(toEnhance)

    const criticalityScore = (course: PlanCourse | Course | null | undefined): number => {
      if (!course) return 0
      const dependents = dependentsCount.get(course.id) || 0
      const prereqCount = Array.isArray((course as any).prerequisites) ? course.prerequisites.length : 0
      return dependents * 2 + prereqCount
    }

    const isLowImpactCourse = (course: PlanCourse | Course | null | undefined): boolean => criticalityScore(course) === 0

    const hasSchedulableHighImpactForTerm = (year: number, term: string): boolean => {
      return remainingRegularCourses.some((c) => {
        if (isLowImpactCourse(c)) return false
        return canScheduleInTermLocal(c, year, term)
      })
    }

    const strategyBias = (course: PlanCourse): number => {
      const score = criticalityScore(course)
      const lightness = Math.max(0, 6 - (course.credits || 0)) // reward lighter loads for "easy"

      if (selectedStrategy === "crucial") {
        // Strongly boost courses that unlock dependents so they land earlier
        return score * 10 + (course.credits >= 3 ? 1 : 0)
      }
      if (selectedStrategy === "easy") {
        // Prefer low-impact, lighter courses first
        return lightness * 5 - score * 3
      }
      return 0
    }

    // Helper to check if a course can be scheduled in a given term
    const canScheduleInTermLocal = (course: PlanCourse | null | undefined, year: number, term: string): boolean => {
      // Defensive: if course is falsy, not schedulable
      if (!course) return false

      // Normalize prerequisites to avoid runtime errors from undefined
      const prereqs = Array.isArray((course as any).prerequisites) ? course.prerequisites : []

      // If no prerequisites, it's schedulable
      if (prereqs.length === 0) return true

      return prereqs.every((prereqId) => {
        // If prereq is already passed, it's satisfied
        const prereqCourse = findCourseById(prereqId)
        if (prereqCourse && prereqCourse.status === "passed") return true

        // Otherwise, check schedule map
        const prereqSchedule = courseScheduleMap.get(prereqId)
        if (!prereqSchedule) return false

        return isAtLeastOneTermAfter(year, term, prereqSchedule.year, prereqSchedule.term)
      })
    }

    // Sort regular courses by priority
    const priorityScore = (id: string) => PRIORITY_WEIGHTS[coursePriorities[id] || "medium"] || 0
    enhancedRegularCourses.sort((a, b) => {
      // First: failed courses (retakes) asap
      if (a.status === "failed" && b.status !== "failed") return -1
      if (a.status !== "failed" && b.status === "failed") return 1
      // Second: active courses next
      if (a.status === "active" && b.status !== "active") return -1
      if (a.status !== "active" && b.status === "active") return 1

      // Third: courses with prerequisites met
      const aPrereqsMet = arePrerequisitesMet(a)
      const bPrereqsMet = arePrerequisitesMet(b)
      if (aPrereqsMet && !bPrereqsMet) return -1
      if (!aPrereqsMet && bPrereqsMet) return 1

      // Fourth: user priority weight (high > medium > low)
      const pa = priorityScore(a.id)
      const pb = priorityScore(b.id)
      if (pa !== pb) return pb - pa

      // Strategy bias: push crucial (high criticality) earlier, easy (light/low-impact) earlier
      const strategyDelta = strategyBias(b) - strategyBias(a)
      if (strategyDelta !== 0) return strategyDelta

      // Fifth: unlocks more dependents earlier
      const da = dependentsCount.get(a.id) || 0
      const db = dependentsCount.get(b.id) || 0
      if (da !== db) return db - da

      // Finally: by original year and term
      if (a.year !== b.year) return a.year - b.year
      return getTermIndex(a.term) - getTermIndex(b.term)
    })

  // Helper: identify lab/lec pairing
  const isLab = (c: Course | PlanCourse) => c.id.endsWith("L") || (c.name || "").toUpperCase().includes("(LAB)")
  const isLec = (c: Course | PlanCourse) => !c.id.endsWith("L") && ((c.name || "").toUpperCase().includes("(LEC)") || courses.some(cc => cc.id === `${c.id}L`))
  const findPairId = (id: string) => (id.endsWith("L") ? id.slice(0, -1) : `${id}L`)

  // Schedule regular courses first
    const remainingRegularCourses = [...enhancedRegularCourses]
    const maxIterations = 100 // Prevent infinite loops
    let iteration = 0

    const tryFillToMin = () => {
      let added = 0
      if (currentSemesterCredits >= plannerMinCredits) return added
      const priorityScoreLocal = (id: string) => PRIORITY_WEIGHTS[coursePriorities[id] || "medium"] || 0
      const candidates = [...remainingRegularCourses].sort((a, b) => {
        if (a.status === "failed" && b.status !== "failed") return -1
        if (a.status !== "failed" && b.status === "failed") return 1
        if (a.status === "active" && b.status !== "active") return -1
        if (a.status !== "active" && b.status === "active") return 1
        const aPrereqsMet = canScheduleInTermLocal(a, currentPlanYear, currentPlanTerm)
        const bPrereqsMet = canScheduleInTermLocal(b, currentPlanYear, currentPlanTerm)
        if (aPrereqsMet && !bPrereqsMet) return -1
        if (!aPrereqsMet && bPrereqsMet) return 1
        const pa = priorityScoreLocal(a.id)
        const pb = priorityScoreLocal(b.id)
        if (pa !== pb) return pb - pa
        const strategyDelta = strategyBias(b) - strategyBias(a)
        if (strategyDelta !== 0) return strategyDelta
        const da = dependentsCount.get(a.id) || 0
        const db = dependentsCount.get(b.id) || 0
        if (da !== db) return db - da
        const aPetitionNow = courseNeedsPetitionForTerm(a, currentPlanTerm)
        const bPetitionNow = courseNeedsPetitionForTerm(b, currentPlanTerm)
        if (!aPetitionNow && bPetitionNow) return -1
        if (aPetitionNow && !bPetitionNow) return 1
        if (a.year !== b.year) return a.year - b.year
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      for (const course of candidates) {
        if (currentSemesterCredits >= plannerMinCredits) break
        if (!canScheduleInTermLocal(course, currentPlanYear, currentPlanTerm)) continue
        if (selectedStrategy !== "easy" && hasSchedulableHighImpactForTerm(currentPlanYear, currentPlanTerm) && isLowImpactCourse(course)) continue
        if (currentSemesterCredits + course.credits > TARGET_MAX_CREDITS) continue
        currentSemesterCourses.push(course)
        currentSemesterCredits += course.credits
        courseScheduleMap.set(course.id, { year: currentPlanYear, term: currentPlanTerm })
        const idx = remainingRegularCourses.findIndex((c) => c.id === course.id)
        if (idx !== -1) remainingRegularCourses.splice(idx, 1)
        added++
      }
      return added
    }

    // Helper to add a course into current semester bookkeeping (with optional co-req pairing)
    const addCourseNow = (course: PlanCourse) => {
      currentSemesterCourses.push(course)
      currentSemesterCredits += course.credits
      courseScheduleMap.set(course.id, { year: currentPlanYear, term: currentPlanTerm })
      const idx = remainingRegularCourses.findIndex((c) => c.id === course.id)
      if (idx !== -1) remainingRegularCourses.splice(idx, 1)

      const pairId = findPairId(course.id)
      const pair = remainingRegularCourses.find((c) => c.id === pairId)
      if (pair) {
        if ((isLec(course) && isLab(pair)) || (isLab(course) && isLec(pair))) {
          if (canScheduleInTermLocal(pair, currentPlanYear, currentPlanTerm)) {
            if (currentSemesterCredits + pair.credits <= TARGET_MAX_CREDITS) {
              currentSemesterCourses.push(pair)
              currentSemesterCredits += pair.credits
              courseScheduleMap.set(pair.id, { year: currentPlanYear, term: currentPlanTerm })
              const pIdx = remainingRegularCourses.findIndex((c) => c.id === pair.id)
              if (pIdx !== -1) remainingRegularCourses.splice(pIdx, 1)
            }
          }
        }
      }
    }

    const tryPlaceCourseInExistingPlan = (course: PlanCourse): boolean => {
      const lock = lockedPlacements[course.id]
      const computeCredits = (semester: SemesterPlan) => semester.courses.reduce((sum, c) => sum + c.credits, 0)

      const order: number[] = []
      for (let idx = 0; idx < plan.length; idx++) {
        order.push(idx)
      }
      const iterationOrder = selectedStrategy === "crucial" ? order : order.reverse()

      for (const i of iterationOrder) {
        const semester = plan[i]

        if (lock && !(semester.year === lock.year && termsMatch(semester.term, lock.term))) {
          continue
        }

        const containsInternship = semester.courses.some((c) => isInternshipCourse(c))
        if (containsInternship && !isInternshipCourse(course)) {
          continue
        }

        if (!canScheduleInTermLocal(course, semester.year, semester.term)) {
          continue
        }

        if (computeCredits(semester) + course.credits > TARGET_MAX_CREDITS) {
          continue
        }

        semester.courses.push(course)
        courseScheduleMap.set(course.id, { year: semester.year, term: semester.term })
        const idx = remainingRegularCourses.findIndex((c) => c.id === course.id)
        if (idx !== -1) {
          remainingRegularCourses.splice(idx, 1)
        }
        return true
      }

      return false
    }

    // Try to pack up to the recommended max via small search (singles and pairs)
    const tryPackToMax = () => {
      let packed = 0
      const remainingCapacity = Math.max(0, TARGET_MAX_CREDITS - currentSemesterCredits)
      if (remainingCapacity <= 0) return packed

      const eligible = remainingRegularCourses.filter((c) => canScheduleInTermLocal(c, currentPlanYear, currentPlanTerm))
      if (eligible.length === 0) return packed

      const preferHighImpact = selectedStrategy !== "easy" && hasSchedulableHighImpactForTerm(currentPlanYear, currentPlanTerm)

      const priorityScoreLocal = (id: string) => PRIORITY_WEIGHTS[coursePriorities[id] || "medium"] || 0
      const sorted = [...eligible].sort((a, b) => {
        if (a.status === "failed" && b.status !== "failed") return -1
        if (a.status !== "failed" && b.status === "failed") return 1
        if (a.status === "active" && b.status !== "active") return -1
        if (a.status !== "active" && b.status === "active") return 1
        const pa = priorityScoreLocal(a.id)
        const pb = priorityScoreLocal(b.id)
        if (pa !== pb) return pb - pa
        const strategyDelta = strategyBias(b) - strategyBias(a)
        if (strategyDelta !== 0) return strategyDelta
        const da = dependentsCount.get(a.id) || 0
        const db = dependentsCount.get(b.id) || 0
        if (da !== db) return db - da
        const aPetitionNow = courseNeedsPetitionForTerm(a, currentPlanTerm)
        const bPetitionNow = courseNeedsPetitionForTerm(b, currentPlanTerm)
        if (!aPetitionNow && bPetitionNow) return -1
        if (aPetitionNow && !bPetitionNow) return 1
        if (a.year !== b.year) return a.year - b.year
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      const TOP = 8
      const top = sorted.slice(0, TOP)

      const chooseBestSingle = (cap: number) => {
        let best: PlanCourse | null = null
        let bestCredits = -1
        for (const c of top) {
          if (c.credits <= cap) {
            if (preferHighImpact && isLowImpactCourse(c)) continue
            if (selectedStrategy === "crucial" && isLowImpactCourse(c) && currentSemesterCredits >= plannerMinCredits) {
              continue
            }
            if (c.credits > bestCredits) {
              best = c
              bestCredits = c.credits
            }
          }
        }
        return best
      }

      const chosen = chooseBestSingle(remainingCapacity)
      if (chosen) {
        addCourseNow(chosen)
        packed++
      }

      let remainingSoft = Math.max(0, TARGET_MAX_CREDITS - currentSemesterCredits)
      if (remainingSoft <= 0) return packed

      const pool = remainingRegularCourses.filter((c) => canScheduleInTermLocal(c, currentPlanYear, currentPlanTerm))
      const poolTop = pool
        .sort((a, b) => {
          if (b.credits !== a.credits) return b.credits - a.credits
          const delta = strategyBias(b) - strategyBias(a)
          if (delta !== 0) return delta
          return (dependentsCount.get(b.id) || 0) - (dependentsCount.get(a.id) || 0)
        })
        .slice(0, TOP)
      let pairAdded = false
      for (let i = 0; i < poolTop.length && !pairAdded; i++) {
        for (let j = i + 1; j < poolTop.length && !pairAdded; j++) {
          const a = poolTop[i]
          const b = poolTop[j]
          const sum = a.credits + b.credits
          if (sum <= remainingSoft) {
            if (preferHighImpact && (isLowImpactCourse(a) || isLowImpactCourse(b))) continue
            if (selectedStrategy === "crucial" && currentSemesterCredits >= plannerMinCredits) {
              if (isLowImpactCourse(a) || isLowImpactCourse(b)) {
                continue
              }
            }
            if (currentSemesterCredits + a.credits <= TARGET_MAX_CREDITS) {
              addCourseNow(a)
              packed++
              remainingSoft = Math.max(0, TARGET_MAX_CREDITS - currentSemesterCredits)
            }
            if (currentSemesterCredits + b.credits <= TARGET_MAX_CREDITS) {
              addCourseNow(b)
              packed++
              remainingSoft = Math.max(0, TARGET_MAX_CREDITS - currentSemesterCredits)
            }
            pairAdded = true
          }
        }
      }

      return packed
    }

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
          upsertSemesterCourses(currentPlanYear, currentPlanTerm, [...currentSemesterCourses])
          currentSemesterCourses = []
          currentSemesterCredits = 0
        }
      }

      console.log(`Regular courses iteration ${iteration}: ${remainingRegularCourses.length} courses remaining`)

      // Try to schedule courses in the current term
      for (let i = remainingRegularCourses.length - 1; i >= 0; i--) {
        if (currentSemesterCredits >= TARGET_MAX_CREDITS) break
        const course = remainingRegularCourses[i]

        // Check if this course can be scheduled in the current term
        if (!canScheduleInTermLocal(course, currentPlanYear, currentPlanTerm)) {
          continue // Skip this course for now
        }

        const highImpactAvailable = selectedStrategy !== "easy" && hasSchedulableHighImpactForTerm(currentPlanYear, currentPlanTerm)
        if (highImpactAvailable && isLowImpactCourse(course)) {
          continue
        }

    // If adding this course would exceed the target limit, start a new semester (do not add if it would exceed)
        if (currentSemesterCredits + course.credits > TARGET_MAX_CREDITS) {
          if (tryPlaceCourseInExistingPlan(course)) {
            coursesScheduledThisIteration++
            continue
          }
          if (currentSemesterCourses.length > 0) {
            // Save current semester
            upsertSemesterCourses(currentPlanYear, currentPlanTerm, [...currentSemesterCourses])

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

        // Add course to current semester (and try bundle with co-req)
        addCourseNow(course)
        coursesScheduledThisIteration++
        console.log(`Scheduled regular ${course.code} in ${currentPlanYear} ${currentPlanTerm}`)
      }

      // Try to reach the recommended minimum load using eligible remaining courses
      if (currentSemesterCredits < plannerMinCredits) {
        const newlyAdded = tryFillToMin()
        coursesScheduledThisIteration += newlyAdded
      }

      // After min is satisfied, try to pack toward the recommended max with small search
      if (currentSemesterCredits >= plannerMinCredits && currentSemesterCredits < plannerMaxCredits) {
        const packed = tryPackToMax()
        coursesScheduledThisIteration += packed
      }

      // If no courses were scheduled in this iteration, move to next term
      if (coursesScheduledThisIteration === 0 && remainingRegularCourses.length > 0) {
        // Save current semester if it has courses
        if (currentSemesterCourses.length > 0) {
          upsertSemesterCourses(currentPlanYear, currentPlanTerm, [...currentSemesterCourses])
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
      upsertSemesterCourses(currentPlanYear, currentPlanTerm, [...currentSemesterCourses])

      // Move to next term for internships
      const next = getNextTerm(currentPlanYear, currentPlanTerm)
      currentPlanYear = next.year
      currentPlanTerm = next.term
    }

  // Now schedule internship courses into the earliest feasible academic year:
  // Find the latest term that contains a non-internship course. If that term is Term 1, place
  // internships in Term 2 and Term 3 of the same year; otherwise, place them in the next year's Term 2 and Term 3.
    let latestYear = currentYear
    let latestTermIdx = 0
    for (const sem of plan) {
      const hasRegular = sem.courses.some((c) => !isInternshipCourse(c))
      if (!hasRegular) continue
      const idx = getTermIndex(sem.term)
      if (sem.year > latestYear || (sem.year === latestYear && idx > latestTermIdx)) {
        latestYear = sem.year
        latestTermIdx = idx
      }
    }
    const internshipTargetYear = latestTermIdx <= 0 ? latestYear : latestYear + 1

    // Helper to find or create a semester in the plan and return it
    const findOrCreateSemester = (year: number, term: string): SemesterPlan => {
      let idx = plan.findIndex((s) => s.year === year && termsMatch(s.term, term))
      if (idx !== -1) return plan[idx]

      const newSemester: SemesterPlan = { year, term: normalizeTermLabel(term), courses: [] }
      // Insert chronologically
      let insertIndex = plan.length
      for (let i = 0; i < plan.length; i++) {
        const semester = plan[i]
        if (
          semester.year > year ||
          (semester.year === year &&
            getTermIndex(semester.term) > getTermIndex(term))
        ) {
          insertIndex = i
          break
        }
      }
      plan.splice(insertIndex, 0, newSemester)
      return newSemester
    }

    // No reserved terms relocation: internships are scheduled into the computed target year

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
      const existingIndex = plan.findIndex((s) => s.year === year && termsMatch(s.term, term))
      if (existingIndex !== -1) {
        plan[existingIndex].courses = plan[existingIndex].courses.filter((c) => isInternshipCourse(c))
      }
      upsertSemesterCourses(year, term, [course])
      courseScheduleMap.set(course.id, { year, term: normalizeTermLabel(term) })
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
    // Backfill/Merge pass: try to move later regular courses into earlier semesters to reduce trailing tiny terms
    const termOrderIdx = (t: string) => getTermIndex(t)
    const hasInternOnly = (sem: SemesterPlan) => sem.courses.length > 0 && sem.courses.every((c) => isInternshipCourse(c))
    const sumCredits = (sem: SemesterPlan) => sem.courses.reduce((s, c) => s + c.credits, 0)

    const rebalanceOverloadedSemesters = () => {
      const limit = plannerMaxCredits
      if (plan.length === 0 || limit <= 0) {
        return
      }

      const priorityScoreLocal = (id: string) => PRIORITY_WEIGHTS[coursePriorities[id] || "medium"] || 0

      const dependentsRemainAfterMove = (course: PlanCourse, targetYear: number, targetTerm: string) => {
        const dependents = dependentsMap.get(course.id) || []
        return dependents.every((dependentId) => {
          const placement = courseScheduleMap.get(dependentId)
          if (!placement) return true
          return isAtLeastOneTermAfter(placement.year, placement.term, targetYear, targetTerm)
        })
      }

      const appendSemesterForCourse = (course: PlanCourse): SemesterPlan | null => {
        if (plan.length === 0) return null
        let anchorYear = plan[plan.length - 1].year
        let anchorTerm = plan[plan.length - 1].term
        const MAX_FUTURE_TERMS = 12
        for (let hop = 0; hop < MAX_FUTURE_TERMS; hop++) {
          const next = getNextTerm(anchorYear, anchorTerm)
          anchorYear = next.year
          anchorTerm = next.term
          if (!canScheduleInTermLocal(course, anchorYear, anchorTerm)) continue
          if (!dependentsRemainAfterMove(course, anchorYear, anchorTerm)) continue
          const newSemester: SemesterPlan = { year: anchorYear, term: normalizeTermLabel(anchorTerm), courses: [] }
          plan.push(newSemester)
          return newSemester
        }
        return null
      }

      const findTargetSemester = (course: PlanCourse, fromSemester: SemesterPlan, fromIndex: number): SemesterPlan | null => {
        for (let idx = fromIndex + 1; idx < plan.length; idx++) {
          const candidate = plan[idx]
          if (!isAtLeastOneTermAfter(candidate.year, candidate.term, fromSemester.year, fromSemester.term)) continue
          if (candidate.courses.some((c) => isInternshipCourse(c)) && !isInternshipCourse(course)) continue
          if (sumCredits(candidate) + course.credits > limit) continue
          if (!canScheduleInTermLocal(course, candidate.year, candidate.term)) continue
          if (!dependentsRemainAfterMove(course, candidate.year, candidate.term)) continue
          return candidate
        }
        return appendSemesterForCourse(course)
      }

      const isMovableCourse = (course: PlanCourse, semester: SemesterPlan) => {
        if (lockedPlacements[course.id]) return false
        if (isInternshipCourse(course)) return false
        if (semester.year === currentYear && termsMatch(semester.term, currentTerm) && course.status === "active") return false
        return true
      }

      for (let i = 0; i < plan.length; i++) {
        const semester = plan[i]
        if (semester.courses.length === 0) continue
        if (hasInternOnly(semester)) continue
        if (semester.year === currentYear && termsMatch(semester.term, currentTerm)) continue

        let total = sumCredits(semester)
        if (total <= limit) continue

        const movable = semester.courses.filter((course) => isMovableCourse(course, semester))
        if (movable.length === 0) continue

        movable.sort((a, b) => {
          const pa = priorityScoreLocal(a.id)
          const pb = priorityScoreLocal(b.id)
          if (pa !== pb) return pa - pb
          const depA = dependentsCount.get(a.id) || 0
          const depB = dependentsCount.get(b.id) || 0
          if (depA !== depB) return depA - depB
          return b.credits - a.credits
        })

        for (const course of movable) {
          total = sumCredits(semester)
          if (total <= limit) break

          const targetSemester = findTargetSemester(course, semester, i)
          if (!targetSemester) continue
          if (!isAtLeastOneTermAfter(targetSemester.year, targetSemester.term, semester.year, semester.term)) continue
          if (sumCredits(targetSemester) + course.credits > limit) continue

          const removeIndex = semester.courses.findIndex((c) => c.id === course.id)
          if (removeIndex === -1) continue
          semester.courses.splice(removeIndex, 1)
          targetSemester.courses.push(course)
          courseScheduleMap.set(course.id, { year: targetSemester.year, term: targetSemester.term })
        }
      }

      for (let i = plan.length - 1; i >= 0; i--) {
        if (plan[i].courses.length === 0) {
          plan.splice(i, 1)
        }
      }
    }

    for (let i = plan.length - 1; i >= 1; i--) {
      const sem = plan[i]
      // Skip pure internship terms for backfill source
      if (hasInternOnly(sem)) continue
      for (let k = sem.courses.length - 1; k >= 0; k--) {
        const course = sem.courses[k]
        if (isInternshipCourse(course)) continue
        // Respect explicit locks
        if (lockedPlacements[course.id]) {
          const lock = lockedPlacements[course.id]
          if (!(lock.year === sem.year && termsMatch(lock.term, sem.term))) {
            // The course is locked elsewhere; skip moving here
            continue
          }
        }
        // Try earlier semesters from i-1 down to 0
        for (let j = i - 1; j >= 0; j--) {
          const target = plan[j]
          // Don't move into internship terms
          const containsIntern = target.courses.some((c) => isInternshipCourse(c))
          if (containsIntern) continue
          // Prereqs must be scheduled before target term
          const prereqOk = (Array.isArray((course as any).prerequisites) ? course.prerequisites : []).every((p) => {
            // Find where prereq is scheduled (or passed)
            const pr = findCourseById(p)
            if (pr && pr.status === "passed") return true
            let found = null as { y: number; t: string } | null
            for (const s of plan) {
              const c = s.courses.find((x) => x.id === p)
              if (c) {
                found = { y: s.year, t: s.term }
                break
              }
            }
            if (!found) return false
            if (target.year > found.y) return true
            if (target.year < found.y) return false
            return termOrderIdx(target.term) > termOrderIdx(found.t)
          })
          if (!prereqOk) continue
          // Capacity check
          if (sumCredits(target) + course.credits > TARGET_MAX_CREDITS) continue
          // Move
          sem.courses.splice(k, 1)
          target.courses.push(course)
          // Update indices for next checks
          break
        }
      }
      // If semester became empty after moves, remove it
      if (sem.courses.length === 0) {
        plan.splice(i, 1)
      }
    }

  // Ensure chronological order after backfill
  plan.sort((a, b) => (a.year === b.year ? termOrderIdx(a.term) - termOrderIdx(b.term) : a.year - b.year))
  const balancedPlan = rebalancePlanForCreditLimits(plan, {
    allowCurrentTermActiveMoves: true,
    minCredits: enforceStrictCredits ? plannerMinCredits : undefined,
    maxCredits: enforceStrictCredits ? plannerMaxCredits : undefined,
  })
  balancedPlan.sort((a, b) => (a.year === b.year ? termOrderIdx(a.term) - termOrderIdx(b.term) : a.year - b.year))

    const resultPlan = finalizePlan(balancedPlan)
    return resultPlan
  }

  // Remove a course from the graduation plan
  const removeCourseFromPlan = (courseId: string) => {
    setGraduationPlan((prevPlan) => {
      const updatedPlan = prevPlan
        .map((semester) => ({
          ...semester,
          courses: semester.courses.filter((course) => course.id !== courseId),
        }))
        .filter((semester) => semester.courses.length > 0)

      return applyPetitionFlagsToPlan(updatedPlan)
    })
  }

  // Change section for a course in the plan
  const changeCourseSection = (courseId: string, newSection: CourseSection) => {
    setGraduationPlan((prevPlan) => {
      const updatedPlan = prevPlan.map((semester) => ({
        ...semester,
        courses: semester.courses.map((course) =>
          course.id === courseId ? { ...course, recommendedSection: newSection } : course,
        ),
      }))
      return applyPetitionFlagsToPlan(updatedPlan)
    })
  }

  // Priority and Lock helpers
  const setCoursePriority = (courseId: string, level: keyof typeof PRIORITY_WEIGHTS) => {
    setCoursePriorities((prev) => ({ ...prev, [courseId]: level }))
  }
  const toggleCourseLock = (courseId: string, year: number, term: string) => {
    const normalizedTerm = normalizeTermLabel(term)
    const pairCourseId = resolveLockPairCourseId(courseId)

    setLockedPlacements((prev) => {
      const existing = prev[courseId]
      const shouldRemove = existing && existing.year === year && termsMatch(existing.term, normalizedTerm)

      if (shouldRemove) {
        const { [courseId]: _omit, ...rest } = prev
        const next = { ...rest }
        if (pairCourseId && pairCourseId !== courseId) {
          delete next[pairCourseId]
        }
        return next
      }

      const next: Record<string, { year: number; term: string }> = {
        ...prev,
        [courseId]: { year, term: normalizedTerm },
      }

      if (pairCourseId && pairCourseId !== courseId) {
        next[pairCourseId] = { year, term: normalizedTerm }
      }

      return next
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
  const toggleSemester = (year: number, term: string, open?: boolean) => {
    const key = `${year}-${term}`
    setOpenSemesters((prev) => ({
      ...prev,
      [key]: open ?? !prev[key],
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
      .filter((course) => (course.status === "pending" || course.status === "active" || course.status === "failed") && !coursesInPlan.has(course.id))
      .map((course) => {
        const availableSections = getAvailableSections(course.code)
        const needsPetition = false
        const recommendedSection = findBestSection(course.code)

        return {
          ...course,
          prerequisites: Array.isArray((course as any).prerequisites) ? course.prerequisites : [],
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
  const isReserved = targetYear === internshipTargetYear && (termsMatch(targetTerm, "Term 2") || termsMatch(targetTerm, "Term 3"))

  // If it's a reserved term and the course is not an internship, open confirmation modal
  if (isReserved && !isInternshipCourse(course)) {
    setPendingAdd({ courseId, targetYear, targetTerm, reason: "overload" })
    setOverloadDialogOpen(true)
    return
  }

  // If adding to current term and course may need petition, confirm
  const needsPetition = courseNeedsPetitionForTerm(course, targetTerm)
  if (needsPetition && targetYear === currentYear && termsMatch(targetTerm, currentTerm)) {
    setPendingAdd({ courseId, targetYear, targetTerm, reason: "petition" })
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
    const needsPetition = courseNeedsPetitionForTerm(course, targetTerm)
    const recommendedSection = findBestSection(course.code)

    const planCourse: PlanCourse = {
      ...course,
      prerequisites: Array.isArray((course as any).prerequisites) ? course.prerequisites : [],
      availableSections,
      needsPetition,
      recommendedSection,
    }

    setGraduationPlan((prevPlan) => {
      // Check if target semester already exists
      const targetSemesterIndex = prevPlan.findIndex(
        (semester) => semester.year === targetYear && termsMatch(semester.term, targetTerm),
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
          term: normalizeTermLabel(targetTerm),
          courses: [planCourse],
        }

        // Insert in chronological order
        let insertIndex = updatedPlan.length
        for (let i = 0; i < updatedPlan.length; i++) {
          const semester = updatedPlan[i]
          if (
            semester.year > targetYear ||
            (semester.year === targetYear && getTermIndex(semester.term) > getTermIndex(targetTerm))
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
        return getTermIndex(a.term) - getTermIndex(b.term)
      })

      return applyPetitionFlagsToPlan(updatedPlan)
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

  const renderCourseListBadges = (list: Course[], emptyLabel: string) => {
    if (!list || list.length === 0) {
      return <span className="text-sm text-muted-foreground">{emptyLabel}</span>
    }

    const MAX_ROWS_PER_COLUMN = 2
    const columns: Course[][] = []
    for (let i = 0; i < list.length; i += MAX_ROWS_PER_COLUMN) {
      columns.push(list.slice(i, i + MAX_ROWS_PER_COLUMN))
    }

    return (
      <div className="flex flex-wrap gap-2">
        {columns.map((columnCourses, columnIndex) => (
          <div key={`column-${columnIndex}`} className="flex flex-col gap-1">
            {columnCourses.map((linkedCourse) => {
              const description = linkedCourse.description?.trim()
              const courseName = linkedCourse.name?.trim() || linkedCourse.code
              const tooltip = description ? `${courseName} — ${description}` : courseName

              return (
                <Popover key={linkedCourse.id}>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer"
                      title={tooltip}
                      aria-label={tooltip}
                    >
                      {linkedCourse.code}
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-64 space-y-1 text-xs"
                  >
                    <p className="text-sm font-semibold">{linkedCourse.code}</p>
                    {courseName && courseName !== linkedCourse.code && (
                      <p className="text-sm">{courseName}</p>
                    )}
                    {description && (
                      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
                    )}
                  </PopoverContent>
                </Popover>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderPlanActionControls = (showJump: boolean) => (
    <div className="flex items-center gap-1">
      {showJump && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => planActionsRef?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Jump to plan actions"
        >
          <ArrowUpDown className="h-3 w-3" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => setPlanActionsCollapsed((prev) => !prev)}
        aria-label={planActionsCollapsed ? "Expand plan actions" : "Collapse plan actions"}
      >
        {planActionsCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </Button>
    </div>
  )

  const pendingPrereqShiftCourse = pendingPrereqShift ? findCourseById(pendingPrereqShift.courseId) : null
  const pendingPrereqShiftPair = pendingPrereqShift?.pair ?? null
  const pendingPrereqShiftHasDependents = (pendingPrereqShift?.adjustments.length ?? 0) > 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div
        className={cn(
          "container mx-auto px-4 py-8",
          isMobile && floatingControlsVisible ? "pb-40" : ""
        )}
      >
        <div className="mb-6">
          <QuickNavigation />
        </div>

        <div className="mb-6" ref={topHeaderRef}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Academic Planner</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Plan your path to graduation based on your current progress
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriodDialogOpen(true)}
                disabled={periodDialogOpen}
                className="px-4"
              >
                Review Period
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
        </div>

        {/* Non-CpE Student Notice */}
        <NonCpeNotice onReportIssue={() => setFeedbackDialogOpen(true)} />
        <FeedbackDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          defaultSubject="Non-CpE curriculum import issue"
        />
        <Dialog
          open={periodDialogOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setPeriodDialogOpen(true)
            } else {
              confirmPeriodDialog()
            }
          }}
        >
          <DialogContent
            className={cn(
              "max-w-2xl flex flex-col gap-4",
              isMobile
                ? "h-[90vh] max-w-none rounded-none border-0 px-4 pb-6 pt-4"
                : "rounded-2xl border"
            )}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Confirm your current academic period</DialogTitle>
              <DialogDescription>
                We synced this planner with {formatAcademicYear(currentYear)} {currentTerm}. Double-check the courses you
                plan to take so recommendations stay aligned.
              </DialogDescription>
            </DialogHeader>
            <div className={cn("space-y-6", isMobile ? "flex-1 overflow-y-auto pr-1" : "")}>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Marked as active</p>
                <p className="text-xs text-muted-foreground">
                  Pulled from Course Tracker — adjust there if something looks off.
                </p>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3 text-sm dark:border-blue-900 dark:bg-blue-900/20">
                  {activeCourses.length > 0 ? (
                    <ul className="space-y-1">
                      {activeCourses.map((course) => (
                        <li key={`active-${course.id}`} className="flex items-center justify-between gap-3">
                          <span className="font-medium text-blue-900 dark:text-blue-100">{course.code}</span>
                          <span className="text-muted-foreground truncate">{course.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No courses are currently marked as active.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Planned for this term</p>
                <p className="text-xs text-muted-foreground">
                  {currentTermPlanCourses.length > 0
                    ? "Based on the generated plan for this academic period."
                    : "Once you add courses to this term, they will appear here."}
                </p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200 mt-1">
                  Total units: {currentTermPlanUnits}
                </p>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-900/20">
                  {currentTermPlanCourses.length > 0 ? (
                    <ul className="space-y-1">
                      {currentTermPlanCourses.map((course) => (
                        <li key={`term-${course.id}`} className="flex items-center justify-between gap-3">
                          <span className="font-medium text-emerald-900 dark:text-emerald-100">{course.code}</span>
                          <span className="text-muted-foreground truncate">
                            {course.name} • {course.credits}u
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">You have not added any courses to this term yet.</p>
                  )}
                </div>
              </div>
              {shouldPromptCreditConfirmation && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">Confirm your unit range</p>
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                      Imported curricula can use different credit loads. Set the min/max units you follow from the Student Portal or OSES so overload warnings stay accurate.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-amber-900 dark:text-amber-100" htmlFor="period-min-credits">
                        Minimum units per term
                      </label>
                      <Input
                        id="period-min-credits"
                        type="number"
                        min={0}
                        max={29}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={draftMinCreditsPerTerm}
                        onChange={(e) => handleMinCreditsChange(Number.parseInt(e.target.value, 10))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-amber-900 dark:text-amber-100" htmlFor="period-max-credits">
                        Maximum units per term
                      </label>
                      <Input
                        id="period-max-credits"
                        type="number"
                        min={0}
                        max={29}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={draftMaxCreditsPerTerm}
                        onChange={(e) => handleMaxCreditsChange(Number.parseInt(e.target.value, 10))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {creditLimitError && (
                    <div className="mt-3 rounded-md border border-red-200/70 bg-red-50/80 p-3 text-xs font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                      {creditLimitError}
                    </div>
                  )}
                  {isMaxCreditsAtOrBelowMin && (
                    <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-100/70 p-3 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      Maximum units must be greater than {draftMinCreditsPerTerm}. Until that happens, we'll rely on the default cap of {RECOMMENDED_UNITS_MAX} units ({effectiveMaxCreditsWithOverflow} with overflow) to prevent overloads.
                    </div>
                  )}
                  <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                    Press <span className="font-semibold">Looks good</span> to save these limits locally so you only need to confirm them once.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter
              className={cn(
                "flex flex-col gap-2 sm:flex-row sm:justify-end",
                isMobile ? "border-t border-border/40 pt-4" : ""
              )}
            >
              <Button variant="outline" className="w-full" asChild>
                <Link href="/course-tracker">Open Course Tracker</Link>
              </Button>
              <Button
                onClick={confirmPeriodDialog}
                className={cn(confirmButtonShaking ? "animate-shake" : "")}
              >
                Looks good
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={regularPeriodDialogOpen}
          onOpenChange={(nextOpen) => {
            setRegularPeriodDialogOpen(nextOpen)
            if (!nextOpen) setRegularPeriodInfo(null)
          }}
        >
          <DialogContent
            className={cn(
              "max-w-xl flex flex-col gap-4",
              isMobile ? "h-[90vh] max-w-none rounded-none border-0 px-4 pb-6 pt-4" : "rounded-2xl border"
            )}
          >
            <DialogHeader>
              <DialogTitle>Term matches the official curriculum</DialogTitle>
              <DialogDescription>
                Great job! Your plan for {regularPeriodInfo ? `${formatAcademicYear(regularPeriodInfo.year)} ${regularPeriodInfo.term}` : "this term"}
                includes every subject from the CpE curriculum without extras.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              We will treat this term as a regular load so all validations follow the standard sequence. Adjust anything
              below if you plan to deviate.
            </p>
            <div
              className={cn(
                "mt-2 max-h-60 overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-900/20",
                isMobile ? "flex-1" : ""
              )}
            >
              {regularPeriodInfo ? (
                <ul className="space-y-1">
                  {regularPeriodInfo.courses.map((course) => (
                    <li key={`regular-${course.id}`} className="flex items-center justify-between gap-3">
                      <span className="font-medium text-emerald-900 dark:text-emerald-100">{course.code}</span>
                      <span className="text-muted-foreground truncate">{course.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Curriculum courses for this term will appear here.</p>
              )}
            </div>
            <DialogFooter className={cn(isMobile ? "border-t border-border/40 pt-4" : "")}>
              <Button onClick={() => setRegularPeriodDialogOpen(false)}>Awesome</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={regularNoticeOpen} onOpenChange={setRegularNoticeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regular Curriculum Detected</DialogTitle>
              <DialogDescription>
                {regularNoticeTerm
                  ? `We detected a curriculum-perfect schedule for ${formatAcademicYear(regularNoticeTerm.year)} ${regularNoticeTerm.term}.`
                  : "We detected a curriculum-perfect schedule."}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              The planner will prioritize the official curriculum sequence for the next term. You can still adjust the
              plan manually if you need to deviate.
            </p>
            <DialogFooter>
              <Button onClick={() => setRegularNoticeOpen(false)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={regenerateDialogOpen}
          onOpenChange={(open) => {
            setRegenerateDialogOpen(open)
            if (!open) {
              setPendingRegenerateStrategy(plannerStrategy)
              setPendingStrictGuardrails(strictGuardrailsEnabled)
              setPendingRegenerateMin(minCreditsPerTerm)
              setPendingRegenerateMax(maxCreditsPerTerm)
              setRegenerateCreditError(null)
              setRegeneratePreview(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Generate Graduation Plan</DialogTitle>
              <DialogDescription>
                Choose how we should rebuild the remaining terms. We'll keep your locks and credit guardrails intact.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(REGENERATE_STRATEGY_META) as RegenerateStrategy[]).map((strategy) => {
                const meta = REGENERATE_STRATEGY_META[strategy]
                const isActive = pendingRegenerateStrategy === strategy
                return (
                  <button
                    key={strategy}
                    type="button"
                    onClick={() => setPendingRegenerateStrategy(strategy)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition focus:outline-none",
                      isActive
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30"
                        : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500",
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{meta.title}</p>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mt-1">{meta.tagline}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{meta.description}</p>
                  </button>
                )
              })}
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium text-slate-900 dark:text-slate-100">Preferred unit range</p>
                  <span className="text-xs text-muted-foreground">Used for this regeneration</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="regenerate-min">
                      Minimum units per term
                    </label>
                    <Input
                      id="regenerate-min"
                      type="number"
                      min={CREDIT_INPUT_MIN}
                      max={CREDIT_INPUT_MAX}
                      step={1}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pendingRegenerateMin}
                      onChange={(e) => handlePendingRegenerateMinChange(Number.parseInt(e.target.value, 10))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="regenerate-max">
                      Maximum units per term
                    </label>
                    <Input
                      id="regenerate-max"
                      type="number"
                      min={CREDIT_INPUT_MIN}
                      max={CREDIT_INPUT_MAX}
                      step={1}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pendingRegenerateMax}
                      onChange={(e) => handlePendingRegenerateMaxChange(Number.parseInt(e.target.value, 10))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  These values override your saved credit guardrails for the regenerated plan and update your defaults once applied.
                </p>
                {regenerateCreditError && (
                  <p className="mt-3 rounded-md border border-red-200/60 bg-red-50/70 p-2 text-xs font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                    {regenerateCreditError}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium text-slate-900 dark:text-slate-100">Credit distribution preview</p>
                  <span className="text-xs text-muted-foreground">Updates automatically</span>
                </div>
                {regeneratePreview && regeneratePreview.rows.length > 0 ? (
                  <div className="mt-3 max-h-60 overflow-y-auto relative">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Term</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regeneratePreview.rows.map((row) => {
                          const withinRange = row.credits >= row.minTarget && row.credits <= row.maxTarget
                          return (
                            <TableRow key={row.label}>
                              <TableCell>{row.label}</TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={cn(
                                    "font-semibold",
                                    withinRange
                                      ? "text-emerald-600 dark:text-emerald-300"
                                      : "text-amber-600 dark:text-amber-300",
                                  )}
                                >
                                  {row.credits}u
                                </span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({row.minTarget}-{row.maxTarget}u)
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    {regeneratePreviewLoading && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 text-xs font-medium text-muted-foreground backdrop-blur-sm dark:bg-slate-900/70">
                        Calculating preview…
                      </div>
                    )}
                  </div>
                ) : regeneratePreviewLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">Calculating preview…</p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No remaining courses need planning right now.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-medium">Strict credit guardrails</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, every regenerated term is forced to stay between {pendingRegenerateMin} and {pendingRegenerateMax} units.
                  </p>
                </div>
                <Switch checked={pendingStrictGuardrails} onCheckedChange={setPendingStrictGuardrails} />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 w-full sm:w-auto"
                  onClick={handleRegenerateImportClick}
                >
                  <Upload className="h-4 w-4" /> Import plan
                </Button>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  If you've exported a plan before, you can bring it back here.
                </span>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setRegenerateDialogOpen(false)
                    setPendingRegenerateStrategy(plannerStrategy)
                    setPendingStrictGuardrails(strictGuardrailsEnabled)
                    setRegeneratePreview(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleConfirmRegeneratePlan}
                  disabled={regeneratePreviewLoading || Boolean(regenerateCreditError)}
                >
                  Apply profile
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={creditPreviewDialogOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              handleCreditPreviewCancel()
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Review credit limit changes</DialogTitle>
              <DialogDescription>
                {creditPreview
                  ? `We'll enforce ${creditPreview.minCredits}–${creditPreview.maxCredits} units per term once you confirm.`
                  : "We'll save your updated credit preferences."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                {creditPreviewMoveCount > 0 ? (
                  <p>
                    <strong>{creditPreviewMoveCount}</strong> course{creditPreviewMoveCount === 1 ? "" : "s"} will shift to
                    stay within your preferred limits.
                  </p>
                ) : (
                  <p>No courses need to move—your current layout already satisfies the new limits.</p>
                )}
              </div>
              {creditPreviewMoveCount > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {creditPreviewMoves.map((move) => (
                      <li key={move.courseId} className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{move.code}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{move.name}</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{move.credits}u</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            {formatAcademicYear(move.fromYear)} {move.fromTerm}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span>
                            {formatAcademicYear(move.toYear)} {move.toTerm}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleCreditPreviewCancel}>
                Cancel
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleCreditPreviewConfirm}>
                Apply and Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(importSuccessInfo)} onOpenChange={(open) => !open && setImportSuccessInfo(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Plan Import Successful</DialogTitle>
              <DialogDescription>We applied the imported graduation plan to your workspace.</DialogDescription>
            </DialogHeader>
            {importSuccessInfo && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Added <strong>{importSuccessInfo.courses}</strong> course{importSuccessInfo.courses === 1 ? "" : "s"}
                  {" "}across <strong>{importSuccessInfo.semesters}</strong> semester
                  {importSuccessInfo.semesters === 1 ? "" : "s"}.
                </p>
                <p>You can continue refining the plan or export it for safekeeping.</p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setImportSuccessInfo(null)}>Continue Planning</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={conflictDialogOpen}
          onOpenChange={(open) => {
            setConflictDialogOpen(open)
            if (!open) {
              setConflictDetail(null)
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Conflict Details</DialogTitle>
              <DialogDescription>
                {conflictDetail?.title ?? "Review the reasons this item is flagged."}
              </DialogDescription>
            </DialogHeader>
            {conflictDetail ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {conflictDetail.conflicts.map((conflict, index) => (
                  <div
                    key={`${conflict.type}-${index}`}
                    className="rounded-md border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20 p-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Badge variant={conflict.severity === "error" ? "destructive" : "secondary"}>
                        {conflict.type}
                      </Badge>
                      <span
                        className={`text-xs ${
                          conflict.severity === "error"
                            ? "text-red-600 dark:text-red-300"
                            : "text-orange-600 dark:text-orange-300"
                        }`}
                      >
                        {conflict.severity === "error" ? "Error" : "Warning"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{conflict.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No conflict details available.</p>
            )}
            <DialogFooter>
              <Button onClick={() => setConflictDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(pendingPrereqShift)}
          onOpenChange={(open) => {
            if (!open) {
              cancelPrereqShiftMove()
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Move linked courses?</DialogTitle>
              <DialogDescription>
                Moving {pendingPrereqShiftCourse?.code ?? "this course"} to {pendingPrereqShift
                  ? `${formatAcademicYear(pendingPrereqShift.targetYear)} ${pendingPrereqShift.targetTerm}`
                  : "the selected term"} also keeps its lab/lecture partner and prerequisite-locked courses aligned.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              {pendingPrereqShiftPair && pendingPrereqShift && (
                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-medium">Lab + lecture stay together</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="text-sm font-semibold">{pendingPrereqShiftPair.code}</p>
                      <p className="text-muted-foreground">{pendingPrereqShiftPair.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-right text-muted-foreground">
                      <span>
                        {formatAcademicYear(pendingPrereqShiftPair.fromYear)} {pendingPrereqShiftPair.fromTerm}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-semibold">
                        {formatAcademicYear(pendingPrereqShift.targetYear)} {pendingPrereqShift.targetTerm}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    We'll move this paired component to the same term so the lecture and lab stay synchronized.
                  </p>
                </div>
              )}

              {pendingPrereqShiftHasDependents ? (
                <>
                  <p>
                    The following courses rely on {pendingPrereqShiftCourse?.code ?? "this course"} and will be moved to later
                    terms to keep prerequisites satisfied:
                  </p>
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {pendingPrereqShift?.adjustments.map((adjustment) => (
                      <li
                        key={adjustment.courseId}
                        className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div>
                          <p className="text-sm font-semibold">{adjustment.code}</p>
                          <p className="text-muted-foreground">{adjustment.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-right text-muted-foreground">
                          <span>
                            {formatAcademicYear(adjustment.fromYear)} {adjustment.fromTerm}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-semibold">
                            {formatAcademicYear(adjustment.toYear)} {adjustment.toTerm}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    You can fine-tune their placements after this automatic adjustment.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No prerequisite dependents need rescheduling. We'll simply keep the linked components together.
                </p>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={cancelPrereqShiftMove}>
                Cancel
              </Button>
              <Button className="w-full sm:w-auto" onClick={confirmPrereqShiftMove}>
                Move Courses
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(blockedMoveDialog)}
          onOpenChange={(open) => {
            if (!open) {
              setBlockedMoveDialog(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Cannot Move Before Prerequisites</DialogTitle>
              <DialogDescription>
                {blockedMoveDialog
                  ? `${blockedMoveDialog.courseCode} needs prerequisite clearance before ${formatAcademicYear(blockedMoveDialog.targetYear)} ${blockedMoveDialog.targetTerm}.`
                  : "Prerequisite requirements prevent this move."}
              </DialogDescription>
            </DialogHeader>
            {blockedMoveDialog && (
              <div className="space-y-3 text-sm">
                {blockedMoveDialog.blockers.map((blocker) => (
                  <div
                    key={blocker.courseId}
                    className="rounded-md border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-900/20"
                  >
                    <p className="text-sm font-semibold">{blocker.code}</p>
                    <p className="text-xs text-muted-foreground">{blocker.name}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {blocker.reason === "not_scheduled"
                        ? "This prerequisite is not scheduled or marked as passed yet. Schedule it at least one term earlier."
                        : blocker.scheduledYear && blocker.scheduledTerm
                          ? `Currently planned for ${formatAcademicYear(blocker.scheduledYear)} ${blocker.scheduledTerm}. It must stay at least one term before the requested move.`
                          : "This prerequisite needs to be completed earlier."}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setBlockedMoveDialog(null)}>Understood</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(creditGuardrailDialog)}
          onOpenChange={(open) => {
            if (!open) {
              setCreditGuardrailDialog(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Move Blocked by Credit Limits</DialogTitle>
              <DialogDescription>
                {creditGuardrailDialog
                  ? `Moving ${creditGuardrailDialog.courseCode} to ${formatAcademicYear(creditGuardrailDialog.targetYear)} ${creditGuardrailDialog.targetTerm} would violate your credit guardrails.`
                  : "Credit guardrails prevented this move."}
              </DialogDescription>
            </DialogHeader>
            {creditGuardrailDialog && (
              <div className="space-y-3 text-sm">
                {creditGuardrailDialog.reasons.map((reason, index) => (
                  <div
                    key={`${reason.type}-${index}`}
                    className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="text-sm font-semibold">{reason.semesterLabel}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {reason.type === "min"
                        ? `Credits would drop to ${reason.credits}, below your minimum target of ${reason.threshold}.`
                        : `Credits would rise to ${reason.credits}, above your maximum limit of ${reason.threshold}.`}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Adjust the credit guardrails or shuffle additional courses so each term stays within your preferred range.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setCreditGuardrailDialog(null)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        <Dialog open={Boolean(regenerateToast)} onOpenChange={(open) => !open && setRegenerateToast(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Plan regenerated</DialogTitle>
              {regenerateToast && (
                <DialogDescription className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                    {REGENERATE_STRATEGY_META[regenerateToast.strategy].title}
                  </span>
                  <span>
                    Profile focus: {REGENERATE_STRATEGY_META[regenerateToast.strategy].tagline}.
                  </span>
                  <span>
                    Target load: {regenerateToast.min}-{regenerateToast.max}u. {regenerateToast.strict
                      ? "Strict guardrails kept every feasible term within that range."
                      : "Flexible guardrails allowed small shifts to satisfy prerequisites."}
                  </span>
                </DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setRegenerateToast(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            <Card className="mb-6" ref={graduationSummaryRef}>
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
            <Card id="planner-period-controls" className="mb-6">
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
                    <Button onClick={openRegeneratePlanDialog}>Regenerate Plan</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

              {/* Credit Load Preferences */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Credit Load Preferences
                  </CardTitle>
                  <CardDescription>Adjust the per-term credit targets used for warnings and scheduling hints.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Minimum credits per term</label>
                      <Input
                        type="number"
                        min={0}
                        max={29}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={draftMinCreditsPerTerm}
                        onChange={(e) => handleMinCreditsChange(Number.parseInt(e.target.value, 10))}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Internship-only terms ignore this floor, but other terms will warn when they fall below it.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Maximum credits per term</label>
                      <Input
                        type="number"
                        min={0}
                        max={29}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={draftMaxCreditsPerTerm}
                        onChange={(e) => handleMaxCreditsChange(Number.parseInt(e.target.value, 10))}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        We still block extreme overloads once you exceed {effectiveMaxCreditsWithOverflow} credits ({effectiveMaxCreditsPerTerm} target + {ALLOW_OVERFLOW_UNITS} overflow).
                      </p>
                      {isMaxCreditsAtOrBelowMin && (
                        <p className="mt-2 rounded-md border border-amber-300/60 bg-amber-50/80 p-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                          Maximum credits must be greater than {draftMinCreditsPerTerm} to apply. Until then, the planner will fall back to the default limit of {RECOMMENDED_UNITS_MAX} credits ({effectiveMaxCreditsWithOverflow} with overflow).
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <p className="flex-1">These preferences save locally so different programs can tailor their limits.</p>
                    {creditSaveMessage && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{creditSaveMessage}</span>
                    )}
                    <Button
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => handleSaveCreditPreferences()}
                      disabled={!creditLimitsDirty}
                    >
                      <Save className="h-4 w-4" />
                      Save preferences
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={resetCreditLimitPreferences}
                    >
                      <Undo className="h-4 w-4" />
                      Reset to defaults
                    </Button>
                  </div>
                </CardContent>
              </Card>

            {/* Action Buttons */}
            <div ref={setPlanActionsRef} className="mb-6">
              <Card>
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
                        <DialogTitle>
                          {pendingAdd?.reason === "petition" ? "Confirm Petition Add" : "Confirm Overload"}
                        </DialogTitle>
                        {pendingAdd?.reason === "petition" ? (
                          <DialogDescription>
                            This course currently has no available sections and may require a petition. Do you want to
                            add it to the current term?
                          </DialogDescription>
                        ) : (
                          <DialogDescription>
                            You're attempting to add a non-internship course into a term reserved for internships.
                            This is considered an overload and may affect your graduation timeline. Do you want to
                            continue?
                          </DialogDescription>
                        )}
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
            </div>

            {/* Unscheduled Courses - moved here for better visibility */}
            {(() => {
              const unscheduledCourses = getUnscheduledCourses()
              if (unscheduledCourses.length === 0) return null
              const visibleCourses = showAllUnscheduled ? unscheduledCourses : unscheduledCourses.slice(0, 5)
              const hiddenCount = unscheduledCourses.length - visibleCourses.length

              return (
                <div ref={setUnscheduledCoursesRef} className="mb-6">
                  <h2 className="text-2xl font-bold mb-4">Unscheduled Courses</h2>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Courses Not Yet Scheduled
                      </CardTitle>
                      <CardDescription>
                        These courses are marked as pending or active but are not currently placed in any semester of
                        your graduation plan.
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
                            <TableHead>Priority</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleCourses.map((course) => {
                            const allPrereqsMet = arePrerequisitesMet(course)
                            const { available: availableTerms, blocked: blockedTerms } = getTermMoveOptions(course)

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
                                    <Badge variant="outline">May Need Petition</Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    >
                                      {course.availableSections.length} sections
                                    </Badge>
                                  )}
                                </TableCell>
                                {/* Priority for unscheduled courses */}
                                <TableCell>
                                  <Select
                                    value={(coursePriorities[course.id] || "medium") as string}
                                    onValueChange={(value) =>
                                      setCoursePriority(course.id, value as keyof typeof PRIORITY_WEIGHTS)
                                    }
                                  >
                                    <SelectTrigger className="w-28">
                                      <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select onValueChange={(value) => handleAddCourseSelectChange(course.id, value)}>
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
                                      {blockedTerms.length > 0 && (
                                        <>
                                          <SelectSeparator />
                                          <SelectGroup>
                                            <div className="pl-3 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                                              Blocked by prerequisites
                                            </div>
                                            {blockedTerms.map((term) => (
                                              <SelectItem
                                                key={`blocked-${term.year}-${term.term}`}
                                                value={`blocked|${term.year}|${term.term}`}
                                              >
                                                <div className="flex flex-col gap-0.5 text-left">
                                                  <span className="flex items-center gap-2 text-sm">
                                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                    {term.label}
                                                  </span>
                                                  <span className="text-xs text-muted-foreground">
                                                    Waiting on {summarizeBlockerCodes(term.blockers)}
                                                  </span>
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>

                      {hiddenCount > 0 && (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          {hiddenCount === 1
                            ? "1 additional course hidden"
                            : `${hiddenCount} additional courses hidden`}
                        </p>
                      )}

                      {unscheduledCourses.length > 5 && (
                        <div className="mt-4 flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllUnscheduled((prev) => !prev)}
                            className="gap-2"
                          >
                            {showAllUnscheduled ? "Show Less" : `Show All (${unscheduledCourses.length})`}
                          </Button>
                        </div>
                      )}

                      {unscheduledCourses.some((course) => !arePrerequisitesMet(course)) && (
                        <Alert className="mt-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                          <Info className="h-4 w-4" />
                          <AlertTitle>Prerequisites Not Met</AlertTitle>
                          <AlertDescription>
                            Some unscheduled courses have prerequisites that are not yet completed. Make sure to
                            complete the prerequisites before scheduling these courses.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            })()}

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
                    const semesterIsCurrent = isCurrentSemester(semester.year, semester.term)
                    const coursesNeedingPetition = semester.courses.filter((course) => course.needsPetition)
                    const semesterCoursesSelected = semester.courses.filter((course) => selectedCourses.has(course.id))
                    const allSemesterCoursesSelected = semesterCoursesSelected.length === semester.courses.length
                    const semesterCredits = semester.courses.reduce((sum, course) => sum + course.credits, 0)
                    const relevantConflictsForSemester = conflicts.filter((conflict) =>
                      conflict.affectedCourses.some((courseId) =>
                        semester.courses.some((course) => course.id === courseId),
                      ),
                    )
                    const hasConflicts = relevantConflictsForSemester.length > 0
                    const hasInternship = semester.courses.some((course) => isInternshipCourse(course))

                    return (
                      <Collapsible
                        key={semesterKey}
                        open={isOpen}
                        onOpenChange={(open) => toggleSemester(semester.year, semester.term, open)}
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
                                (semesterCredits > effectiveMaxCreditsPerTerm || (semesterCredits < minCreditsPerTerm && !hasInternship))
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
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  openConflictDialog(
                                    `${formatAcademicYear(semester.year)} ${semester.term}`,
                                    relevantConflictsForSemester,
                                  )
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " " || event.key === "Space") {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    openConflictDialog(
                                      `${formatAcademicYear(semester.year)} ${semester.term}`,
                                      relevantConflictsForSemester,
                                    )
                                  }
                                }}
                                aria-label={`View conflicts for ${formatAcademicYear(semester.year)} ${semester.term}`}
                                className="inline-flex"
                              >
                                <Badge variant="destructive" className="cursor-pointer select-none">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {`Conflicts (${relevantConflictsForSemester.length})`}
                                </Badge>
                              </span>
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
                                  {semesterIsCurrent ? (
                                    <>
                                      <TableHead>Section</TableHead>
                                      <TableHead>Schedule</TableHead>
                                      <TableHead>Room</TableHead>
                                    </>
                                  ) : (
                                    <>
                                      <TableHead>Prerequisite Courses</TableHead>
                                      <TableHead>Required For Courses</TableHead>
                                    </>
                                  )}
                                  <TableHead>Status</TableHead>
                                  <TableHead>Priority</TableHead>
                                  <TableHead>Lock</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {semester.courses.map((course, _idx) => {
                                  const prereqCourses = course.prerequisites
                                    .map((id) => findCourseById(id))
                                    .filter((c): c is Course => c !== undefined)

                                  const allPrereqsMet = arePrerequisitesMet(course)
                                  const requiredForCourses = dependentCoursesMap.get(course.id) ?? []
                                  const section = course.recommendedSection
                                  const availableSections = course.availableSections
                                  const { available: availableTerms, blocked: blockedTerms } = getTermMoveOptions(course)
                                  const isSelected = selectedCourses.has(course.id)
                                  const hasConflict = conflicts.some((conflict) =>
                                    conflict.affectedCourses.includes(course.id),
                                  )
                                  const courseConflictEntries = hasConflict
                                    ? conflicts.filter((conflict) => conflict.affectedCourses.includes(course.id))
                                    : []
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
                                          {hasConflict && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                              type="button"
                                              onClick={() =>
                                                openConflictDialog(
                                                  `${course.code} • ${formatAcademicYear(semester.year)} ${semester.term}`,
                                                  courseConflictEntries,
                                                )
                                              }
                                              aria-label={`View conflicts for ${course.code}`}
                                            >
                                              <AlertTriangle className="h-3 w-3" />
                                            </Button>
                                          )}
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
                                      {semesterIsCurrent ? (
                                        <>
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
                                        </>
                                      ) : (
                                        <>
                                          <TableCell>
                                            {renderCourseListBadges(prereqCourses, "No prerequisites")}
                                          </TableCell>
                                          <TableCell>
                                            {renderCourseListBadges(requiredForCourses, "No dependent courses")}
                                          </TableCell>
                                        </>
                                      )}
                                      <TableCell>
                                        {course.needsPetition ? (
                                          (semester.year === currentYear && termsMatch(semester.term, currentTerm)) ? (
                                            <Badge variant="destructive">Needs Petition</Badge>
                                          ) : (
                                            <Badge variant="outline">May Need Petition</Badge>
                                          )
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
                                      {/* Priority (per-course) */}
                                      <TableCell>
                                        <Select
                                          value={(coursePriorities[course.id] || "medium") as string}
                                          onValueChange={(value) => setCoursePriority(course.id, value as keyof typeof PRIORITY_WEIGHTS)}
                                        >
                                          <SelectTrigger className="w-28">
                                            <SelectValue placeholder="Priority" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="low">Low</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      {/* Lock to this term */}
                                      <TableCell>
                                        {(() => {
                                          const locked =
                                            !!lockedPlacements[course.id] &&
                                            lockedPlacements[course.id].year === semester.year &&
                                            termsMatch(lockedPlacements[course.id].term, semester.term)
                                          return (
                                            <Button
                                              variant={locked ? "default" : "outline"}
                                              size="sm"
                                              onClick={() => toggleCourseLock(course.id, semester.year, semester.term)}
                                              title={locked ? "Unlock from this term" : "Lock to this term"}
                                              className="flex items-center gap-1"
                                            >
                                              {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                              {locked ? "Locked" : "Unlock"}
                                            </Button>
                                          )
                                        })()}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Select
                                            key={`${course.id}-${moveSelectResetCounter}`}
                                            onValueChange={(value) => handleMoveSelectChange(course.id, value)}
                                          >
                                            <SelectTrigger className="w-40">
                                              <SelectValue placeholder="Move to..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {availableTerms
                                                .filter(
                                                  (term) =>
                                                    !(term.year === semester.year && termsMatch(term.term, semester.term)),
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
                                              {blockedTerms.length > 0 && (
                                                <>
                                                  <SelectSeparator />
                                                  <SelectGroup>
                                                    <div className="pl-3 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                                                      Blocked by prerequisites
                                                    </div>
                                                    {blockedTerms.map((term) => (
                                                      <SelectItem
                                                        key={`blocked-${term.year}-${term.term}`}
                                                        value={`blocked|${term.year}|${term.term}`}
                                                      >
                                                        <div className="flex flex-col gap-0.5 text-left">
                                                          <span className="flex items-center gap-2 text-sm">
                                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                            {term.label}
                                                          </span>
                                                          <span className="text-xs text-muted-foreground">
                                                            Waiting on {summarizeBlockerCodes(term.blockers)}
                                                          </span>
                                                        </div>
                                                      </SelectItem>
                                                    ))}
                                                  </SelectGroup>
                                                </>
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>

                            {semester.year === currentYear && termsMatch(semester.term, currentTerm) &&
                              semester.courses.some((course) => course.needsPetition) && (
                                <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                                  <FileWarning className="h-4 w-4" />
                                  <AlertTitle>Petition Required</AlertTitle>
                                  <AlertDescription>
                                    One or more courses in the current term do not have available sections and may require a petition.
                                    Please coordinate with the department for possible arrangements.
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

            {/* Floating Controls */}
            {floatingControlsVisible && (
              <div
                className={cn(
                  "fixed z-50 transition-all duration-300 transform",
                  isMobile
                    ? "bottom-20 left-4 right-4 flex flex-col items-stretch gap-3"
                    : "bottom-24 right-6 flex flex-col-reverse items-end gap-4",
                  floatingControlsEntering
                    ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                    : "opacity-0 translate-y-4 scale-95 pointer-events-none"
                )}
              >
                {planActionsFloatingVisible && (
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 transform",
                      isMobile ? "w-full" : planActionsCollapsed ? "w-56 sm:w-64" : "w-72 sm:w-80",
                      planActionsFloatingEntering
                        ? "opacity-100 translate-y-0 scale-100 max-h-[480px] pointer-events-auto"
                        : "opacity-0 translate-y-2 scale-95 max-h-0 pointer-events-none"
                    )}
                  >
                    <Card className="w-full shadow-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900">
                      <CardHeader
                        className={cn(
                          planActionsCollapsed && isMobile
                            ? "flex flex-col items-center gap-2 p-3"
                            : planActionsCollapsed
                            ? "flex-row items-center justify-between space-y-0 p-3"
                            : "space-y-1.5 p-6 pb-3"
                        )}
                      >
                        <CardTitle
                          className={cn(
                            "flex items-center text-sm w-full",
                            planActionsCollapsed && isMobile ? "justify-center" : "justify-between"
                          )}
                        >
                          {planActionsCollapsed && isMobile ? (
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              <Move className="h-4 w-4" />
                              {getUnscheduledCourses().length > 0
                                ? "View Plan Actions & Unscheduled"
                                : "View Plan Actions"}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Move className="h-4 w-4" />
                              Plan Actions
                            </div>
                          )}
                          {!(planActionsCollapsed && isMobile) && renderPlanActionControls(!planActionsCollapsed)}
                        </CardTitle>
                        {planActionsCollapsed && isMobile && renderPlanActionControls(false)}
                        {!planActionsCollapsed && (
                          <CardDescription className="text-xs text-gray-500 dark:text-gray-400">
                            Key planner shortcuts when the full toolbar is out of view.
                          </CardDescription>
                        )}
                      </CardHeader>
                      {!planActionsCollapsed && (
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              className="w-full justify-start gap-2"
                              onClick={openRegeneratePlanDialog}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Regenerate Plan
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 gap-2"
                                onClick={() => setExportDialogOpen(true)}
                              >
                                <Download className="h-3 w-3" />
                                Export Plan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-2"
                                onClick={() => setImportDialogOpen(true)}
                              >
                                <Upload className="h-3 w-3" />
                                Import Plan
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2"
                              onClick={() => setSwapDialogOpen(true)}
                            >
                              <ArrowUpDown className="h-3 w-3" />
                              Swap Courses
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2"
                              onClick={undoLastMove}
                              disabled={moveHistory.length === 0}
                            >
                              <Undo className="h-3 w-3" />
                              Undo Last Move
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2"
                              onClick={() => setHistoryDialogOpen(true)}
                            >
                              <History className="h-3 w-3" />
                              Move History ({moveHistory.length})
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full text-xs"
                              onClick={() => planActionsRef?.scrollIntoView({ behavior: "smooth" })}
                            >
                              Jump to full plan actions
                            </Button>
                            {isMobile && getUnscheduledCourses().length > 0 && (
                              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  <span>Unscheduled Courses</span>
                                  <span>{getUnscheduledCourses().length}</span>
                                </div>
                                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
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
                              </div>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                )}

                {!isMobile && unscheduledFloatingVisible && (
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 transform",
                      unscheduledCollapsed ? "w-56 sm:w-64" : "w-72 sm:w-80",
                      unscheduledFloatingEntering
                        ? "opacity-100 translate-y-0 scale-100 max-h-[420px] pointer-events-auto"
                        : "opacity-0 translate-y-2 scale-95 max-h-0 pointer-events-none"
                    )}
                  >
                    <Card className="w-full shadow-lg border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
                      <CardHeader
                        className={cn(
                          unscheduledCollapsed
                            ? "flex-row items-center justify-between space-y-0 p-3"
                            : "space-y-1.5 p-6 pb-3"
                        )}
                      >
                        <CardTitle className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Unscheduled Courses ({getUnscheduledCourses().length})
                          </div>
                          <div className="flex items-center gap-1">
                            {!unscheduledCollapsed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  unscheduledCoursesRef?.scrollIntoView({ behavior: "smooth" })
                                }}
                                className="h-6 w-6 p-0"
                                aria-label="Jump to unscheduled courses"
                              >
                                <ArrowUpDown className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setUnscheduledCollapsed((prev) => !prev)}
                              aria-label={unscheduledCollapsed ? "Expand unscheduled courses" : "Collapse unscheduled courses"}
                            >
                              {unscheduledCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      {!unscheduledCollapsed && (
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
                      )}
                    </Card>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {showJumpButton && !isBottomNavVisible && (
                <motion.div
                  key="academic-planner-floating-back-to-top"
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="pointer-events-none fixed bottom-4 right-32 z-[10000] sm:bottom-6 sm:right-40"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto shadow-lg shadow-slate-500/30"
                    onClick={scrollToPageTop}
                    aria-label="Back to top"
                  >
                    <ArrowUp className="h-4 w-4" />
                    Back to top
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Navigation */}
            <div className="mt-10 mb-6" ref={bottomNavigationRef}>
              <QuickNavigation showBackToTop />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
