"use client"

import React from "react"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
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
  ArrowUp,
  ArrowRight,
  Table,
  Grid3X3,
  GraduationCap,
  RefreshCw,
  Plus,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { CircularProgress } from "@/components/ui/circular-progress"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { saveCourseStatuses, loadCourseStatuses, saveTrackerPreferences, loadTrackerPreferences } from "@/lib/course-storage"
import {
  initialCourses,
  registerExternalCourses,
  registerCourseCodeAliases,
  getAliasesForCanonical,
  resolveCanonicalCourseCode,
} from "@/lib/course-data"
import { parseCurriculumHtml } from "@/lib/curriculum-import"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import NonCpeNotice from "@/components/non-cpe-notice"
import FeedbackDialog from "@/components/feedback-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { orderedPatchNotes } from "@/lib/patch-notes"

const APP_VERSION = orderedPatchNotes[0]?.version ?? "Dev"

// --- Types and Interfaces ---

// Course status types
type CourseStatus = "passed" | "active" | "pending"

type TermName = "Term 1" | "Term 2" | "Term 3"

interface LastTakenInfo {
  year: number
  term: TermName
}

interface GradeAttempt {
  id: string
  year: number
  term: TermName
  grade: string
  recordedAt: string
}

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
  lastTaken?: LastTakenInfo | null
  gradeAttempts?: GradeAttempt[]
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
  onAddAliases: (aliases: Record<string, string>) => void
  courseCodeAliases: Record<string, string | { canonical: string; displayAlias?: boolean }>
  onRemoveAlias: (legacyCode: string) => void
  onToggleAliasDisplay: (legacyCode: string, displayAlias: boolean) => void
  getDisplayCode: (code: string) => string
}

interface OverallProgressProps {
  overallProgress: ProgressStats
  showDetailedProgress: boolean
  setShowDetailedProgress: (b: boolean) => void
  progressByYear: { [key: number]: ProgressStats }
  progressByTerm: { [key: number]: { [term: string]: ProgressStats } }
  courses: Course[]
  isFloating: boolean
}

interface SaveLoadControlsProps {
  saveProgress: () => void
  downloadProgress: () => void
  saveMessage: string | null
  triggerUploadDialog: () => void
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>
  setSaveMessage: (m: string | null) => void
}

interface AcademicTimelineProps {
  startYear: number
  handleStartYearChange: (v: string | React.ChangeEvent<HTMLInputElement>) => void
  academicYears: AcademicYear[]
  currentYearLevel: number
  onCurrentYearLevelChange: (value: number) => void
  currentTerm: TermName
  onCurrentTermChange: (term: TermName) => void
  yearLevelOptions: number[]
  onExtendYearOptions: () => void
}

interface YearTermOption {
  year: number
  term: TermName
}

interface GradeModalFormState {
  year: number | null
  term: TermName | null
  grade: string
}

interface TranscriptEntry {
  id: string
  courseCode: string
  courseName: string
  units: number
  year: number
  term: TermName
  grade: string
}

interface PrereqCascadeNode {
  course: Course
  requiredStatus: CourseStatus
  willChange: boolean
  nextStatus: CourseStatus | null
  children: PrereqCascadeNode[]
}

interface PrerequisiteDialogState {
  course: Course
  targetStatus: CourseStatus
  cascadeTree: PrereqCascadeNode[]
  overrides: Record<string, CourseStatus>
  stats: { total: number; toUpdate: number }
  dependentRollbacks: Record<string, CourseStatus>
}

interface DependentRollbackPreview {
  course: Course
  nextStatus: CourseStatus
}

interface DependentRollbackDialogState {
  course: Course
  targetStatus: CourseStatus
  overrides: Record<string, CourseStatus>
  affectedCourses: DependentRollbackPreview[]
}

interface PendingPassDowngrade {
  courseId: string
  targetAttempt: { year: number; term: TermName; grade: string }
  downgradeAttempts: GradeAttempt[]
  futureRemovals: GradeAttempt[]
  updateLastTaken: boolean
  source: "table" | "modal"
}

interface TrackerPreferences {
  startYear: number
  currentYearLevel: number
  currentTerm: TermName
}

const PASSING_GRADE_VALUES: ReadonlyArray<string> = [
  "1.0",
  "1.5",
  "2.0",
  "2.5",
  "3.0",
  "3.5",
  "4.0",
  "8.0",
]

const FAIL_GRADE_VALUES: ReadonlyArray<string> = ["0.0", "0.5", "7.0", "9.0"]
const ACCEPTABLE_GRADE_VALUES: ReadonlyArray<string> = [...FAIL_GRADE_VALUES, ...PASSING_GRADE_VALUES]
const DOWNGRADE_FAIL_GRADE = "0.5"

const PREREQ_TARGET_STATUS: Record<CourseStatus, CourseStatus | null> = {
  passed: "passed",
  active: "passed",
  pending: null,
}

const shouldUpgradeStatus = (current: CourseStatus, required: CourseStatus): boolean => {
  if (required === "passed") {
    return current !== "passed"
  }
  if (required === "active") {
    return current === "pending"
  }
  return false
}

const buildCascadeNodes = (
  sourceCourse: Course,
  requiredStatus: CourseStatus,
  resolver: (id: string) => Course | undefined,
  visited: Set<string>,
): PrereqCascadeNode[] => {
  const prereqIds = Array.isArray(sourceCourse.prerequisites) ? sourceCourse.prerequisites : []
  const nodes: PrereqCascadeNode[] = []

  prereqIds.forEach((prereqId) => {
    if (!prereqId || visited.has(prereqId)) return
    const prereqCourse = resolver(prereqId)
    if (!prereqCourse) return

    visited.add(prereqId)
    const childNodes = buildCascadeNodes(prereqCourse, requiredStatus, resolver, visited)
    visited.delete(prereqId)

    const willChange = shouldUpgradeStatus(prereqCourse.status, requiredStatus)
    const nodeShouldExist = willChange || childNodes.length > 0
    if (!nodeShouldExist) return

    nodes.push({
      course: prereqCourse,
      requiredStatus,
      willChange,
      nextStatus: willChange ? requiredStatus : null,
      children: childNodes,
    })
  })

  return nodes
}

const flattenCascadeOverrides = (nodes: PrereqCascadeNode[]): Record<string, CourseStatus> => {
  const overrides: Record<string, CourseStatus> = {}
  const walk = (node: PrereqCascadeNode) => {
    if (node.willChange && node.nextStatus) {
      overrides[node.course.id] = node.nextStatus
    }
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return overrides
}

const summarizeCascadeNodes = (nodes: PrereqCascadeNode[]) => {
  let total = 0
  let toUpdate = 0
  const walk = (node: PrereqCascadeNode) => {
    total += 1
    if (node.willChange && node.nextStatus) {
      toUpdate += 1
    }
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return { total, toUpdate }
}

const buildDependentDowngradeOverrides = (
  course: Course,
  newStatus: CourseStatus,
  dependentMap: DependentCoursesMap,
  resolver: (id: string) => Course | undefined,
): Record<string, CourseStatus> => {
  if (newStatus === "passed") return {}
  if (course.status !== "passed") return {}
  if (dependentMap.size === 0) return {}

  const overrides: Record<string, CourseStatus> = {}
  const queue: string[] = [course.id]
  const processed = new Set<string>()
  const affected = new Set<string>([course.id])

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (processed.has(currentId)) continue
    processed.add(currentId)

    const dependents = dependentMap.get(currentId) ?? []
    dependents.forEach((dependentCourse) => {
      const prereqIds = Array.isArray(dependentCourse.prerequisites) ? dependentCourse.prerequisites : []
      const prerequisitesSatisfied = prereqIds.every((prereqId) => {
        if (affected.has(prereqId)) return false
        const prereqCourse = resolver(prereqId)
        if (!prereqCourse) return false
        return prereqCourse.status === "passed"
      })

      if (!prerequisitesSatisfied) {
        if (dependentCourse.status !== "pending") {
          overrides[dependentCourse.id] = "pending"
        }
        if (!affected.has(dependentCourse.id)) {
          affected.add(dependentCourse.id)
        }
        if (!processed.has(dependentCourse.id)) {
          queue.push(dependentCourse.id)
        }
      }
    })
  }

  return overrides
}

const renderCascadeTree = (nodes: PrereqCascadeNode[], depth = 0): React.ReactNode => {
  if (!nodes.length) return null

  return nodes.map((node) => {
    const { course, children, willChange, nextStatus, requiredStatus } = node
    const key = `${course.id}-${depth}`
    const nextStatusClasses =
      nextStatus === "passed"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
        : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"

    return (
      <div key={key} className="space-y-2">
        <div className="rounded-md border border-slate-200/70 bg-white/70 p-3 text-sm shadow-sm dark:border-slate-700/60 dark:bg-slate-900/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{course.code}</p>
              <p className="text-xs text-muted-foreground">{course.name}</p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Badge variant="secondary">{formatStatusLabel(course.status)}</Badge>
              {willChange && nextStatus ? (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="outline" className={nextStatusClasses}>
                    {formatStatusLabel(nextStatus)}
                  </Badge>
                </>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Already {formatStatusLabel(requiredStatus)}
                </Badge>
              )}
            </div>
          </div>
          {!willChange && (
            <p className="mt-1 text-xs text-muted-foreground">
              No change needed for this course, but its prerequisites below still need updates.
            </p>
          )}
        </div>
        {children.length > 0 && (
          <div className="ml-4 border-l border-dashed border-slate-200 pl-4 dark:border-slate-700">
            {renderCascadeTree(children, depth + 1)}
          </div>
        )}
      </div>
    )
  })
}

const formatStatusLabel = (status: CourseStatus): string => {
  switch (status) {
    case "passed":
      return "Passed"
    case "active":
      return "Active"
    default:
      return "Pending"
  }
}

const GRADE_LABELS: Record<string, string> = {
  "0.0": "Excessive Absence",
  "0.5": "Fail",
  "1.0": "Passed (Barely Passing)",
  "1.5": "Passed (Fair)",
  "2.0": "Passed (Satisfactory)",
  "2.5": "Passed (Good)",
  "3.0": "Passed (Very Good)",
  "3.5": "Passed (Superior)",
  "4.0": "Passed (Excellent)",
  "7.0": "Officially Dropped",
  "8.0": "Credited (Transferee)",
  "9.0": "Incomplete Grade",
}

const ALL_GRADE_OPTIONS = ACCEPTABLE_GRADE_VALUES.map((value) => ({
  value,
  label: `${value} — ${GRADE_LABELS[value] ?? ""}`.trim(),
}))

const FAIL_GRADE_OPTIONS = FAIL_GRADE_VALUES.map((value) => ({
  value,
  label: `${value} — ${GRADE_LABELS[value] ?? ""}`.trim(),
}))

const TERM_SEQUENCE: TermName[] = ["Term 1", "Term 2", "Term 3"]

const sanitizeTermName = (term?: string | null): TermName => {
  if (!term) return "Term 1"
  return TERM_SEQUENCE.includes(term as TermName) ? (term as TermName) : "Term 1"
}

const termIndex = (term: TermName) => TERM_SEQUENCE.indexOf(term)

const compareYearTerm = (aYear: number, aTerm: TermName, bYear: number, bTerm: TermName) => {
  if (aYear !== bYear) return aYear - bYear
  return termIndex(aTerm) - termIndex(bTerm)
}

const nextYearTerm = (year: number, term: TermName): YearTermOption => {
  const currentIndex = termIndex(term)
  if (currentIndex === -1) return { year, term: "Term 1" }
  const isLastTerm = currentIndex === TERM_SEQUENCE.length - 1
  return {
    year: isLastTerm ? year + 1 : year,
    term: TERM_SEQUENCE[isLastTerm ? 0 : currentIndex + 1],
  }
}

const isYearTermBeforeOrEqual = (candidate: YearTermOption, limit: YearTermOption) => {
  return compareYearTerm(candidate.year, candidate.term, limit.year, limit.term) <= 0
}

const generateAttemptId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const sanitizeGradeAttempts = (attempts?: GradeAttempt[]): GradeAttempt[] => {
  if (!Array.isArray(attempts)) return []
  return attempts
    .map((attempt) => {
      if (typeof attempt?.year !== "number" || !attempt?.term) return null
      const normalizedGrade = normalizeGradeValue(attempt.grade)
      if (!normalizedGrade) return null
      return {
        id: attempt?.id || generateAttemptId(),
        year: attempt.year,
        term: sanitizeTermName(attempt.term as string),
        grade: normalizedGrade,
        recordedAt: attempt.recordedAt || new Date().toISOString(),
      }
    })
    .filter((attempt): attempt is GradeAttempt => attempt !== null)
    .sort((a, b) => compareYearTerm(a.year, a.term, b.year, b.term))
}

const hydrateCourses = (rawCourses: Course[]): Course[] => {
  if (!Array.isArray(rawCourses)) return []
  return rawCourses.map((course) => ({
    ...course,
    lastTaken: course.lastTaken
      ? {
          year: course.lastTaken.year,
          term: sanitizeTermName(course.lastTaken.term as string),
        }
      : null,
    gradeAttempts: sanitizeGradeAttempts(course.gradeAttempts),
  }))
}

const buildYearTermOptions = (
  course: Course,
  currentYearLevel: number,
  currentTerm: TermName,
  allCourses?: Course[],
): YearTermOption[] => {
  const prerequisites = Array.isArray(course.prerequisites) ? course.prerequisites : []
  const hasPrerequisites = prerequisites.length > 0
  let startYear = hasPrerequisites ? course.year : 1
  let startTerm: TermName = hasPrerequisites ? sanitizeTermName(course.term as string) : "Term 1"

  if (hasPrerequisites && allCourses && allCourses.length > 0) {
    const prerequisiteCourses = prerequisites
      .map((prereqId) => allCourses.find((candidate) => candidate.id === prereqId))
      .filter((course): course is Course => Boolean(course))

    if (prerequisiteCourses.length !== prerequisites.length) {
      return []
    }

    const completedPrereqInfos = prerequisiteCourses
      .map((prereqCourse) => {
        const latestPassingAttempt = getLatestPassingAttempt(prereqCourse)
        if (latestPassingAttempt) {
          return { year: latestPassingAttempt.year, term: latestPassingAttempt.term } as LastTakenInfo
        }

        if (prereqCourse.status === "passed" && prereqCourse.lastTaken) {
          const attemptForLastTaken = findAttemptForYearTerm(
            prereqCourse,
            prereqCourse.lastTaken.year,
            prereqCourse.lastTaken.term,
          )
          if (!attemptForLastTaken || isPassingGrade(attemptForLastTaken.grade)) {
            return prereqCourse.lastTaken
          }
        }

        return null
      })
      .filter((info): info is LastTakenInfo => Boolean(info))

    if (completedPrereqInfos.length === prerequisites.length) {
      const latestPrereqCompletion = completedPrereqInfos.sort((a, b) =>
        compareYearTerm(b.year, b.term, a.year, a.term),
      )[0]
      if (latestPrereqCompletion) {
        const unlockPoint = nextYearTerm(latestPrereqCompletion.year, latestPrereqCompletion.term)
        startYear = unlockPoint.year
        startTerm = unlockPoint.term
      }
    } else {
      return []
    }
  }

  if (currentYearLevel < startYear) return []

  const limitOption: YearTermOption = { year: currentYearLevel, term: currentTerm }
  const options: YearTermOption[] = []
  for (let year = startYear; year <= currentYearLevel; year++) {
    for (const term of TERM_SEQUENCE) {
      if (year === startYear && compareYearTerm(year, term, startYear, startTerm) < 0) continue
      const candidate = { year, term }
      if (!isYearTermBeforeOrEqual(candidate, limitOption)) continue
      options.push(candidate)
    }
  }
  return options
}

const getGradeAttempts = (course: Course): GradeAttempt[] => course.gradeAttempts ?? []

const findAttemptForYearTerm = (course: Course, year: number, term: TermName) => {
  return getGradeAttempts(course).find((attempt) => attempt.year === year && attempt.term === term)
}

const isPassingGrade = (grade?: string | null) => (grade ? PASSING_GRADE_VALUES.includes(grade) : false)
const isAcceptableGrade = (grade?: string | null) => (grade ? ACCEPTABLE_GRADE_VALUES.includes(grade) : false)

const normalizeGradeValue = (grade: unknown): string | null => {
  if (grade === null || grade === undefined) return null
  let candidate: string
  if (typeof grade === "number") {
    candidate = grade === 9 ? "9.0" : grade.toFixed(1)
  } else if (typeof grade === "string") {
    const trimmed = grade.trim()
    if (!trimmed) return null
    const parsed = Number.parseFloat(trimmed)
    if (Number.isFinite(parsed)) {
      candidate = parsed === 9 ? "9.0" : parsed.toFixed(1)
    } else {
      candidate = trimmed
    }
  } else {
    return null
  }

  return isAcceptableGrade(candidate) ? candidate : null
}

const getLatestPassingAttempt = (course: Course): GradeAttempt | null => {
  return (
    getGradeAttempts(course)
      .filter((attempt) => isPassingGrade(attempt.grade))
      .sort((a, b) => compareYearTerm(b.year, b.term, a.year, a.term))[0] || null
  )
}

const getPassingAttemptsBeforeYearTerm = (course: Course, year: number, term: TermName): GradeAttempt[] => {
  return getGradeAttempts(course)
    .filter((attempt) => isPassingGrade(attempt.grade) && compareYearTerm(attempt.year, attempt.term, year, term) < 0)
    .sort((a, b) => compareYearTerm(a.year, a.term, b.year, b.term))
}

const getAttemptsAfterYearTerm = (course: Course, year: number, term: TermName): GradeAttempt[] => {
  return getGradeAttempts(course)
    .filter((attempt) => compareYearTerm(attempt.year, attempt.term, year, term) > 0)
    .sort((a, b) => compareYearTerm(a.year, a.term, b.year, b.term))
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

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
      className="rounded-full border-slate-300 bg-white/80 text-foreground hover:bg-white dark:border-white/40 dark:bg-white/10 dark:hover:bg-white/20"
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
  onAddAliases,
  courseCodeAliases,
  onRemoveAlias,
  onToggleAliasDisplay,
  getDisplayCode,
}: FilterAndSearchControlsProps) => {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Course[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [aliasForm, setAliasForm] = useState({ alias: "", canonical: "" })
  const [aliasError, setAliasError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAlias, setPendingAlias] = useState<{ alias: string; canonical: string } | null>(null)
  const [missingAliasDialogOpen, setMissingAliasDialogOpen] = useState(false)
  const [aliasListOpen, setAliasListOpen] = useState(false)
  const aliasEntries = useMemo(() => {
    return Object.entries(courseCodeAliases || {})
      .map(([legacy, value]) => {
        const canonical = typeof value === "string" ? value : value?.canonical
        const displayAlias = typeof value === "object" && value !== null ? value.displayAlias !== false : true
        return { legacy, canonical, displayAlias }
      })
      .filter((entry) => Boolean(entry.canonical))
      .sort((a, b) => a.legacy.localeCompare(b.legacy))
  }, [courseCodeAliases])

  const matchesSearchTerm = useCallback(
    (course: Course, term: string) => {
      if (!term) return true
      const normalized = term.toLowerCase()
      const canonical = resolveCanonicalCourseCode(course.code)
      const aliases = getAliasesForCanonical(canonical)

      const fields = [course.code, canonical, course.name, ...(aliases || [])]
        .filter(Boolean)
        .map((value) => value.toLowerCase())

      return fields.some((value) => value.includes(normalized))
    },
    [],
  )

  // Generate suggestions based on search term
  useEffect(() => {
    if (searchTerm.length >= 3) {
      const filtered = courses
        .filter((course) => matchesSearchTerm(course, searchTerm))
        .sort((a, b) => a.code.localeCompare(b.code))
        .slice(0, 5)
      setSuggestions(filtered)
      setOpen(filtered.length > 0)
    } else {
      setSuggestions([])
      setOpen(false)
    }
  }, [matchesSearchTerm, searchTerm, courses])

  const handleAliasSave = () => {
    const rawAlias = aliasForm.alias.trim().toUpperCase()
    const rawCanonical = aliasForm.canonical.trim().toUpperCase()
    const canonical = resolveCanonicalCourseCode(rawCanonical)

    if (!rawAlias || !canonical) {
      setAliasError("Enter both the old code and the current code.")
      return
    }

    if (rawAlias.length < 7) {
      setAliasError("Legacy code must be at least 7 characters long.")
      return
    }

    if (!/^[A-Z0-9]+$/.test(rawAlias)) {
      setAliasError("Legacy code must use letters and numbers only.")
      return
    }

    if (rawCanonical.length < 7) {
      setAliasError("Current code must be at least 7 characters long.")
      return
    }

    if (!/^[A-Z0-9]+$/.test(rawCanonical)) {
      setAliasError("Current code must use letters and numbers only.")
      return
    }

    if (rawAlias === canonical) {
      setAliasError("Alias and canonical code should differ.")
      return
    }

    const existingMapping = courseCodeAliases[rawAlias]
    const existingCanonical = typeof existingMapping === "string" ? existingMapping : existingMapping?.canonical
    if (existingCanonical) {
      if (existingCanonical === canonical) {
        setAliasError("This legacy code is already mapped to that current code.")
      } else {
        setAliasError("This legacy code is already mapped. Remove or change it first.")
      }
      return
    }

    const canonicalInUse = Object.entries(courseCodeAliases).find(([legacy, mapped]) => {
      const mappedCanonical = typeof mapped === "string" ? mapped : mapped?.canonical
      return mappedCanonical === canonical && legacy !== rawAlias
    })
    if (canonicalInUse) {
      setAliasError(`Current code is already mapped from ${canonicalInUse[0]}. Remove that mapping first.`)
      return
    }

    if (courseCodeAliases[canonical]) {
      setAliasError("Current code is already used as a legacy alias. Clear that mapping first.")
      return
    }

    const canonicalIsCurriculumCode = courses.some((course) => (course.code || "").toUpperCase() === canonical)
    if (canonicalIsCurriculumCode) {
      setAliasError("Current code is already an existing curriculum code. Choose a different target code or update that course directly.")
      return
    }

    const legacyInCurriculum = courses.some((course) => (course.code || "").toUpperCase() === rawAlias)

    if (!legacyInCurriculum) {
      setAliasError(null)
      setMissingAliasDialogOpen(true)
      return
    }

    setPendingAlias({ alias: rawAlias, canonical })
    setAliasError(null)
    setConfirmOpen(true)
  }

  const confirmAliasSave = () => {
    if (!pendingAlias) return
    onAddAliases({ [pendingAlias.alias]: pendingAlias.canonical })
    setAliasForm({ alias: "", canonical: "" })
    setPendingAlias(null)
    setConfirmOpen(false)
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search Input with Suggestions */}
          <div className="relative">
            <Label htmlFor="search-course" className="text-sm font-medium mb-1 block">
              Search Courses
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Popover
                open={open && suggestions.length > 0}
                onOpenChange={(next) => {
                  setOpen(next)
                  if (next) {
                    inputRef.current?.focus()
                  }
                }}
                modal={false}
              >
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
                    onFocus={() => {
                      if (searchTerm.length >= 3 && suggestions.length > 0) {
                        setOpen(true)
                      }
                    }}
                    className="pl-8 w-full"
                    autoComplete="off" // Prevent browser autocomplete
                    ref={inputRef}
                  />
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-full"
                  align="start"
                  sideOffset={5}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault()
                    inputRef.current?.focus()
                  }}
                >
                  <Command>
                    <CommandList>
                      <CommandGroup heading="Suggestions">
                        {suggestions.map((course) => (
                          <CommandItem
                            key={course.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onSelect={() => {
                              setSearchTerm(course.code)
                              setOpen(false)
                              inputRef.current?.focus()
                            }}
                            className="cursor-pointer"
                          >
                            <span className="font-medium">{getDisplayCode(course.code)}</span>
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
                  onClick={() => {
                    setSearchTerm("")
                    inputRef.current?.focus()
                  }}
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

      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardHeader>
          <CardTitle>Update Course Code Alias</CardTitle>
          <CardDescription>Link an old course code to the current one so search, imports, and planning stay in sync.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="alias-input" className="text-sm font-medium mb-1 block">
                Legacy code
              </Label>
              <Input
                id="alias-input"
                placeholder="e.g., CPE0001"
                value={aliasForm.alias}
                onChange={(e) => setAliasForm((prev) => ({ ...prev, alias: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="canonical-input" className="text-sm font-medium mb-1 block">
                Current code
              </Label>
              <Input
                id="canonical-input"
                placeholder="e.g., COE0001"
                value={aliasForm.canonical}
                onChange={(e) => setAliasForm((prev) => ({ ...prev, canonical: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAliasSave()
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" className="w-full" onClick={handleAliasSave}>
                Review alias change
              </Button>
            </div>
          </div>
          {aliasError && <p className="mt-1 text-xs text-red-500">{aliasError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAliasListOpen(true)}>
              View alias updates
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved aliases are remembered across tools so searches and schedule imports recognize old course codes.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setPendingAlias(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm alias update</DialogTitle>
            <DialogDescription>
              This will treat the legacy code as equivalent to the current code across Course Tracker, Schedule Maker, and Academic Planner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Legacy code</span>
                <span className="font-semibold">{pendingAlias?.alias ?? "—"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Maps to current</span>
                <span className="font-semibold">{pendingAlias?.canonical ?? "—"}</span>
              </div>
            </div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>Searches will match both codes.</li>
              <li>Imported schedules and planner suggestions reuse this mapping.</li>
              <li>You can update or add more aliases at any time.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAliasSave} disabled={!pendingAlias}>
              Confirm and save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={missingAliasDialogOpen} onOpenChange={setMissingAliasDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No matching course code found</DialogTitle>
            <DialogDescription>
              The legacy code you entered is not in your current curriculum. Please double-check the code and try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setMissingAliasDialogOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aliasListOpen} onOpenChange={setAliasListOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved course code aliases</DialogTitle>
            <DialogDescription>Legacy codes currently mapped to your active curriculum.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {aliasEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No aliases saved yet.</p>
            ) : (
              aliasEntries.map(({ legacy, canonical, displayAlias }) => (
                <div
                  key={`${legacy}-${canonical}`}
                  className="flex items-center justify-between rounded border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Legacy</span>
                    <span className="font-semibold">{legacy}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col text-right">
                    <span className="text-muted-foreground">Current</span>
                    <span className="font-semibold">{canonical}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>Display new code</span>
                      <span>{displayAlias ? "On" : "Off"}</span>
                    </div>
                    <Switch
                      checked={displayAlias}
                      onCheckedChange={(checked) => onToggleAliasDisplay(legacy, checked)}
                      aria-label={`Toggle display for alias ${legacy}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={() => onRemoveAlias(legacy)}
                    aria-label={`Remove alias ${legacy}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAliasListOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  isFloating,
}: OverallProgressProps) => {
  const [expandedYears, setExpandedYears] = useState<{ [key: number]: boolean }>({})
  const noteContentRef = useRef<HTMLDivElement>(null)
  const [noteHeight, setNoteHeight] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const buffer = 16

    const measure = () => {
      if (noteContentRef.current) {
        const height = noteContentRef.current.getBoundingClientRect().height
        setNoteHeight(Math.ceil(height) + buffer)
      }
    }

    measure()
    window.addEventListener("resize", measure)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && noteContentRef.current) {
      resizeObserver = new ResizeObserver(measure)
      resizeObserver.observe(noteContentRef.current)
    }

    return () => {
      window.removeEventListener("resize", measure)
      resizeObserver?.disconnect()
    }
  }, [])

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
    <div className="p-4 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 backdrop-blur transition-all duration-300 ease-in-out">
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
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isFloating && "pointer-events-none",
        )}
        style={{
          maxHeight: isFloating ? 0 : noteHeight ?? 220,
          marginTop: isFloating ? 0 : "1rem",
          opacity: isFloating ? 0 : 1,
        }}
        aria-hidden={isFloating}
      >
        <div
          ref={noteContentRef}
          className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300"
        >
          <p className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>
              <strong>Note:</strong> Course statuses are saved to your browser's local storage. After marking courses as
              "Active", use the "Go to Schedule Maker" button to see available sections for your active courses.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Save/Load Progress Controls (Simplified) ---
const SaveLoadControls = ({
  saveProgress,
  downloadProgress,
  saveMessage,
  triggerUploadDialog,
  setCourses,
  setSaveMessage,
}: SaveLoadControlsProps) => {
  // Ref for curriculum HTML import
  const htmlFileInputRef = useRef<HTMLInputElement>(null)
  const [highlightImport, setHighlightImport] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)


  const [isExpanded, setIsExpanded] = useState(false)

  // Auto-expand and highlight Import when navigated with #import hash
  useEffect(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : ""
      if (hash === "#import" || hash === "#import-curriculum") {
        // open the accordion
        setIsExpanded(true)
        // after expansion animation, scroll to import and highlight
        setTimeout(() => {
          const el = document.getElementById("import-curriculum")
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          setHighlightImport(true)
          setTimeout(() => setHighlightImport(false), 2200)
        }, 350)
      }
    } catch {}
  }, [])

  const resetAllToPending = () => {
    setCourses((prevCourses: Course[]) => {
      const resetCourses = prevCourses.map((course: Course) => ({
        ...course,
        status: "pending" as CourseStatus,
        lastTaken: null,
        gradeAttempts: [],
      }))
      saveCourseStatuses(resetCourses)
      return resetCourses
    })
    setSaveMessage("All course progress has been reset")
    setTimeout(() => setSaveMessage(null), 3000)
  }

  const confirmResetAll = () => {
    resetAllToPending()
    setResetDialogOpen(false)
  }

  return (
    <>
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
            <Button
              onClick={triggerUploadDialog}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Upload className="h-4 w-4" />
              Upload Progress
            </Button>
            {/* Import Curriculum (HTML) */}
            <div
              className={cn(
                "relative rounded-md",
                highlightImport && "ring-4 ring-indigo-300 animate-pulse"
              )}
              id="import-curriculum"
            >
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
                      const hydrated = hydrateCourses(parsed as Course[])
                      registerExternalCourses(hydrated)
                      setCourses(hydrated)
                      saveCourseStatuses(hydrated)
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
              <Button
                className={cn(
                  "flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 transition-transform",
                  highlightImport && "scale-105"
                )}
              >
                <Upload className="h-4 w-4" />
                Import Curriculum (HTML)
              </Button>
            </div>
            <Button
              onClick={() => setResetDialogOpen(true)}
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
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset All Course Progress?</DialogTitle>
          <DialogDescription>
            This will set every course back to <span className="font-semibold">pending</span> and overwrite any saved
            statuses in your browser.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
            Keep Current Progress
          </Button>
          <Button variant="destructive" onClick={confirmResetAll}>
            Reset Everything
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  )
}

// --- Academic Timeline (Simplified) ---
const AcademicTimeline = ({
  startYear,
  handleStartYearChange,
  academicYears,
  currentYearLevel,
  onCurrentYearLevelChange,
  currentTerm,
  onCurrentTermChange,
  yearLevelOptions,
  onExtendYearOptions,
}: AcademicTimelineProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState<string>(String(startYear))
  const expectedGraduation = startYear + 4

  // Keep local input in sync with prop changes
  useEffect(() => {
    setInputValue(String(startYear))
  }, [startYear])

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Academic Timeline
            </h2>
            <div className="flex flex-wrap items-center gap-4">
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

              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Current Year:</Label>
                <Select
                  value={String(currentYearLevel)}
                  onValueChange={(value) => {
                    if (value === "extend") {
                      onExtendYearOptions()
                      return
                    }
                    const parsed = Number.parseInt(value, 10)
                    if (!Number.isNaN(parsed)) {
                      onCurrentYearLevelChange(parsed)
                    }
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearLevelOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        Year {year}
                      </SelectItem>
                    ))}
                    <SelectItem value="extend" className="text-emerald-600 font-semibold">
                      Year {yearLevelOptions.length + 1} +
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Current Term:</Label>
                <Select value={currentTerm} onValueChange={(value: TermName) => onCurrentTermChange(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Term" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Term 1", "Term 2", "Term 3"].map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
        <Button asChild variant="outline" className="flex items-center gap-2 bg-transparent">
          <Link href="/academic-planner">
            <Calendar className="h-4 w-4" />
            Open Academic Planner
          </Link>
        </Button>
      </div>
    </div>
    </div>
  )
}

// --- Main Component ---

export default function CourseTracker() {
  const [courses, setCourses] = useState<Course[]>(() => hydrateCourses(initialCourses as unknown as Course[]))
  const [searchTerm, setSearchTerm] = useState("")
  const [courseCodeAliases, setCourseCodeAliases] = useState<
    Record<string, string | { canonical: string; displayAlias?: boolean }>
  >({})
  const [filterStatus, setFilterStatus] = useState<CourseStatus | "all" | "future">("all")
  const [openYears, setOpenYears] = useState<{ [key: number]: boolean }>({ 1: true }) // Start with Year 1 open
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null) // Track expanded card
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "table">("card")
  const [showDetailedProgress, setShowDetailedProgress] = useState(false)
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const [currentYearLevel, setCurrentYearLevel] = useState(1)
  const [currentTerm, setCurrentTerm] = useState<TermName>("Term 1")
  const [maxYearLevelOption, setMaxYearLevelOption] = useState(4)
  const { theme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const progressCardRef = useRef<HTMLDivElement>(null)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(false)
  const bottomNavigationRef = useRef<HTMLDivElement | null>(null)
  const [isProgressSticky, setIsProgressSticky] = useState(false)
  const [stickyOffset, setStickyOffset] = useState(16)
  const [gradeModalCourseId, setGradeModalCourseId] = useState<string | null>(null)
  const [gradeModalForm, setGradeModalForm] = useState<GradeModalFormState>({ year: null, term: null, grade: "" })
  const [gradeModalError, setGradeModalError] = useState<string | null>(null)
  const [pendingGradeReplacement, setPendingGradeReplacement] = useState<
    | {
        courseId: string
        year: number
        term: TermName
        grade: string
        previousGrade: string
      }
    | null
  >(null)
  const [pendingPassDowngrade, setPendingPassDowngrade] = useState<PendingPassDowngrade | null>(null)
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false)
  const [transcriptStep, setTranscriptStep] = useState<"details" | "review">("details")
  const [transcriptForm, setTranscriptForm] = useState({ studentName: "", studentNumber: "" })
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [noGradesDialogOpen, setNoGradesDialogOpen] = useState(false)
  const [trackerSetupDialogOpen, setTrackerSetupDialogOpen] = useState(false)
  const [setupStartYearInput, setSetupStartYearInput] = useState<string>(() => String(new Date().getFullYear()))
  const [setupYearLevel, setSetupYearLevel] = useState<number>(1)
  const [setupTerm, setSetupTerm] = useState<TermName>("Term 1")
  const [setupError, setSetupError] = useState<string | null>(null)
  const [hasSeenSetupDialog, setHasSeenSetupDialog] = useState(false)
  const [noProgressDismissed, setNoProgressDismissed] = useState(false)
  const [coursesHydrated, setCoursesHydrated] = useState(false)
  const [preferencesHydrated, setPreferencesHydrated] = useState(false)
  const [setupUploadStatus, setSetupUploadStatus] = useState<{ fileName: string; uploadedAt: number } | null>(null)
  const [prereqDialogState, setPrereqDialogState] = useState<PrerequisiteDialogState | null>(null)
  const [dependentRollbackDialogState, setDependentRollbackDialogState] = useState<DependentRollbackDialogState | null>(null)
  const [dependencyNoticeDismissed, setDependencyNoticeDismissed] = useState(false)
  const yearLevelOptions = useMemo(() => Array.from({ length: maxYearLevelOption }, (_, idx) => idx + 1), [maxYearLevelOption])
  const extendYearOptions = useCallback(() => {
    setMaxYearLevelOption((prev) => prev + 5)
  }, [])

  const scrollToPageTop = useCallback(() => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const defaultCourseSignature = useMemo(() => {
    return (initialCourses as Course[]).map((course) => course.id).sort().join("|")
  }, [])

  const currentCourseSignature = useMemo(() => {
    return courses.map((course) => course.id).sort().join("|")
  }, [courses])

  const isCustomCurriculum = currentCourseSignature !== defaultCourseSignature

  const dependencyDataAvailable = useMemo(() => {
    if (!courses.length) return false
    const idSet = new Set(courses.map((course) => course.id))
    const hasAnyPrereqs = courses.some((course) => Array.isArray(course.prerequisites) && course.prerequisites.length > 0)
    if (!hasAnyPrereqs) return false
    return courses.every((course) =>
      (Array.isArray(course.prerequisites) ? course.prerequisites : []).every((id) => idSet.has(id)),
    )
  }, [courses])

  const shouldShowDependencyNotice = isCustomCurriculum && !dependencyDataAvailable && !dependencyNoticeDismissed

  const ensureYearOption = useCallback((value: number) => {
    if (!Number.isFinite(value)) return
    setMaxYearLevelOption((prev) => {
      if (value <= prev) return prev
      const nextCeil = Math.ceil(value / 5) * 5
      return Math.max(prev, nextCeil)
    })
  }, [])

  const displayAliasMap = useMemo(() => {
    const map = new Map<string, string>()
    Object.entries(courseCodeAliases || {}).forEach(([legacy, value]) => {
      const canonical = typeof value === "string" ? value : value?.canonical
      const displayAlias = typeof value === "object" && value !== null ? value.displayAlias !== false : true
      if (!canonical) return
      const canonicalResolved = resolveCanonicalCourseCode(canonical)
      // When displayAlias is true, show the canonical (new) code; otherwise show the legacy (old) code.
      map.set(canonicalResolved, displayAlias ? canonicalResolved : legacy.toUpperCase())
    })
    return map
  }, [courseCodeAliases])

  const getDisplayCode = useCallback(
    (code: string) => {
      const canonical = resolveCanonicalCourseCode(code)
      const alias = displayAliasMap.get(canonical)
      return alias ?? canonical
    },
    [displayAliasMap],
  )

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

  const registerAliasMap = useCallback((aliases: Record<string, string | { canonical: string; displayAlias?: boolean }>) => {
    const mappedEntries = Object.entries(aliases || {})
      .map(([legacy, value]) => {
        const canonical = typeof value === "string" ? value : value?.canonical
        return canonical ? [legacy, canonical] : null
      })
      .filter((entry): entry is [string, string] => Array.isArray(entry))

    if (mappedEntries.length > 0) {
      registerCourseCodeAliases(Object.fromEntries(mappedEntries))
    }
  }, [])

  const handleAddAliases = useCallback(
    (aliases: Record<string, string>) => {
      if (!aliases || Object.keys(aliases).length === 0) return
      setCourseCodeAliases((prev) => {
        const next = { ...prev }
        Object.entries(aliases).forEach(([legacy, canonical]) => {
          next[legacy.toUpperCase()] = { canonical: canonical.toUpperCase(), displayAlias: true }
        })
        try {
          window.localStorage.setItem("courseCodeAliases", JSON.stringify(next))
        } catch (err) {
          console.error("Failed to persist course code aliases", err)
        }
        registerAliasMap(next)
        return next
      })
    },
    [registerAliasMap],
  )

  const handleRemoveAlias = useCallback(
    (legacyCode: string) => {
      setCourseCodeAliases((prev) => {
        if (!prev || !prev[legacyCode]) return prev
        const next = { ...prev }
        delete next[legacyCode]
        try {
          window.localStorage.setItem("courseCodeAliases", JSON.stringify(next))
        } catch (err) {
          console.error("Failed to persist course code aliases", err)
        }
        registerAliasMap(next)
        return next
      })
    },
    [registerAliasMap],
  )

  const handleToggleAliasDisplay = useCallback(
    (legacyCode: string, displayAlias: boolean) => {
      setCourseCodeAliases((prev) => {
        const existing = prev?.[legacyCode]
        if (!existing) return prev
        const canonical = typeof existing === "string" ? existing : existing.canonical
        const next = { ...prev, [legacyCode]: { canonical, displayAlias } }
        try {
          window.localStorage.setItem("courseCodeAliases", JSON.stringify(next))
        } catch (err) {
          console.error("Failed to persist course code alias visibility", err)
        }
        registerAliasMap(next)
        return next
      })
    },
    [registerAliasMap],
  )

  const handleCurrentYearLevelChange = useCallback(
    (value: number) => {
      const sanitized = Math.max(1, Math.floor(value))
      ensureYearOption(sanitized)
      setCurrentYearLevel(sanitized)
    },
    [ensureYearOption],
  )

  // Calculate academic years and expected graduation
  const academicYears = useMemo(() => calculateAcademicYears(startYear), [startYear])
  const expectedGraduation = startYear + 4
  const markedCourseCount = useMemo(() => courses.filter((course) => course.status !== "pending").length, [courses])

  // Load saved course statuses on component mount
  useEffect(() => {
    const savedCourses = loadCourseStatuses()
    if (savedCourses) {
      const hydrated = hydrateCourses(savedCourses as Course[])
      registerExternalCourses(hydrated)
      setCourses(hydrated)
      setSaveMessage("Loaded saved course statuses from local storage")
      setTimeout(() => setSaveMessage(null), 3000)
    }
    setCoursesHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem("courseCodeAliases")
      if (!stored) return
      const parsed = JSON.parse(stored)
      const normalized = normalizeAliasState(parsed)
      setCourseCodeAliases(normalized)
      registerAliasMap(normalized)
    } catch (err) {
      console.error("Failed to load course code aliases", err)
    }
  }, [normalizeAliasState, registerAliasMap])

  useEffect(() => {
    const prefs = loadTrackerPreferences()

    if (prefs) {
      if (typeof prefs.startYear === "number" && prefs.startYear >= 2000 && prefs.startYear <= 2100) {
        setStartYear(prefs.startYear)
        setSetupStartYearInput(String(prefs.startYear))
      }
      if (
        typeof prefs.currentYearLevel === "number" &&
        Number.isFinite(prefs.currentYearLevel) &&
        prefs.currentYearLevel >= 1
      ) {
        const sanitizedLevel = Math.floor(prefs.currentYearLevel)
        ensureYearOption(sanitizedLevel)
        setCurrentYearLevel(sanitizedLevel)
        setSetupYearLevel(sanitizedLevel)
      }
      if (prefs.currentTerm && TERM_SEQUENCE.includes(prefs.currentTerm as TermName)) {
        setCurrentTerm(prefs.currentTerm as TermName)
        setSetupTerm(prefs.currentTerm as TermName)
      }
    }

    setPreferencesHydrated(true)
  }, [ensureYearOption])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hasSeen = localStorage.getItem("courseTracker.setupSeen") === "true"
    setHasSeenSetupDialog(hasSeen)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    setDependencyNoticeDismissed(localStorage.getItem("courseTracker.dependencyNoticeDismissed") === "true")
  }, [])

  useEffect(() => {
    if (!coursesHydrated) return

    if (markedCourseCount > 0) {
      if (noProgressDismissed) {
        setNoProgressDismissed(false)
      }
      if (trackerSetupDialogOpen && hasSeenSetupDialog) {
        setTrackerSetupDialogOpen(false)
      }
      return
    }

    if (!hasSeenSetupDialog || !noProgressDismissed) {
      if (!trackerSetupDialogOpen) {
        setTrackerSetupDialogOpen(true)
      }
    }
  }, [coursesHydrated, markedCourseCount, noProgressDismissed, hasSeenSetupDialog, trackerSetupDialogOpen])

  const triggerUploadDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }

  const dismissDependencyNotice = () => {
    setDependencyNoticeDismissed(true)
    if (typeof window !== "undefined") {
      localStorage.setItem("courseTracker.dependencyNoticeDismissed", "true")
    }
  }

  const markTrackerSetupSeen = () => {
    if (typeof window === "undefined") return
    localStorage.setItem("courseTracker.setupSeen", "true")
    setHasSeenSetupDialog(true)
  }

  const handleTrackerSetupClose = () => {
    markTrackerSetupSeen()
    setTrackerSetupDialogOpen(false)
    setSetupError(null)
    if (markedCourseCount === 0) {
      setNoProgressDismissed(true)
    }
  }

  const handleSetupSubmit = () => {
    setSetupError(null)
    const parsedStartYear = Number.parseInt(setupStartYearInput, 10)
    if (!Number.isFinite(parsedStartYear) || parsedStartYear < 2000 || parsedStartYear > 2100) {
      setSetupError("Enter a valid starting school year between 2000 and 2100.")
      return
    }
    const numericYearLevel = Number(setupYearLevel)
    const sanitizedYearLevel = Math.max(1, Number.isFinite(numericYearLevel) ? Math.floor(numericYearLevel) : 1)
    const sanitizedTerm: TermName = TERM_SEQUENCE.includes(setupTerm) ? setupTerm : "Term 1"
    ensureYearOption(sanitizedYearLevel)

    setStartYear(parsedStartYear)
    setCurrentYearLevel(sanitizedYearLevel)
    setCurrentTerm(sanitizedTerm)
    setSetupStartYearInput(String(parsedStartYear))
    setSetupYearLevel(sanitizedYearLevel)
    setSetupTerm(sanitizedTerm)
    saveTrackerPreferences({ startYear: parsedStartYear, currentYearLevel: sanitizedYearLevel, currentTerm: sanitizedTerm })
    markTrackerSetupSeen()
    setTrackerSetupDialogOpen(false)
    if (markedCourseCount === 0) {
      setNoProgressDismissed(true)
    }
  }

  const handleSetupUploadClick = () => {
    setSetupError(null)
    triggerUploadDialog()
  }

  // Scroll to Import block when navigating with hash
  useEffect(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : ""
      if (hash === "#import" || hash === "#import-curriculum") {
        const el = document.getElementById("import-curriculum")
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return

    const bannerSelector = "[data-install-banner]"
    const baseOffset = 16
    let resizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null
    let observedElement: Element | null = null

    const applyOffset = (height: number) => {
      const nextOffset = baseOffset + Math.round(height)
      setStickyOffset((prev) => (Math.abs(prev - nextOffset) < 0.5 ? prev : nextOffset))
    }

    const updateMeasurements = () => {
      const banner = document.querySelector(bannerSelector) as HTMLElement | null
      const bannerHeight = banner ? banner.getBoundingClientRect().height : 0
      applyOffset(bannerHeight)

      if (banner && typeof ResizeObserver !== "undefined") {
        if (observedElement !== banner) {
          resizeObserver?.disconnect()
          observedElement = banner
          resizeObserver = new ResizeObserver(() => {
            const nextHeight = banner.getBoundingClientRect().height
            applyOffset(nextHeight)
          })
          resizeObserver.observe(banner)
        }
      } else if (!banner && observedElement) {
        resizeObserver?.disconnect()
        observedElement = null
      }
    }

    updateMeasurements()
    window.addEventListener("resize", updateMeasurements)

    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => {
        updateMeasurements()
      })
      mutationObserver.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      window.removeEventListener("resize", updateMeasurements)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (!progressCardRef.current) return
      const { top } = progressCardRef.current.getBoundingClientRect()
      setIsProgressSticky(top <= stickyOffset + 0.5)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true } as AddEventListenerOptions)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [stickyOffset])

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

  useEffect(() => {
    if (!coursesHydrated || !preferencesHydrated) return

    setCourses((prevCourses) => {
      let hasChanges = false
      const nextCourses = prevCourses.map((course) => {
        if (!course.lastTaken) return course
        const options = buildYearTermOptions(course, currentYearLevel, currentTerm, prevCourses)
        const stillValid = options.some(
          (opt) => opt.year === course.lastTaken?.year && opt.term === course.lastTaken?.term,
        )
        if (stillValid) return course
        hasChanges = true
        return { ...course, lastTaken: null }
      })
      if (hasChanges) {
        saveCourseStatuses(nextCourses)
        return nextCourses
      }
      return prevCourses
    })
  }, [currentYearLevel, currentTerm, coursesHydrated, preferencesHydrated])

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

  const transcriptEntries = useMemo<TranscriptEntry[]>(() => {
    const entries: TranscriptEntry[] = []
    courses.forEach((course) => {
      const attempts = getGradeAttempts(course)
      attempts.forEach((attempt) => {
        entries.push({
          id: `${course.id}-${attempt.id}`,
          courseCode: course.code,
          courseName: course.name,
          units: course.credits,
          year: attempt.year,
          term: attempt.term,
          grade: attempt.grade,
        })
      })
    })

    return entries.sort((a, b) => compareYearTerm(a.year, a.term, b.year, b.term))
  }, [courses])

  // Find a course by its ID
  const findCourseById = (id: string): Course | undefined => {
    return courses.find((course) => course.id === id)
  }

  const getCascadePreview = (course: Course, targetStatus: CourseStatus) => {
    const requiredStatus = PREREQ_TARGET_STATUS[targetStatus]
    if (!requiredStatus) return null

    const visited = new Set<string>([course.id])
    const cascadeTree = buildCascadeNodes(course, requiredStatus, findCourseById, visited)
    if (cascadeTree.length === 0) return null

    const overrides = flattenCascadeOverrides(cascadeTree)
    if (Object.keys(overrides).length === 0) return null

    const stats = summarizeCascadeNodes(cascadeTree)
    return { cascadeTree, overrides, stats, requiredStatus }
  }

  const updateCourseData = (courseId: string, updater: (course: Course, allCourses: Course[]) => Course) => {
    setCourses((prevCourses) => {
      const updatedCourses = prevCourses.map((course) => (course.id === courseId ? updater(course, prevCourses) : course))
      saveCourseStatuses(updatedCourses)
      return updatedCourses
    })
  }

  const upsertGradeAttempt = (
    courseId: string,
    payload: { year: number; term: TermName; grade: string },
    options?: { updateLastTaken?: boolean },
  ) => {
    if (!isAcceptableGrade(payload.grade)) return
    updateCourseData(courseId, (prevCourse, _allCourses) => {
      const attempts = getGradeAttempts(prevCourse)
      const existingIndex = attempts.findIndex(
        (attempt) => attempt.year === payload.year && attempt.term === payload.term,
      )
      const sanitizedGrade = payload.grade.trim()
      const timestamp = new Date().toISOString()
      let updatedAttempts: GradeAttempt[]

      if (existingIndex >= 0) {
        updatedAttempts = attempts.map((attempt, index) =>
          index === existingIndex ? { ...attempt, grade: sanitizedGrade, recordedAt: timestamp } : attempt,
        )
      } else {
        updatedAttempts = [
          ...attempts,
          {
            id: generateAttemptId(),
            year: payload.year,
            term: payload.term,
            grade: sanitizedGrade,
            recordedAt: timestamp,
          },
        ]
      }

      const shouldUpdateLastTaken =
        options?.updateLastTaken &&
        (!prevCourse.lastTaken ||
          compareYearTerm(payload.year, payload.term, prevCourse.lastTaken.year, prevCourse.lastTaken.term) >= 0)

      const nextCourse: Course = {
        ...prevCourse,
        gradeAttempts: sanitizeGradeAttempts(updatedAttempts),
      }

      if (shouldUpdateLastTaken) {
        nextCourse.lastTaken = { year: payload.year, term: payload.term }
      }

      return nextCourse
    })
  }

  const removeGradeAttempt = (courseId: string, year: number, term: TermName) => {
    updateCourseData(courseId, (prevCourse, _allCourses) => {
      const attempts = getGradeAttempts(prevCourse)
      const nextAttempts = attempts.filter((attempt) => !(attempt.year === year && attempt.term === term))
      if (nextAttempts.length === attempts.length) return prevCourse
      return {
        ...prevCourse,
        gradeAttempts: sanitizeGradeAttempts(nextAttempts),
      }
    })
  }

  const handleLastTakenYearSelect = (courseId: string, value: string) => {
    if (value === "unset") {
      updateCourseData(courseId, (prevCourse, _allCourses) => ({ ...prevCourse, lastTaken: null }))
      return
    }
    const parsedYear = Number.parseInt(value, 10)
    if (Number.isNaN(parsedYear)) return

    updateCourseData(courseId, (prevCourse, allCourses) => {
      const options = buildYearTermOptions(prevCourse, currentYearLevel, currentTerm, allCourses)
      const yearTerms = options.filter((option) => option.year === parsedYear)
      if (yearTerms.length === 0) {
        return { ...prevCourse, lastTaken: null }
      }

      const preferredTerm = prevCourse.lastTaken?.term
      const nextTerm = preferredTerm && yearTerms.some((option) => option.term === preferredTerm)
        ? preferredTerm
        : yearTerms[0].term

      return {
        ...prevCourse,
        lastTaken: { year: parsedYear, term: nextTerm },
      }
    })
  }

  const handleLastTakenTermSelect = (courseId: string, termValue: TermName) => {
    updateCourseData(courseId, (prevCourse, allCourses) => {
      if (!prevCourse.lastTaken) return prevCourse
      const options = buildYearTermOptions(prevCourse, currentYearLevel, currentTerm, allCourses)
      const isAllowed = options.some(
        (option) => option.year === prevCourse.lastTaken?.year && option.term === termValue,
      )
      if (!isAllowed) return prevCourse
      return {
        ...prevCourse,
        lastTaken: {
          year: prevCourse.lastTaken.year,
          term: termValue,
        },
      }
    })
  }

  const handleLatestGradeInput = (courseId: string, gradeValue: string) => {
    const course = findCourseById(courseId)
    if (!course || !course.lastTaken) return
    if (gradeValue === "clear") {
      removeGradeAttempt(courseId, course.lastTaken.year, course.lastTaken.term)
      return
    }

    const sanitized = gradeValue.trim()
    if (!sanitized) {
      removeGradeAttempt(courseId, course.lastTaken.year, course.lastTaken.term)
      return
    }

    if (!isAcceptableGrade(sanitized)) return

    if (isPassingGrade(sanitized)) {
      const downgradeAttempts = getPassingAttemptsBeforeYearTerm(course, course.lastTaken.year, course.lastTaken.term)
      const futureRemovals = getAttemptsAfterYearTerm(course, course.lastTaken.year, course.lastTaken.term)
      if (downgradeAttempts.length > 0 || futureRemovals.length > 0) {
        setPendingPassDowngrade({
          courseId,
          targetAttempt: { year: course.lastTaken.year, term: course.lastTaken.term, grade: sanitized },
          downgradeAttempts,
          futureRemovals,
          updateLastTaken: false,
          source: "table",
        })
        return
      }
    }

    upsertGradeAttempt(
      courseId,
      { year: course.lastTaken.year, term: course.lastTaken.term, grade: sanitized },
      { updateLastTaken: false },
    )
  }

  const openGradeModal = (courseId: string) => {
    const course = findCourseById(courseId)
    if (!course) return
    const options = buildYearTermOptions(course, currentYearLevel, currentTerm, courses)
    const fallbackYear = course.lastTaken?.year ?? options[0]?.year ?? null
    const fallbackTerm =
      course.lastTaken?.term ?? options.find((option) => option.year === fallbackYear)?.term ?? options[0]?.term ?? null

    const existingGrade =
      fallbackYear && fallbackTerm ? findAttemptForYearTerm(course, fallbackYear, fallbackTerm)?.grade ?? "" : ""

    setGradeModalCourseId(courseId)
    setGradeModalForm({ year: fallbackYear, term: fallbackTerm ?? null, grade: existingGrade })
    setGradeModalError(null)
  }

  const closeGradeModal = () => {
    setGradeModalCourseId(null)
    setGradeModalForm({ year: null, term: null, grade: "" })
    setGradeModalError(null)
    setPendingGradeReplacement(null)
  }

  const handleGradeModalYearChange = (value: string) => {
    if (!gradeModalCourseId) return
    if (value === "unset") {
      setGradeModalForm((prev) => ({ ...prev, year: null, term: null, grade: "" }))
      return
    }

    const parsedYear = Number.parseInt(value, 10)
    if (Number.isNaN(parsedYear)) return
    const course = findCourseById(gradeModalCourseId)
    if (!course) return
    const options = buildYearTermOptions(course, currentYearLevel, currentTerm, courses)
    const yearTerms = options.filter((option) => option.year === parsedYear)
    if (yearTerms.length === 0) return

    const nextTerm = yearTerms[0].term
    const existingGrade = findAttemptForYearTerm(course, parsedYear, nextTerm)?.grade ?? ""
    setGradeModalForm((prev) => ({ ...prev, year: parsedYear, term: nextTerm, grade: existingGrade }))
  }

  const handleGradeModalTermChange = (value: TermName) => {
    if (!gradeModalCourseId) return
    const course = findCourseById(gradeModalCourseId)
    if (!course) return
    const options = buildYearTermOptions(course, currentYearLevel, currentTerm, courses)

    setGradeModalForm((prev) => {
      if (!prev.year) return prev
      const isAllowed = options.some((option) => option.year === prev.year && option.term === value)
      if (!isAllowed) return prev
      const existingGrade = findAttemptForYearTerm(course, prev.year, value)?.grade ?? prev.grade
      return { ...prev, term: value, grade: existingGrade }
    })
  }

  const handleGradeModalGradeChange = (value: string) => {
    if (!isAcceptableGrade(value)) return
    setGradeModalForm((prev) => ({ ...prev, grade: value }))
  }

  const handleAddGradeAttempt = () => {
    if (!gradeModalCourseId) return
    const course = findCourseById(gradeModalCourseId)
    if (!course) return
    const { year, term, grade } = gradeModalForm

    if (!year || !term) {
      setGradeModalError("Select the year and term for this attempt.")
      return
    }
    if (!grade) {
      setGradeModalError("Select a grade before saving.")
      return
    }
    const sanitizedGrade = grade
    const payload = { year, term, grade: sanitizedGrade }

    if (isPassingGrade(sanitizedGrade)) {
      const downgradeAttempts = getPassingAttemptsBeforeYearTerm(course, year, term)
      const futureRemovals = getAttemptsAfterYearTerm(course, year, term)
      if (downgradeAttempts.length > 0 || futureRemovals.length > 0) {
        setPendingPassDowngrade({
          courseId: gradeModalCourseId,
          targetAttempt: payload,
          downgradeAttempts,
          futureRemovals,
          updateLastTaken: true,
          source: "modal",
        })
        setGradeModalError(null)
        return
      }
    }

    const existingAttempt = findAttemptForYearTerm(course, year, term)

    if (existingAttempt) {
      setPendingGradeReplacement({
        courseId: gradeModalCourseId,
        year,
        term,
        grade: sanitizedGrade,
        previousGrade: existingAttempt.grade,
      })
      return
    }

    upsertGradeAttempt(gradeModalCourseId, payload, { updateLastTaken: true })
    setGradeModalForm((prev) => ({ ...prev, grade: sanitizedGrade }))
    setGradeModalError(null)
  }

  const cancelGradeReplacement = () => {
    setPendingGradeReplacement(null)
  }

  const confirmGradeReplacement = () => {
    if (!pendingGradeReplacement) return
    const { courseId, year, term, grade } = pendingGradeReplacement
    upsertGradeAttempt(courseId, { year, term, grade }, { updateLastTaken: true })
    setPendingGradeReplacement(null)
    setGradeModalForm((prev) => ({ ...prev, grade: "" }))
    setGradeModalError(null)
  }

  const cancelPassDowngrade = () => {
    setPendingPassDowngrade(null)
  }

  const confirmPassDowngrade = () => {
    if (!pendingPassDowngrade) return
    const { courseId, targetAttempt, downgradeAttempts, futureRemovals, updateLastTaken, source } = pendingPassDowngrade
    const downgradeKeySet = new Set(downgradeAttempts.map((attempt) => `${attempt.year}-${attempt.term}`))
    const futureRemovalKeySet = new Set(futureRemovals.map((attempt) => `${attempt.year}-${attempt.term}`))
    const targetKey = `${targetAttempt.year}-${targetAttempt.term}`

    updateCourseData(courseId, (prevCourse, _allCourses) => {
      if (prevCourse.id !== courseId) return prevCourse
      const timestamp = new Date().toISOString()
      const attempts = getGradeAttempts(prevCourse)
      let targetFound = false

      const adjustedAttempts = attempts.reduce<GradeAttempt[]>((acc, attempt) => {
        const attemptKey = `${attempt.year}-${attempt.term}`
        if (futureRemovalKeySet.has(attemptKey) && attemptKey !== targetKey) {
          return acc
        }
        if (attemptKey === targetKey) {
          targetFound = true
          acc.push({ ...attempt, grade: targetAttempt.grade, recordedAt: timestamp })
          return acc
        }
        if (downgradeKeySet.has(attemptKey)) {
          acc.push({ ...attempt, grade: DOWNGRADE_FAIL_GRADE, recordedAt: timestamp })
          return acc
        }
        acc.push(attempt)
        return acc
      }, [])

      const finalAttempts = targetFound
        ? adjustedAttempts
        : [
            ...adjustedAttempts,
            {
              id: generateAttemptId(),
              year: targetAttempt.year,
              term: targetAttempt.term,
              grade: targetAttempt.grade,
              recordedAt: timestamp,
            },
          ]

      const nextCourse: Course = {
        ...prevCourse,
        gradeAttempts: sanitizeGradeAttempts(finalAttempts),
      }

      if (
        updateLastTaken &&
        (!prevCourse.lastTaken ||
          compareYearTerm(targetAttempt.year, targetAttempt.term, prevCourse.lastTaken.year, prevCourse.lastTaken.term) >= 0)
      ) {
        nextCourse.lastTaken = { year: targetAttempt.year, term: targetAttempt.term }
      }

      return nextCourse
    })

    if (source === "modal") {
      setGradeModalForm((prev) => ({ ...prev, grade: targetAttempt.grade }))
      setGradeModalError(null)
    }

    setPendingPassDowngrade(null)
  }

  const gradeModalCourse = gradeModalCourseId ? findCourseById(gradeModalCourseId) : null
  const gradeModalLatestPassingAttempt = gradeModalCourse ? getLatestPassingAttempt(gradeModalCourse) : null
  const gradeModalOptions = gradeModalCourse
    ? buildYearTermOptions(gradeModalCourse, currentYearLevel, currentTerm, courses).filter((option) => {
        if (!gradeModalLatestPassingAttempt) return true
        return (
          compareYearTerm(option.year, option.term, gradeModalLatestPassingAttempt.year, gradeModalLatestPassingAttempt.term) <= 0
        )
      })
    : []
  const gradeModalYearOptions = Array.from(new Set(gradeModalOptions.map((option) => option.year)))
  const gradeModalTermOptions = gradeModalForm.year
    ? gradeModalOptions.filter((option) => option.year === gradeModalForm.year).map((option) => option.term)
    : []
  const gradeModalAttempts = gradeModalCourse ? getGradeAttempts(gradeModalCourse) : []
  const gradeModalSelectedAttempt =
    gradeModalCourse && gradeModalForm.year && gradeModalForm.term
      ? findAttemptForYearTerm(gradeModalCourse, gradeModalForm.year, gradeModalForm.term)
      : null
  const gradeModalIsDuplicateSelection = Boolean(
    gradeModalSelectedAttempt &&
      gradeModalForm.grade &&
      gradeModalSelectedAttempt.grade === gradeModalForm.grade,
  )
  const gradeModalLatestAttempt =
    gradeModalCourse && gradeModalCourse.lastTaken
      ? findAttemptForYearTerm(
          gradeModalCourse,
          gradeModalCourse.lastTaken.year,
          gradeModalCourse.lastTaken.term,
        )
      : null
  const gradeModalIsBeforeLatestPass = Boolean(
    gradeModalLatestPassingAttempt &&
      gradeModalForm.year &&
      gradeModalForm.term &&
      compareYearTerm(
        gradeModalForm.year,
        gradeModalForm.term,
        gradeModalLatestPassingAttempt.year,
        gradeModalLatestPassingAttempt.term,
      ) < 0,
  )
  const gradeModalGradeOptions = gradeModalIsBeforeLatestPass ? FAIL_GRADE_OPTIONS : ALL_GRADE_OPTIONS
  const pendingReplacementCourse = pendingGradeReplacement
    ? findCourseById(pendingGradeReplacement.courseId)
    : null
  const pendingPassDowngradeCourse = pendingPassDowngrade
    ? findCourseById(pendingPassDowngrade.courseId)
    : null

  useEffect(() => {
    if (!gradeModalCourseId) return
    if (!gradeModalForm.year || !gradeModalForm.term) return
    if (!gradeModalGradeOptions.length) return
    if (gradeModalGradeOptions.some((option) => option.value === gradeModalForm.grade)) return
    setGradeModalForm((prev) => ({ ...prev, grade: gradeModalGradeOptions[0].value }))
  }, [gradeModalCourseId, gradeModalForm.year, gradeModalForm.term, gradeModalGradeOptions, setGradeModalForm])

  const transcriptFormValid =
    transcriptForm.studentName.trim().length > 0 && transcriptForm.studentNumber.trim().length > 0
  const hasAnyGrades = transcriptEntries.length > 0

  const openTranscriptModal = () => {
    if (!hasAnyGrades) {
      setNoGradesDialogOpen(true)
      return
    }
    setTranscriptModalOpen(true)
    setTranscriptStep("details")
    setTranscriptError(null)
  }

  const closeTranscriptModal = () => {
    setTranscriptModalOpen(false)
    setTranscriptStep("details")
    setTranscriptError(null)
  }

  const handleTranscriptFieldChange = (field: "studentName" | "studentNumber", value: string) => {
    setTranscriptForm((prev) => ({ ...prev, [field]: value }))
  }

  const goToTranscriptReview = () => {
    if (!transcriptFormValid) {
      setTranscriptError("Please complete both fields before continuing.")
      return
    }
    setTranscriptStep("review")
    setTranscriptError(null)
  }

  const handleGenerateTranscriptPdf = () => {
    if (!transcriptFormValid) {
      setTranscriptStep("details")
      setTranscriptError("Please complete the student details first.")
      return
    }

    if (typeof window === "undefined") return

    const transcriptWindow = window.open("", "_blank", "width=900,height=700")
    if (!transcriptWindow) {
      setTranscriptError("Pop-up blocked. Allow pop-ups to save the PDF.")
      return
    }

    const generatedAt = new Date()
    // Use icons for grade status
    const gradeIcon = (grade: string) => {
      if (!grade) return ''
      if (grade.toLowerCase() === 'passed' || grade === '1.00' || grade === 'A') {
        return '<span style="color:#22c55e;font-size:16px;vertical-align:middle;">✔️</span>'
      }
      if (grade.toLowerCase() === 'failed' || grade === '5.00' || grade === 'F') {
        return '<span style="color:#ef4444;font-size:16px;vertical-align:middle;">❌</span>'
      }
      if (grade.toLowerCase() === 'incomplete' || grade === 'INC') {
        return '<span style="color:#eab308;font-size:16px;vertical-align:middle;">⏳</span>'
      }
      return ''
    }

    const rowsHtml = transcriptEntries.length
      ? transcriptEntries
          .map(
            (entry) => `
              <tr>
                <td><b>${escapeHtml(entry.courseCode)}</b></td>
                <td>${escapeHtml(entry.courseName)}</td>
                <td style="text-align:center;">${entry.units}</td>
                <td>Year ${entry.year} • ${entry.term}</td>
                <td style="text-align:center;">${escapeHtml(entry.grade || "")} ${gradeIcon(entry.grade)}</td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td colspan="5" style="text-align:center;">No grade attempts recorded yet.</td></tr>'

    const academicStartLabel = `S.Y. ${startYear}-${startYear + 1}`
    const displayName = escapeHtml(transcriptForm.studentName.trim())
    const displayNumber = escapeHtml(transcriptForm.studentNumber.trim())
    const standing = `Year ${currentYearLevel} • ${currentTerm}`
    const generatedAtLabel = generatedAt.toLocaleString(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    })

    // Use requested logo from public/android-icon-192x192.png
    const logoUrl = `${window.location.origin}/android-icon-192x192.png`

    transcriptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>ComParEng Tools — Transcript</title>
          <style>
            :root {
              font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
              color: #0f172a;
            }
            body {
              margin: 0;
              padding: 32px;
              background: #f8fafc;
            }
            .transcript-header {
              display: flex;
              align-items: center;
              gap: 18px;
              margin-bottom: 12px;
            }
            .transcript-logo {
              width: 56px;
              height: 56px;
              border-radius: 16px;
              box-shadow: 0 2px 8px #0001;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            h1 {
              font-size: 28px;
              margin: 0 0 2px 0;
              font-weight: 700;
              letter-spacing: -0.02em;
              color: #0f172a;
            }
            h2 {
              font-size: 16px;
              margin: 24px 0 8px 0;
              color: #334155;
            }
            .meta {
              font-size: 13px;
              margin: 2px 0;
              color: #475569;
            }
            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin-top: 16px;
              font-size: 13px;
              background: #fff;
              border-radius: 12px;
              box-shadow: 0 2px 8px #0001;
              overflow: hidden;
            }
            th,
            td {
              border-bottom: 1px solid #e2e8f0;
              padding: 10px 8px;
              text-align: left;
            }
            th {
              background: #f1f5f9;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-size: 11px;
              color: #475569;
              font-weight: 600;
              border-bottom: 2px solid #cbd5f5;
            }
            tr:last-child td {
              border-bottom: none;
            }
            .footer {
              margin-top: 32px;
              font-size: 12px;
              color: #64748b;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <header class="transcript-header">
            <div class="transcript-logo">
              <img src="${logoUrl}" alt="ComParEng Tools Logo" style="width:100%;height:100%;object-fit:contain;" />
            </div>
            <div>
              <h1>Unofficial Transcript</h1>
              <p class="meta">Generated via ComParEng Tools Course Tracker</p>
            </div>
          </header>
          <div class="meta"><strong>Student:</strong> ${displayName}</div>
          <div class="meta"><strong>Student Number:</strong> ${displayNumber}</div>
          <div class="meta"><strong>Starting Year:</strong> ${academicStartLabel}</div>
          <div class="meta"><strong>Current Standing:</strong> ${standing}</div>
          <div class="meta"><strong>Date Generated:</strong> ${escapeHtml(generatedAtLabel)}</div>
          <div class="meta"><strong>App Version:</strong> v${APP_VERSION}</div>
          <div class="meta"><strong>Total Recorded Attempts:</strong> ${transcriptEntries.length}</div>

          <h2>Recorded Grades</h2>
          <table>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Units</th>
                <th>Year & Term</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <p class="footer">* Save or print this page as PDF for your own record. Data is based on manual entries inside the Course Tracker.<br>ComParEng Tools &copy; 2025</p>
        </body>
      </html>
    `)

    transcriptWindow.document.close()
    transcriptWindow.focus()
    transcriptWindow.print()
    closeTranscriptModal()
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

  const matchesCourseSearch = useCallback(
    (course: Course, term: string) => {
      const normalized = term.trim().toLowerCase()
      if (!normalized) return true

      const canonical = resolveCanonicalCourseCode(course.code)
      const aliases = getAliasesForCanonical(canonical)
      const haystacks = [course.code, canonical, course.name, ...(aliases || [])]

      return haystacks.some((value) => value.toLowerCase().includes(normalized))
    },
    [courseCodeAliases],
  )

  // Filter courses based on search term and status
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = matchesCourseSearch(course, searchTerm)

      let matchesStatus = true
      if (filterStatus === "future") {
        matchesStatus = canTakeNext(course)
      } else if (filterStatus !== "all") {
        matchesStatus = course.status === filterStatus
      }

      return matchesSearch && matchesStatus
    })
  }, [courses, searchTerm, filterStatus, matchesCourseSearch])

  // Group the filtered courses for display
  const groupedFilteredCourses = useMemo<CoursesByYearAndTerm>(() => groupCourses(filteredCourses), [filteredCourses])

  const prereqDialogActionLabel = prereqDialogState
    ? `Mark prerequisites as ${formatStatusLabel(
        PREREQ_TARGET_STATUS[prereqDialogState.targetStatus] ?? "pending",
      )}`
    : "Confirm updates"

  const applyStatusChange = (
    courseId: string,
    newStatus: CourseStatus,
    statusOverrides: Record<string, CourseStatus> = {},
  ) => {
    setCourses((prevCourses) => {
      const updatedCourses: Course[] = prevCourses.map((course): Course => {
        if (course.id === courseId) {
          return { ...course, status: newStatus }
        }

        const overrideStatus = statusOverrides[course.id]
        if (!overrideStatus) return course

        // Never downgrade a completed course to active when cascading an "active" status.
        if (course.status === "passed" && overrideStatus === "active") {
          return course
        }

        if (course.status === overrideStatus) {
          return course
        }

        return { ...course, status: overrideStatus }
      })

      saveCourseStatuses(updatedCourses)
      return updatedCourses
    })
  }

  // Handle status change for a course
  const handleStatusChange = (courseId: string, newStatus: CourseStatus) => {
    const targetCourse = findCourseById(courseId)
    if (!targetCourse) return

    const dependentDowngrades =
      dependencyDataAvailable &&
      dependentCoursesMap.size > 0 &&
      targetCourse.status === "passed" &&
      newStatus !== "passed"
        ? buildDependentDowngradeOverrides(targetCourse, newStatus, dependentCoursesMap, findCourseById)
        : {}
    const hasDependentDowngrades = Object.keys(dependentDowngrades).length > 0
    let immediateDependentOverrides: Record<string, CourseStatus> | undefined = undefined

    if (hasDependentDowngrades) {
      const affectedCourses = Object.entries(dependentDowngrades)
        .map(([id, status]) => {
          const dependentCourse = findCourseById(id)
          if (!dependentCourse) return null
          return { course: dependentCourse, nextStatus: status }
        })
        .filter((entry): entry is DependentRollbackPreview => Boolean(entry))

      if (affectedCourses.length > 0) {
        setDependentRollbackDialogState({
          course: targetCourse,
          targetStatus: newStatus,
          overrides: dependentDowngrades,
          affectedCourses,
        })
        return
      }

      immediateDependentOverrides = dependentDowngrades
    }

    if (dependencyDataAvailable && (newStatus === "passed" || newStatus === "active")) {
      const cascadePreview = getCascadePreview(targetCourse, newStatus)
      if (cascadePreview) {
        setPrereqDialogState({
          course: targetCourse,
          targetStatus: newStatus,
          cascadeTree: cascadePreview.cascadeTree,
          overrides: cascadePreview.overrides,
          stats: cascadePreview.stats,
          dependentRollbacks: dependentDowngrades,
        })
        return
      }
    }

    applyStatusChange(courseId, newStatus, immediateDependentOverrides)
  }

  const confirmPrereqCascade = () => {
    if (!prereqDialogState) return
    const downgradeEntries = prereqDialogState.dependentRollbacks
    const hasDowngrades = Object.keys(downgradeEntries || {}).length > 0
    const combinedOverrides = hasDowngrades
      ? { ...downgradeEntries, ...prereqDialogState.overrides }
      : prereqDialogState.overrides
    applyStatusChange(prereqDialogState.course.id, prereqDialogState.targetStatus, combinedOverrides)
    setPrereqDialogState(null)
  }

  const skipPrereqCascade = () => {
    if (!prereqDialogState) return
    const downgradeEntries = prereqDialogState.dependentRollbacks
    const hasDowngrades = Object.keys(downgradeEntries || {}).length > 0
    applyStatusChange(
      prereqDialogState.course.id,
      prereqDialogState.targetStatus,
      hasDowngrades ? downgradeEntries : undefined,
    )
    setPrereqDialogState(null)
  }

  const cancelDependentRollback = () => {
    setDependentRollbackDialogState(null)
  }

  const confirmDependentRollback = () => {
    if (!dependentRollbackDialogState) return
    applyStatusChange(
      dependentRollbackDialogState.course.id,
      dependentRollbackDialogState.targetStatus,
      dependentRollbackDialogState.overrides,
    )
    setDependentRollbackDialogState(null)
  }

  const skipDependentRollbackUpdates = () => {
    if (!dependentRollbackDialogState) return
    applyStatusChange(dependentRollbackDialogState.course.id, dependentRollbackDialogState.targetStatus)
    setDependentRollbackDialogState(null)
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
    const snapshot = {
      version: 3,
      exportedAt: new Date().toISOString(),
      tracker: {
        startYear,
        currentYearLevel,
        currentTerm,
      },
      courses,
      courseCodeAliases,
    }
    const dataStr = JSON.stringify(snapshot, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`

    const exportFileDefaultName = `course-progress-${new Date().toISOString().slice(0, 10)}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()

    setSaveMessage("Course progress and timeline downloaded successfully")
    setTimeout(() => setSaveMessage(null), 3000)
  }

  // Upload course progress from JSON file
  const uploadProgress = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const fileName = file.name

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = JSON.parse(content)

        let parsedCourses: Course[] | null = null
        let parsedTracker: Partial<TrackerPreferences> | null = null
        let parsedAliases: Record<string, { canonical: string; displayAlias?: boolean }> | null = null

        const parseAliasMap = (
          candidate: unknown,
        ): Record<string, { canonical: string; displayAlias?: boolean }> | null => {
          if (!candidate || typeof candidate !== "object") return null
          const entries = Object.entries(candidate as Record<string, unknown>).filter(([key]) => typeof key === "string")
          if (entries.length === 0) return null
          const next: Record<string, { canonical: string; displayAlias?: boolean }> = {}
          entries.forEach(([key, value]) => {
            if (typeof value === "string") {
              next[key.toUpperCase()] = { canonical: value.toUpperCase(), displayAlias: true }
              return
            }
            if (value && typeof value === "object" && typeof (value as any).canonical === "string") {
              const canonical = (value as any).canonical.toUpperCase()
              const displayAlias = (value as any).displayAlias !== false
              next[key.toUpperCase()] = { canonical, displayAlias }
            }
          })
          return Object.keys(next).length ? next : null
        }

        if (Array.isArray(parsed)) {
          parsedCourses = parsed as Course[]
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.courses)) {
          parsedCourses = parsed.courses as Course[]
          if (parsed.tracker && typeof parsed.tracker === "object") {
            parsedTracker = parsed.tracker as Partial<TrackerPreferences>
          }
          parsedAliases =
            parseAliasMap((parsed as Record<string, unknown>).courseCodeAliases) ||
            parseAliasMap((parsed as Record<string, unknown>).aliases)
        }

        if (
          !parsedCourses ||
          !parsedCourses.every(
            (course) =>
              course.id && course.code && course.name && ["passed", "active", "pending"].includes(course.status),
          )
        ) {
          throw new Error("Invalid course data format")
        }

        const hydrated = hydrateCourses(parsedCourses as Course[])
        registerExternalCourses(hydrated)
        setCourses(hydrated)
        saveCourseStatuses(hydrated)

        if (parsedTracker) {
          let nextStartYear = startYear
          let nextYearLevel = currentYearLevel
          let nextTerm: TermName = currentTerm

          if (typeof parsedTracker.startYear === "number" && parsedTracker.startYear >= 2000 && parsedTracker.startYear <= 2100) {
            nextStartYear = parsedTracker.startYear
            setStartYear(nextStartYear)
            setSetupStartYearInput(String(nextStartYear))
          }
          if (
            typeof parsedTracker.currentYearLevel === "number" &&
            Number.isFinite(parsedTracker.currentYearLevel) &&
            parsedTracker.currentYearLevel >= 1
          ) {
            nextYearLevel = Math.floor(parsedTracker.currentYearLevel)
            ensureYearOption(nextYearLevel)
            setCurrentYearLevel(nextYearLevel)
            setSetupYearLevel(nextYearLevel)
          }
          if (
            typeof parsedTracker.currentTerm === "string" &&
            TERM_SEQUENCE.includes(parsedTracker.currentTerm as TermName)
          ) {
            nextTerm = parsedTracker.currentTerm as TermName
            setCurrentTerm(nextTerm)
            setSetupTerm(nextTerm)
          }

          saveTrackerPreferences({ startYear: nextStartYear, currentYearLevel: nextYearLevel, currentTerm: nextTerm })
        }

        if (parsedAliases) {
          setCourseCodeAliases(parsedAliases)
          registerAliasMap(parsedAliases)
          try {
            window.localStorage.setItem("courseCodeAliases", JSON.stringify(parsedAliases))
          } catch (err) {
            console.error("Failed to persist course code aliases from import", err)
          }
        }

        setSetupUploadStatus({ fileName, uploadedAt: Date.now() })
        setSaveMessage("Course progress imported successfully")
        setTimeout(() => setSaveMessage(null), 3000)
      } catch (error) {
        console.error("Error parsing course progress file:", error)
        setSaveMessage("Error importing course progress: Invalid file format")
        setTimeout(() => setSaveMessage(null), 3000)
        setSetupUploadStatus(null)
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
    saveTrackerPreferences({ startYear, currentYearLevel, currentTerm })
    setSaveMessage("Course progress and timeline saved to browser storage")
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
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={uploadProgress}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <div className="mb-6 mt-4">
          <QuickNavigation />
        </div>

        <div className="p-4 md:p-6 lg:p-8 w-full max-w-[95rem] mx-auto font-sans">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center">Course Tracker</h1>
          <ThemeToggle />
        </div>

  {/* Non-CpE Student Notice */}
  <NonCpeNotice onReportIssue={() => setFeedbackDialogOpen(true)} />
  <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} defaultSubject="Non-CpE curriculum import issue" />

        {shouldShowDependencyNotice && (
          <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex w-full items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <AlertTitle className="mb-1 text-base">Prerequisite details missing</AlertTitle>
                <AlertDescription>
                  The curriculum you imported doesn&apos;t include prerequisite/required-for data, so we&apos;re skipping the
                  auto-update confirmation step. You can still update course statuses freely.
                </AlertDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissDependencyNotice} className="h-7 px-2">
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        <Dialog open={Boolean(prereqDialogState)} onOpenChange={(open) => (!open ? setPrereqDialogState(null) : null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resolve prerequisite chain</DialogTitle>
              {prereqDialogState && (
                <DialogDescription>
                  Marking {prereqDialogState.course.code} {prereqDialogState.course.name} as
                  {" "}
                  <span className="font-semibold">
                    {formatStatusLabel(prereqDialogState.targetStatus)}
                  </span>{" "}
                  requires updating its prerequisite courses below.
                </DialogDescription>
              )}
            </DialogHeader>

            {prereqDialogState && (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border border-slate-200/70 bg-slate-50/60 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">Auto-update summary</p>
                        <p className="text-xs text-muted-foreground">
                          {prereqDialogState.stats.toUpdate} of {prereqDialogState.stats.total} prerequisite course(s) will be
                          set to {formatStatusLabel(PREREQ_TARGET_STATUS[prereqDialogState.targetStatus] ?? "pending")}.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {prereqDialogState.stats.toUpdate} updates
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Confirm to automatically apply these changes, or skip to only update the selected course.
                    </p>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
                  {renderCascadeTree(prereqDialogState.cascadeTree)}
                </div>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={skipPrereqCascade}>
                Skip auto-updates
              </Button>
              <Button className="w-full sm:w-auto" onClick={confirmPrereqCascade}>
                {prereqDialogActionLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(dependentRollbackDialogState)}
          onOpenChange={(open) => {
            if (!open) {
              cancelDependentRollback()
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Dependent courses need attention</DialogTitle>
              {dependentRollbackDialogState && (
                <DialogDescription>
                  Changing {dependentRollbackDialogState.course.code} to {" "}
                  <span className="font-semibold">{formatStatusLabel(dependentRollbackDialogState.targetStatus)}</span> will
                  reset {dependentRollbackDialogState.affectedCourses.length} required course
                  {dependentRollbackDialogState.affectedCourses.length === 1 ? "" : "s"} back to Pending because their
                  prerequisites will no longer be satisfied.
                </DialogDescription>
              )}
            </DialogHeader>

            {dependentRollbackDialogState && (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border border-amber-300 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="text-xs uppercase tracking-wide">Summary</p>
                  <p className="text-sm">
                    {dependentRollbackDialogState.affectedCourses.length} course
                    {dependentRollbackDialogState.affectedCourses.length === 1 ? "" : "s"} will revert to the statuses
                    listed below to keep prerequisites accurate. Credited subjects? Use "Only This Course" to skip them.
                  </p>
                </div>

                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {dependentRollbackDialogState.affectedCourses.map(({ course, nextStatus }) => (
                    <div
                      key={course.id}
                      className="rounded-md border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{getDisplayCode(course.code)}</p>
                          <p className="text-xs text-muted-foreground">{course.name}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Badge variant="secondary">{formatStatusLabel(course.status)}</Badge>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-200">
                            {formatStatusLabel(nextStatus)}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Requires {dependentRollbackDialogState.course.code} to remain passed. If it is set to
                        {" "}
                        {formatStatusLabel(dependentRollbackDialogState.targetStatus)}, this course must return to
                        {" "}
                        {formatStatusLabel(nextStatus)}.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={cancelDependentRollback}>
                Cancel
              </Button>
              <Button variant="secondary" className="w-full" onClick={skipDependentRollbackUpdates}>
                Only this course
              </Button>
              <Button className="w-full" onClick={confirmDependentRollback}>
                Update all listed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save/Load Progress Controls */}
        <SaveLoadControls
          saveProgress={saveProgress}
          downloadProgress={downloadProgress}
          saveMessage={saveMessage}
          triggerUploadDialog={triggerUploadDialog}
          setCourses={setCourses}
          setSaveMessage={setSaveMessage}
        />

        {/* Academic Year and Expected Graduation */}
        <AcademicTimeline
          startYear={startYear}
          handleStartYearChange={handleStartYearChange}
          academicYears={academicYears}
          currentYearLevel={currentYearLevel}
          onCurrentYearLevelChange={handleCurrentYearLevelChange}
          currentTerm={currentTerm}
          onCurrentTermChange={setCurrentTerm}
          yearLevelOptions={yearLevelOptions}
          onExtendYearOptions={extendYearOptions}
        />

        {/* Overall Progress */}
        <div
          ref={progressCardRef}
          className="sticky z-30 mb-8 transition-all duration-300 ease-in-out"
          style={{
            top: stickyOffset,
            opacity: isProgressSticky ? 0.95 : 1,
            transform: isProgressSticky ? "translateY(-4px)" : "translateY(0)",
          }}
        >
          <OverallProgress
            overallProgress={overallProgress}
            showDetailedProgress={showDetailedProgress}
            setShowDetailedProgress={setShowDetailedProgress}
            progressByYear={progressByYear}
            progressByTerm={progressByTerm}
            courses={courses}
            isFloating={isProgressSticky}
          />
        </div>

        {/* Filter and Search Controls */}
        <FilterAndSearchControls
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          viewMode={viewMode}
          setViewMode={setViewMode}
          courses={courses}
          onAddAliases={handleAddAliases}
          courseCodeAliases={courseCodeAliases}
          onRemoveAlias={handleRemoveAlias}
          onToggleAliasDisplay={handleToggleAliasDisplay}
          getDisplayCode={getDisplayCode}
        />

        {/* Course Display Area */}
        <div className="mb-10">
          {viewMode === "card" ? (
            <div className="space-y-6">
              {Object.keys(groupedFilteredCourses).length > 0 ? (
                Object.entries(groupedFilteredCourses)
                  .sort(([yearA], [yearB]) => Number.parseInt(yearA) - Number.parseInt(yearB))
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
                                {allPassed
                                  ? "Unmark All"
                                  : `Mark All as Passed (${courses.filter((c) => c.year === yearNum && c.status !== "passed").length})`}
                              </span>
                            </Button>
                            {openYears[yearNum] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="p-4 space-y-4">
                          <div className="mb-4">
                            <Progress
                              value={yearProgress.percentage}
                              className="h-2 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-full"
                              style={{ backgroundImage: "none" }}
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
                                      S.Y. {academicYearStr} • ({termProgress.passed}/{termProgress.total} courses - {termProgress.percentage}%)
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

                                <div className="mb-4">
                                  <Progress
                                    value={termProgress.percentage}
                                    className="h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-full"
                                    style={{ backgroundImage: "none" }}
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
                                    const prereqCourses = course.prerequisites
                                      .map((id: string) => findCourseById(id))
                                      .filter((c: Course | undefined): c is Course => c !== undefined)

                                    const dependentCourses = dependentCoursesMap.get(course.id) || []
                                    const MAX_DEPENDENTS_SHOWN = 2
                                    const isExpanded = expandedCourseId === course.id

                                    return (
                                      <Card
                                        key={course.id}
                                        className={cn(
                                          "flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200 border dark:border-gray-700",
                                          course.status === "passed" && "border-l-4 border-l-green-500",
                                          course.status === "active" && "border-l-4 border-l-blue-500",
                                          course.status === "pending" && "border-l-4 border-l-yellow-500",
                                        )}
                                        style={{ transition: "all 0.3s ease" }}
                                      >
                                        <CardHeader className="pb-3">
                                          <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="text-base font-semibold">
                                              {getDisplayCode(course.code)} - {course.name}
                                            </CardTitle>
                                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap flex-shrink-0 pt-1">
                                              {course.credits} Credit{course.credits !== 1 ? "s" : ""}
                                            </span>
                                          </div>
                                        </CardHeader>

                                        <CardContent className={cn("text-sm space-y-3 pb-3 flex-grow overflow-hidden", isExpanded && "overflow-visible")}
                                        >
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

                                          {dependentCourses.length > 0 && (
                                            <div className="relative overflow-hidden">
                                              <span className="text-xs font-medium">Required for: </span>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                <AnimatePresence>
                                                  {dependentCourses
                                                    .slice(0, isExpanded ? dependentCourses.length : MAX_DEPENDENTS_SHOWN)
                                                    .map((dep, index) => (
                                                      <motion.div
                                                        key={dep.id}
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                                      >
                                                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5 whitespace-nowrap">
                                                          {dep.code}
                                                          {index <
                                                            (isExpanded ? dependentCourses.length : MAX_DEPENDENTS_SHOWN) - 1 &&
                                                            index < dependentCourses.length - 1
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

                                          {prereqCourses.length === 0 && dependentCourses.length === 0 && <div className="flex-grow"></div>}
                                        </CardContent>

                                        <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t dark:border-gray-700 mt-auto">
                                          <span>
                                            Year {course.year} - {course.term}
                                          </span>
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
              {Object.keys(groupedFilteredCourses).length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          Code
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Course Title
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Units
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Prerequisites
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Last Taken
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          style={{ minWidth: "260px" }}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span>Final Grade</span>
                            <span className="text-[10px] font-normal normal-case text-gray-400 dark:text-gray-500">
                              Valid: 0.0, 0.5, 1.0-4.0, 7.0, 8.0, 9.0
                            </span>
                            <span className="text-[10px] font-normal normal-case text-gray-400 dark:text-gray-500">
                              Later passing entries replace earlier passes and clear newer attempts when you move back in time.
                            </span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {Object.entries(groupedFilteredCourses)
                        .sort(([yearA], [yearB]) => Number.parseInt(yearA) - Number.parseInt(yearB))
                        .map(([year, terms]: [string, { [term: string]: Course[] }]) => {
                          const yearNum = Number.parseInt(year, 10)
                          const academicYear = academicYears[yearNum - 1]
                          const yearLabels = ["First Year", "Second Year", "Third Year", "Fourth Year"]
                          const yearLabel = yearLabels[yearNum - 1] ?? `Year ${year}`

                          return Object.entries(terms).map(([term, termCourses]) => {
                            const academicYearStr = academicYear
                              ? term === "Term 1"
                                ? academicYear.term1
                                : term === "Term 2"
                                  ? academicYear.term2
                                  : academicYear.term3
                              : ""
                            const showYearLabel = term === "Term 1"

                            return (
                              <React.Fragment key={`${year}-${term}`}>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                  <td colSpan={7} className="px-6 py-2 text-sm font-medium">
                                    {showYearLabel && <div className="font-bold mb-1">{yearLabel}</div>}
                                    <div>
                                      {term}
                                      {academicYearStr ? ` • S.Y. ${academicYearStr}` : ""}
                                    </div>
                                  </td>
                                </tr>
                                {termCourses.map((course: Course) => {
                                  const prereqCourses = course.prerequisites
                                    .map((id) => findCourseById(id))
                                    .filter((c): c is Course => c !== undefined)
                                  const allowedYearTermOptions = buildYearTermOptions(
                                    course,
                                    currentYearLevel,
                                    currentTerm,
                                    courses,
                                  )
                                  const yearOptions = Array.from(new Set(allowedYearTermOptions.map((option) => option.year)))
                                  const lastTaken = course.lastTaken ?? null
                                  const termOptionsForYear = lastTaken
                                    ? allowedYearTermOptions
                                        .filter((option) => option.year === lastTaken.year)
                                        .map((option) => option.term)
                                    : []
                                  const latestAttempt =
                                    lastTaken && lastTaken.year && lastTaken.term
                                      ? findAttemptForYearTerm(course, lastTaken.year, lastTaken.term)
                                      : null
                                  const gradeValue = latestAttempt?.grade ?? ""
                                  const canOpenGradeModal =
                                    allowedYearTermOptions.length > 0 || getGradeAttempts(course).length > 0

                                  return (
                                    <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{getDisplayCode(course.code)}</td>
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
                                                {getDisplayCode(prereq.code)}
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
                                      <td className="px-6 py-4 text-sm">
                                        {yearOptions.length > 0 ? (
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <Select
                                              value={lastTaken ? String(lastTaken.year) : undefined}
                                              onValueChange={(value) => handleLastTakenYearSelect(course.id, value)}
                                            >
                                              <SelectTrigger className="h-9 w-full sm:w-28 text-sm">
                                                <SelectValue placeholder="Year" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="unset">Not set</SelectItem>
                                                {yearOptions.map((yearOption) => (
                                                  <SelectItem key={`${course.id}-${yearOption}`} value={String(yearOption)}>
                                                    Year {yearOption}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            <Select
                                              value={lastTaken ? lastTaken.term : undefined}
                                              onValueChange={(value) => handleLastTakenTermSelect(course.id, value as TermName)}
                                              disabled={!lastTaken}
                                            >
                                              <SelectTrigger className="h-9 w-full sm:w-28 text-sm">
                                                <SelectValue placeholder="Term" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {termOptionsForYear.map((termOption) => (
                                                  <SelectItem key={`${course.id}-${termOption}`} value={termOption}>
                                                    {termOption}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-gray-500 dark:text-gray-400">Update current timeline</p>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-sm" style={{ minWidth: "260px" }}>
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-2">
                                            <Select
                                              value={gradeValue || undefined}
                                              onValueChange={(value) => handleLatestGradeInput(course.id, value)}
                                              disabled={!lastTaken}
                                            >
                                              <SelectTrigger className="h-9 w-36 text-sm">
                                                <SelectValue placeholder={lastTaken ? "Select" : "Set last taken"} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="clear">Clear grade</SelectItem>
                                                {ALL_GRADE_OPTIONS.map((option) => (
                                                  <SelectItem key={`${course.id}-${option.value}`} value={option.value}>
                                                    {option.label}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              className="h-9 w-9"
                                              onClick={() => openGradeModal(course.id)}
                                              disabled={!canOpenGradeModal}
                                              aria-label="Manage grade attempts"
                                            >
                                              <Plus className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
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
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">No courses match the current filters.</div>
              )}
            </div>
          )}
        </div>

        {viewMode === "table" && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Export your recorded grades as a PDF transcript.
            </p>
            <Button onClick={openTranscriptModal} className="w-full sm:w-auto">
              Save Grades as PDF
            </Button>
          </div>
        )}

        <Dialog
          open={trackerSetupDialogOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setTrackerSetupDialogOpen(true)
            } else {
              handleTrackerSetupClose()
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Set up Course Tracker</DialogTitle>
              <DialogDescription>
                Enter your timeline so we can personalize the academic planner and progress views. You can change these anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Starting School Year</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2000}
                  max={2100}
                  value={setupStartYearInput}
                  onChange={(event) => {
                    setSetupStartYearInput(event.target.value)
                    setSetupError(null)
                  }}
                  className="mt-1"
                  placeholder="2023"
                />
                <p className="mt-1 text-xs text-muted-foreground">Example: enter 2023 for S.Y. 2023-2024.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Current Year Level</Label>
                  <Select
                    value={String(setupYearLevel)}
                    onValueChange={(value) => {
                      if (value === "extend") {
                        extendYearOptions()
                        return
                      }
                      const parsed = Number.parseInt(value, 10)
                      if (!Number.isNaN(parsed)) {
                        ensureYearOption(parsed)
                        setSetupYearLevel(parsed)
                        setSetupError(null)
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Year level" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearLevelOptions.map((level) => (
                        <SelectItem key={`setup-year-${level}`} value={String(level)}>
                          Year {level}
                        </SelectItem>
                      ))}
                      <SelectItem value="extend" className="text-emerald-600 font-semibold">
                        Year {yearLevelOptions.length + 1} +
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Current Term</Label>
                  <Select
                    value={setupTerm}
                    onValueChange={(value) => {
                      setSetupTerm(value as TermName)
                      setSetupError(null)
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Term" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERM_SEQUENCE.map((term) => (
                        <SelectItem key={`setup-term-${term}`} value={term}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {setupError && <p className="text-xs text-red-500">{setupError}</p>}
              <p className="text-xs text-muted-foreground">
                Already tracked your grades elsewhere? Upload your exported progress JSON and we'll fill everything in for you.
              </p>
              {setupUploadStatus && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <p className="font-medium">Imported {setupUploadStatus.fileName}</p>
                  <p className="text-xs">
                    {new Date(setupUploadStatus.uploadedAt).toLocaleString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                className="w-full sm:w-auto gap-2"
                onClick={handleSetupUploadClick}
              >
                <Upload className="h-4 w-4" />
                Upload saved progress
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleSetupSubmit}>
                Save timeline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(gradeModalCourseId)} onOpenChange={(open) => (!open ? closeGradeModal() : null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {gradeModalCourse ? `${gradeModalCourse.code} — ${gradeModalCourse.name}` : "Manage Grades"}
              </DialogTitle>
              <DialogDescription>
                Track grade attempts and make sure retakes stay in sync with the table view.
              </DialogDescription>
            </DialogHeader>

            {gradeModalCourse ? (
              <div className="space-y-5">
                <div className="rounded-md border border-dashed p-3 text-sm bg-slate-50 dark:bg-slate-900/30">
                  <p className="font-semibold">Latest Grade</p>
                  {gradeModalCourse.lastTaken ? (
                    <div className="mt-1 flex items-center justify-between">
                      <span>
                        Year {gradeModalCourse.lastTaken.year} • {gradeModalCourse.lastTaken.term}
                      </span>
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-300">
                        {gradeModalLatestAttempt?.grade || "Not recorded"}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set the last taken fields in the table to activate the final grade input.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Add Grade Attempt</p>
                  {gradeModalYearOptions.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Year</Label>
                        <Select
                          value={gradeModalForm.year ? String(gradeModalForm.year) : undefined}
                          onValueChange={handleGradeModalYearChange}
                        >
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {gradeModalYearOptions.map((yearOption) => (
                              <SelectItem key={`modal-year-${yearOption}`} value={String(yearOption)}>
                                Year {yearOption}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Term</Label>
                        <Select
                          value={gradeModalForm.term || undefined}
                          onValueChange={(value) => handleGradeModalTermChange(value as TermName)}
                          disabled={!gradeModalForm.year}
                        >
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue placeholder="Term" />
                          </SelectTrigger>
                          <SelectContent>
                            {gradeModalTermOptions.map((termOption) => (
                              <SelectItem key={`modal-term-${termOption}`} value={termOption}>
                                {termOption}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Grade</Label>
                        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex-1">
                            {gradeModalForm.year && gradeModalForm.term ? (
                              <Select value={gradeModalForm.grade || undefined} onValueChange={handleGradeModalGradeChange}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                                <SelectContent>
                                  {gradeModalGradeOptions.map((option) => (
                                    <SelectItem key={`modal-grade-${option.value}`} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-xs text-muted-foreground">Select a year and term first.</div>
                            )}
                          </div>
                          <Button
                            type="button"
                            onClick={handleAddGradeAttempt}
                            disabled={
                              !gradeModalForm.year ||
                              !gradeModalForm.term ||
                              !gradeModalForm.grade ||
                              gradeModalIsDuplicateSelection
                            }
                            className="w-full sm:w-auto"
                          >
                            Add Attempt
                          </Button>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {gradeModalIsBeforeLatestPass && gradeModalLatestPassingAttempt
                            ? `Passed on Year ${gradeModalLatestPassingAttempt.year} • ${gradeModalLatestPassingAttempt.term}. Earlier attempts can only be logged as failed outcomes.`
                            : `Valid grades: 0.0, 0.5, 1.0–4.0, 7.0, 8.0, 9.0. Adding a later passing grade will convert older passes to ${DOWNGRADE_FAIL_GRADE} — ${GRADE_LABELS[DOWNGRADE_FAIL_GRADE]} and back-dating a pass clears later term attempts.`}
                        </p>
                        {gradeModalIsDuplicateSelection && (
                          <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                            Grade already matches the current record for this attempt.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Update the current year and term to start logging attempts for this course.
                    </p>
                  )}
                  {gradeModalError && <p className="text-xs text-red-500">{gradeModalError}</p>}
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Grade History</p>
                  {gradeModalAttempts.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {gradeModalAttempts.map((attempt) => (
                        <div
                          key={attempt.id}
                          className={cn(
                            "flex items-center justify-between rounded border p-2 text-sm",
                            gradeModalCourse.lastTaken &&
                              attempt.year === gradeModalCourse.lastTaken.year &&
                              attempt.term === gradeModalCourse.lastTaken.term
                              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-900/20"
                              : "border-slate-200 dark:border-slate-800",
                          )}
                        >
                          <div>
                            <p className="font-medium">
                              Year {attempt.year} • {attempt.term}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Recorded {new Date(attempt.recordedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold">{attempt.grade || "N/A"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {GRADE_LABELS[attempt.grade] || ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No grades recorded for this course yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a course from the table to manage grades.</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={closeGradeModal}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(pendingGradeReplacement)} onOpenChange={(open) => (!open ? cancelGradeReplacement() : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Recorded Grade?</DialogTitle>
              <DialogDescription>
                {pendingReplacementCourse
                  ? `${pendingReplacementCourse.code} — ${pendingReplacementCourse.name}`
                  : "This attempt already has a grade."}
              </DialogDescription>
            </DialogHeader>
            {pendingGradeReplacement && (
              <div className="space-y-3 text-sm">
                <p>
                  Year {pendingGradeReplacement.year} • {pendingGradeReplacement.term}
                </p>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Existing Grade</p>
                  <p className="text-base font-semibold">
                    {pendingGradeReplacement.previousGrade || "N/A"}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">New Grade</p>
                  <p className="text-base font-semibold">{pendingGradeReplacement.grade}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Continuing will overwrite the previous grade with the new value.
                </p>
              </div>
            )}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancelGradeReplacement} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={confirmGradeReplacement} className="w-full sm:w-auto" variant="destructive">
                Replace Grade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(pendingPassDowngrade)} onOpenChange={(open) => (!open ? cancelPassDowngrade() : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Grade Attempt Conflicts?</DialogTitle>
              <DialogDescription>
                {pendingPassDowngradeCourse
                  ? `${pendingPassDowngradeCourse.code} — ${pendingPassDowngradeCourse.name}`
                  : "Logging a new passing grade can alter existing attempts."}
              </DialogDescription>
            </DialogHeader>
            {pendingPassDowngrade && (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">New Attempt</p>
                  <p className="font-semibold">
                    Year {pendingPassDowngrade.targetAttempt.year} • {pendingPassDowngrade.targetAttempt.term}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Grade {pendingPassDowngrade.targetAttempt.grade} — {GRADE_LABELS[pendingPassDowngrade.targetAttempt.grade] || ""}
                  </p>
                </div>

                {pendingPassDowngrade.downgradeAttempts.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Will be changed to {DOWNGRADE_FAIL_GRADE} — {GRADE_LABELS[DOWNGRADE_FAIL_GRADE]}
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {pendingPassDowngrade.downgradeAttempts.map((attempt: GradeAttempt) => (
                        <div key={`${attempt.year}-${attempt.term}`} className="rounded border p-2 text-sm">
                          <p className="font-semibold">
                            Year {attempt.year} • {attempt.term}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Current grade {attempt.grade} — {GRADE_LABELS[attempt.grade] || ""}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      This keeps only the newest passing record. Earlier passes are preserved as failed outcomes for audit trails.
                    </p>
                  </div>
                )}

                {pendingPassDowngrade.futureRemovals.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Later attempts will be removed</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {pendingPassDowngrade.futureRemovals.map((attempt: GradeAttempt) => (
                        <div key={`future-${attempt.year}-${attempt.term}`} className="rounded border p-2 text-sm">
                          <p className="font-semibold">
                            Year {attempt.year} • {attempt.term}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Current grade {attempt.grade || "—"} {attempt.grade ? `— ${GRADE_LABELS[attempt.grade] || ""}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Moving the "Last Taken" back means later term attempts are cleared so your transcript remains chronological.
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancelPassDowngrade} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={confirmPassDowngrade} className="w-full sm:w-auto" variant="destructive">
                Apply Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={transcriptModalOpen} onOpenChange={(open) => (!open ? closeTranscriptModal() : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Grades as PDF</DialogTitle>
              <DialogDescription>
                {transcriptStep === "details"
                  ? "Enter your student details so we can stamp them on the transcript."
                  : "Review everything before we generate the PDF."
                }
              </DialogDescription>
            </DialogHeader>

            {transcriptStep === "details" ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="transcript-name" className="text-sm font-medium">Student Name</Label>
                  <Input
                    id="transcript-name"
                    value={transcriptForm.studentName}
                    onChange={(e) => handleTranscriptFieldChange("studentName", e.target.value)}
                    placeholder="Jane Doe"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="transcript-number" className="text-sm font-medium">Student Number</Label>
                  <Input
                    id="transcript-number"
                    value={transcriptForm.studentNumber}
                    onChange={(e) => handleTranscriptFieldChange("studentNumber", e.target.value)}
                    placeholder="2025-123456"
                    className="mt-1"
                  />
                </div>
                {transcriptError && <p className="text-xs text-red-500">{transcriptError}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Student</p>
                    <p className="font-medium">{transcriptForm.studentName || "—"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Student No.</p>
                    <p className="font-medium">{transcriptForm.studentNumber || "—"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Starting Year</p>
                    <p className="font-medium">S.Y. {startYear}-{startYear + 1}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Current Standing</p>
                    <p className="font-medium">Year {currentYearLevel} • {currentTerm}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Date Generated</p>
                    <p className="font-medium">{new Date().toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">App Version</p>
                    <p className="font-medium">v{APP_VERSION}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Recorded Grades ({transcriptEntries.length})</p>
                    {transcriptEntries.length > 0 && (
                      <span className="text-xs text-muted-foreground">Showing chronological order</span>
                    )}
                  </div>
                  {transcriptEntries.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto rounded border">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/40">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Code</th>
                            <th className="px-3 py-2 text-left font-semibold">Title</th>
                            <th className="px-3 py-2 text-left font-semibold">Units</th>
                            <th className="px-3 py-2 text-left font-semibold">Year & Term</th>
                            <th className="px-3 py-2 text-left font-semibold">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transcriptEntries.slice(0, 8).map((entry) => (
                            <tr key={entry.id} className="border-t text-[11px]">
                              <td className="px-3 py-1">{entry.courseCode}</td>
                              <td className="px-3 py-1">{entry.courseName}</td>
                              <td className="px-3 py-1">{entry.units}</td>
                              <td className="px-3 py-1">Year {entry.year} • {entry.term}</td>
                              <td className="px-3 py-1">{entry.grade || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {transcriptEntries.length > 8 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">+{transcriptEntries.length - 8} more entries will be included.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No grade attempts recorded yet. You can still generate the PDF.</p>
                  )}
                </div>
                {transcriptError && <p className="text-xs text-red-500">{transcriptError}</p>}
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between">
              {transcriptStep === "review" ? (
                <Button variant="outline" onClick={() => setTranscriptStep("details")} className="w-full sm:w-auto">
                  Back
                </Button>
              ) : (
                <Button variant="outline" onClick={closeTranscriptModal} className="w-full sm:w-auto">
                  Cancel
                </Button>
              )}
              {transcriptStep === "details" ? (
                <Button onClick={goToTranscriptReview} className="w-full sm:w-auto" disabled={!transcriptFormValid}>
                  Review Details
                </Button>
              ) : (
                <Button onClick={handleGenerateTranscriptPdf} className="w-full sm:w-auto">
                  Generate PDF
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={noGradesDialogOpen} onOpenChange={setNoGradesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Grade First</DialogTitle>
              <DialogDescription>
                Record at least one course grade before generating the transcript PDF.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              Use the Final Grade column or grade modal to log your first attempt, then try exporting again.
            </div>
            <DialogFooter>
              <Button onClick={() => setNoGradesDialogOpen(false)}>Okay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {showJumpButton && !isBottomNavVisible && (
            <motion.div
              key="course-tracker-floating-back-to-top"
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

        {/* Navigation Buttons (Bottom) */}
        <div className="mt-10 mb-6" ref={bottomNavigationRef}>
          <QuickNavigation showBackToTop />
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
    </>
  )
}
