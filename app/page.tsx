"use client"

import Link from "next/link"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { BookOpen, Calendar, GraduationCap, Download, ExternalLink, Info, X, ArrowUp, Palette, Sparkles, Trophy, Medal, Award, Pencil, ArrowLeft, Check, Menu } from "lucide-react"
import PatchNotesButton from "@/components/patch-notes"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import Spinner from "@/components/ui/spinner"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { orderedPatchNotes } from "@/lib/patch-notes"
import { MESSAGE_MIN } from "../lib/config"
import NonCpeNotice, { markNonCpeNoticeDismissed } from "@/components/non-cpe-notice"
import FeedbackDialog from "@/components/feedback-dialog"
import OnboardingDialog from "@/components/onboarding-dialog"
import { trackAnalyticsEvent } from "@/lib/analytics-client"
import { loadCourseStatuses, loadTrackerPreferences, TRACKER_PREFERENCES_KEY } from "@/lib/course-storage"
import { Progress } from "@/components/ui/progress"

const PROGRAMS = [
  "Computer Engineering",
  "Electrical Engineering",
  "Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Computer Science",
  "Information Technology",
  "Multimedia & Arts",
]

type TermName = "Term 1" | "Term 2" | "Term 3"

interface ProfileCardState {
  name: string
  program: string
  year: number
  expectedGraduation: string | null
  cardColor: string
}

type BadgeKind = "term" | "year"

interface BadgeMeta {
  id: string
  kind: BadgeKind
  year: number
  term?: TermName
  label: string
  xp: number
}

type RankTier = {
  name: string
  range: [number, number]
  gradient: string
  accent: string
  text: string
}

type LevelInfo = {
  level: number
  current: number
  currentStart: number
  next: number
  progress: number
}

type ProgressOverview = {
  total: number
  passed: number
  active: number
  pending: number
  percentage: number
}

const PROFILE_STORAGE_KEY = "courseTracker.profile.v1"
const GAMIFICATION_STORAGE_KEY = "courseTracker.gamification.v1"
const TERM_SEQUENCE: TermName[] = ["Term 1", "Term 2", "Term 3"]

const TERM_BADGE_XP_BY_YEAR: Record<number, number> = {
  1: 600,
  2: 900,
  3: 1200,
  4: 1700,
}

const YEAR_BADGE_XP_BY_YEAR: Record<number, number> = {
  1: 1800,
  2: 2000,
  3: 2300,
  4: 3200,
}

const LEVEL_THRESHOLDS = [0, 1000, 2500, 5000, 8000, 11000]
const LEVEL_STEP = 2500

const RANK_TIERS: RankTier[] = [
  {
    name: "Pathfinder",
    range: [1, 2],
    gradient: "linear-gradient(135deg, #0f172a 0%, #0ea5e9 50%, #22c55e 100%)",
    accent: "#22c55e",
    text: "#e0f2fe",
  },
  {
    name: "Vanguard",
    range: [3, 4],
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #6366f1 45%, #c084fc 100%)",
    accent: "#a78bfa",
    text: "#ede9fe",
  },
  {
    name: "Luminary",
    range: [5, 6],
    gradient: "linear-gradient(135deg, #451a03 0%, #f59e0b 40%, #f97316 100%)",
    accent: "#fbbf24",
    text: "#fff7ed",
  },
  {
    name: "Legend",
    range: [7, Number.POSITIVE_INFINITY],
    gradient: "linear-gradient(135deg, #2d1b69 0%, #fb7185 40%, #facc15 100%)",
    accent: "#fcd34d",
    text: "#fff7ed",
  },
]

const PROFILE_COLOR_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: "midnight", label: "Midnight Pulse", value: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #7c3aed 100%)" },
  { id: "ember", label: "Ember Fade", value: "linear-gradient(135deg, #2d1b69 0%, #7c2d12 45%, #f97316 100%)" },
  { id: "aurora", label: "Aurora Mint", value: "linear-gradient(135deg, #0f172a 0%, #0ea5e9 45%, #22c55e 100%)" },
  { id: "rose", label: "Rose Velvet", value: "linear-gradient(135deg, #2d1b69 0%, #be185d 45%, #ec4899 100%)" },
  { id: "slate", label: "Slate Frost", value: "linear-gradient(135deg, #0f172a 0%, #1f2937 45%, #9ca3af 100%)" },
]

const DEFAULT_PROFILE_CARD: ProfileCardState = {
  name: "",
  program: "",
  year: 1,
  expectedGraduation: null,
  cardColor: PROFILE_COLOR_OPTIONS[0].value,
}

const getBadgeXp = (kind: BadgeKind, year?: number) => {
  if (!year || !Number.isFinite(year)) return 0
  return kind === "year" ? YEAR_BADGE_XP_BY_YEAR[year] ?? 0 : TERM_BADGE_XP_BY_YEAR[year] ?? 0
}

const getBadgeFromId = (id: string): BadgeMeta | null => {
  if (id.startsWith("year-")) {
    const year = Number.parseInt(id.replace("year-", ""), 10)
    if (!Number.isFinite(year)) return null
    return { id, kind: "year", year, label: `Year ${year} Complete`, xp: getBadgeXp("year", year) }
  }

  if (id.startsWith("term-")) {
    const [, yearStr, ...rest] = id.split("-")
    const term = rest.join("-") as TermName
    const year = Number.parseInt(yearStr, 10)
    if (!Number.isFinite(year) || !term) return null
    return { id, kind: "term", year, term, label: `${term} Complete`, xp: getBadgeXp("term", year) }
  }

  return null
}

const makeBadgeId = (kind: BadgeKind, year: number, term?: TermName) =>
  kind === "year" ? `year-${year}` : `term-${year}-${term ?? ""}`

const deriveGamificationFromCourses = (courses: any[]): { xp: number; unlockedBadges: string[] } => {
  if (!Array.isArray(courses) || courses.length === 0) return { xp: 0, unlockedBadges: [] }

  const years = Array.from(new Set(courses.map((course) => course?.year).filter((y): y is number => Number.isFinite(y)))).sort(
    (a, b) => a - b,
  )

  const isYearComplete = (year: number) => {
    const yearCourses = courses.filter((course) => course?.year === year)
    return yearCourses.length > 0 && yearCourses.every((course) => course?.status === "passed")
  }

  const isTermComplete = (year: number, term: TermName) => {
    const termCourses = courses.filter((course) => course?.year === year && course?.term === term)
    return termCourses.length > 0 && termCourses.every((course) => course?.status === "passed")
  }

  const targetBadgeIds = new Set<string>()

  years.forEach((year) => {
    const yearComplete = isYearComplete(year)

    TERM_SEQUENCE.forEach((term) => {
      const hasCourses = courses.some((course) => course?.year === year && course?.term === term)
      if (!hasCourses) return
      if (yearComplete || isTermComplete(year, term)) {
        targetBadgeIds.add(makeBadgeId("term", year, term))
      }
    })

    if (yearComplete) {
      targetBadgeIds.add(makeBadgeId("year", year))
    }
  })

  const unlockedBadges = Array.from(targetBadgeIds)
  const xp = unlockedBadges.reduce((total, id) => {
    const badge = getBadgeFromId(id)
    return badge ? total + badge.xp : total
  }, 0)

  return { xp, unlockedBadges }
}

const calculateLevelInfo = (xp: number): LevelInfo => {
  const safeXp = Math.max(0, xp)
  let level = 1
  let currentStart = LEVEL_THRESHOLDS[0]
  let next = LEVEL_THRESHOLDS[1] ?? LEVEL_STEP

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    const start = LEVEL_THRESHOLDS[i]
    const end = LEVEL_THRESHOLDS[i + 1]
    if (safeXp < (end ?? Number.POSITIVE_INFINITY)) {
      level = i + 1
      currentStart = start
      next = end ?? start + LEVEL_STEP
      break
    }
    if (i === LEVEL_THRESHOLDS.length - 1) {
      const offset = safeXp - start
      const extraLevels = Math.floor(offset / LEVEL_STEP)
      level = LEVEL_THRESHOLDS.length + extraLevels
      currentStart = start + extraLevels * LEVEL_STEP
      next = currentStart + LEVEL_STEP
    }
  }

  const current = safeXp - currentStart
  const span = Math.max(1, next - currentStart)

  return {
    level,
    current,
    currentStart,
    next,
    progress: Math.min(1, Math.max(0, current / span)),
  }
}

const getRankTier = (level: number): RankTier => {
  const match = RANK_TIERS.find((tier) => level >= tier.range[0] && level <= tier.range[1])
  return match ?? RANK_TIERS[RANK_TIERS.length - 1]
}

const summarizeProgress = (courses: any[]): ProgressOverview => {
  const total = Array.isArray(courses) ? courses.length : 0
  const passed = Array.isArray(courses) ? courses.filter((c) => c?.status === "passed").length : 0
  const active = Array.isArray(courses) ? courses.filter((c) => c?.status === "active").length : 0
  const pending = Array.isArray(courses) ? courses.filter((c) => c?.status === "pending").length : 0
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0

  return { total, passed, active, pending, percentage }
}

const areProfilesEqual = (a: ProfileCardState, b: ProfileCardState) =>
  a.name === b.name &&
  a.program === b.program &&
  a.year === b.year &&
  a.expectedGraduation === b.expectedGraduation &&
  a.cardColor === b.cardColor

export default function Home() {
  const { theme, setTheme } = useTheme()
  // Feedback state (popup in Patch Notes)
  const [profileCard, setProfileCard] = useState<ProfileCardState>(DEFAULT_PROFILE_CARD)
  const [fullProfileDialogOpen, setFullProfileDialogOpen] = useState(false)
  const [profileEditorVisible, setProfileEditorVisible] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileCardState>(DEFAULT_PROFILE_CARD)
  const profileBaselineRef = useRef<ProfileCardState | null>(null)
  const [profileDirty, setProfileDirty] = useState(false)
  const [profileBackHover, setProfileBackHover] = useState(false)
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState("")
  const [toastType, setToastType] = useState<"success" | "error" | "">("")
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [feedbackStatusMessage, setFeedbackStatusMessage] = useState("")
  const [feedbackDefaultSubject, setFeedbackDefaultSubject] = useState<string>("")
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [shouldAutoOpenWhatsNew, setShouldAutoOpenWhatsNew] = useState(false)
  const [showExtensionCard, setShowExtensionCard] = useState(true)
  const [isDismissingExtensionCard, setIsDismissingExtensionCard] = useState(false)
  const disclaimerRef = useRef<HTMLDivElement | null>(null)
  const extensionHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [typewriterText, setTypewriterText] = useState(PROGRAMS[0])
  const [typeIndex, setTypeIndex] = useState(0)
  const [programIndex, setProgramIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [mobileActionMenuOpen, setMobileActionMenuOpen] = useState(false)
  const [gamificationSnapshot, setGamificationSnapshot] = useState<{ xp: number; unlockedBadges: string[] }>(
    () => ({ xp: 0, unlockedBadges: [] }),
  )
  const [progressOverview, setProgressOverview] = useState<ProgressOverview | null>(null)
  const [profileHydrated, setProfileHydrated] = useState(false)
  const profileHoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileHoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fullProfileCardRef = useRef<HTMLDivElement | null>(null)
  const customProgramInputRef = useRef<HTMLInputElement | null>(null)

  const scrollToPageTop = () => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const refreshGamificationSnapshot = useCallback(() => {
    if (typeof window === "undefined") return

    const applySnapshot = (snapshot: { xp: number; unlockedBadges: string[] }) => {
      setGamificationSnapshot(snapshot)
      try {
        window.localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(snapshot))
      } catch {
        // ignore write failures
      }
    }

    const fallbackFromCourses = () => {
      const courses = loadCourseStatuses()
      const snapshot = deriveGamificationFromCourses(Array.isArray(courses) ? courses : [])
      applySnapshot(snapshot)
    }

    try {
      const stored = window.localStorage.getItem(GAMIFICATION_STORAGE_KEY)
      if (!stored) {
        fallbackFromCourses()
        return
      }
      const parsed = JSON.parse(stored)
      const xp = Number.isFinite(parsed?.xp) ? Math.max(0, parsed.xp) : null
      const unlockedBadges = Array.isArray(parsed?.unlockedBadges)
        ? parsed.unlockedBadges.filter((id: unknown) => typeof id === "string")
        : null
      if (xp === null || unlockedBadges === null) {
        fallbackFromCourses()
        return
      }
      applySnapshot({ xp, unlockedBadges })
    } catch {
      fallbackFromCourses()
    }
  }, [])

  const refreshProgressOverview = useCallback(() => {
    if (typeof window === "undefined") return
    const stored = loadCourseStatuses()
    if (Array.isArray(stored)) {
      setProgressOverview(summarizeProgress(stored))
    } else {
      setProgressOverview(null)
    }
  }, [])

  const syncProfileFromStorage = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      setProfileCard((prev) => ({
        ...prev,
        name: typeof parsed?.name === "string" ? parsed.name : prev.name,
        program: typeof parsed?.program === "string" ? parsed.program : prev.program,
        year: Number.isFinite(parsed?.year) ? parsed.year : prev.year,
        expectedGraduation:
          typeof parsed?.expectedGraduation === "string" || parsed?.expectedGraduation === null
            ? parsed.expectedGraduation
            : prev.expectedGraduation,
        cardColor:
          typeof parsed?.cardColor === "string" && parsed.cardColor.trim().length > 0
            ? parsed.cardColor
            : prev.cardColor,
      }))
      setProfileHydrated(true)
    } catch {
      // ignore
    }
  }, [])

  const syncYearFromTrackerPreferences = useCallback(() => {
    try {
      const prefs = loadTrackerPreferences()
      const yearLevel = Number.isFinite(prefs?.currentYearLevel) ? Math.max(1, Math.floor(prefs.currentYearLevel)) : null
      if (yearLevel === null) return
      setProfileCard((prev) => ({ ...prev, year: yearLevel }))
    } catch {
      // ignore
    }
  }, [])

  const handleProfileStorage = useCallback(
    (event: StorageEvent) => {
      if (event?.key && event.key !== PROFILE_STORAGE_KEY) return
      syncProfileFromStorage()
    },
    [syncProfileFromStorage],
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateVisibilityState = () => {
      setShowJumpButton(window.scrollY > 400)
    }

    updateVisibilityState()
    window.addEventListener("scroll", updateVisibilityState)
    window.addEventListener("resize", updateVisibilityState)

    return () => {
      window.removeEventListener("scroll", updateVisibilityState)
      window.removeEventListener("resize", updateVisibilityState)
    }
  }, [])


  useEffect(() => {
    if (typeof window === "undefined") return

    const updateOffset = () => {
      const height = disclaimerRef.current?.offsetHeight ?? 0
      document.documentElement.style.setProperty("--install-banner-offset", `${height}px`)
    }

    updateOffset()
    window.addEventListener("resize", updateOffset)
    return () => {
      window.removeEventListener("resize", updateOffset)
      document.documentElement.style.removeProperty("--install-banner-offset")
    }
  }, [])
  

  useEffect(() => {
    try {
      const raw = localStorage.getItem("feedbackHistory")
      if (raw) setFeedbackHistory(JSON.parse(raw))
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    refreshGamificationSnapshot()
    refreshProgressOverview()
    syncYearFromTrackerPreferences()
  }, [refreshGamificationSnapshot, refreshProgressOverview, syncYearFromTrackerPreferences])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    syncProfileFromStorage()
    setProfileHydrated(true)
    window.addEventListener("storage", handleProfileStorage)
    return () => window.removeEventListener("storage", handleProfileStorage)
  }, [handleProfileStorage, syncProfileFromStorage])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GAMIFICATION_STORAGE_KEY) {
        refreshGamificationSnapshot()
      }
      if (event.key === "courseStatuses") {
        refreshProgressOverview()
        refreshGamificationSnapshot()
      }
      if (event.key === TRACKER_PREFERENCES_KEY) {
        syncYearFromTrackerPreferences()
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [refreshGamificationSnapshot, refreshProgressOverview, syncYearFromTrackerPreferences])

  useEffect(() => {
    if (profileEditorVisible) return
    setProfileDraft(profileCard)
    profileBaselineRef.current = profileCard
    setProfileDirty(false)
  }, [profileCard, profileEditorVisible])

  useEffect(() => {
    if (!fullProfileDialogOpen) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullProfileDialogOpen(false)
        setProfileEditorVisible(false)
      }
    }

    const focusTarget = fullProfileCardRef.current
    if (focusTarget) {
      focusTarget.focus()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [fullProfileDialogOpen])

  useEffect(() => {
    if (fullProfileDialogOpen) return
    setProfileEditorVisible(false)
  }, [fullProfileDialogOpen])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    try {
      const completed = localStorage.getItem("compareng.onboarding.completed") === "true"
      setHasCompletedOnboarding(completed)
      setShouldAutoOpenWhatsNew(completed)
      if (!completed) {
        timeout = setTimeout(() => setOnboardingOpen(true), 400)
        trackAnalyticsEvent("onboarding.open", { source: "auto" })
      }
    } catch {
      // ignore storage failures
    }
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  const completeOnboarding = (options?: { deferWhatsNew?: boolean; source?: "finish" | "jump" | "skip" }) => {
    trackAnalyticsEvent("onboarding.complete", {
      source: options?.source ?? "finish",
      deferWhatsNew: Boolean(options?.deferWhatsNew),
    })
    try {
      localStorage.setItem("compareng.onboarding.completed", "true")
    } catch {
      // ignore storage failures
    }
    setHasCompletedOnboarding(true)
    if (options?.source === "finish" || options?.source === "jump") {
      dismissExtensionCard()
      markNonCpeNoticeDismissed()
    }
    if (options?.deferWhatsNew) {
      try {
        sessionStorage.setItem("compareng.deferWhatsNew", "true")
      } catch {
        // ignore
      }
      setShouldAutoOpenWhatsNew(false)
    } else {
      setShouldAutoOpenWhatsNew(true)
    }
    setOnboardingOpen(false)
  }

  useEffect(() => {
    try {
      const shouldDefer = sessionStorage.getItem("compareng.deferWhatsNew") === "true"
      if (shouldDefer) {
        sessionStorage.removeItem("compareng.deferWhatsNew")
        setShouldAutoOpenWhatsNew(true)
      }
    } catch {
      // ignore storage failures
    }
  }, [])

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("compareng.extensionCard.dismissed") === "true"
      setShowExtensionCard(!dismissed)
    } catch {
      // ignore storage failures
    }
  }, [])

  const dismissExtensionCard = () => {
    if (isDismissingExtensionCard || !showExtensionCard) return
    setIsDismissingExtensionCard(true)
    try {
      localStorage.setItem("compareng.extensionCard.dismissed", "true")
    } catch {
      // ignore storage failures
    }
    if (extensionHideTimer.current) clearTimeout(extensionHideTimer.current)
    extensionHideTimer.current = setTimeout(() => setShowExtensionCard(false), 220)
  }

  useEffect(() => {
    return () => {
      if (extensionHideTimer.current) clearTimeout(extensionHideTimer.current)
      if (profileHoverOpenTimer.current) clearTimeout(profileHoverOpenTimer.current)
      if (profileHoverCloseTimer.current) clearTimeout(profileHoverCloseTimer.current)
    }
  }, [])

  // Hero typewriter effect for program names
  useEffect(() => {
    const current = PROGRAMS[programIndex % PROGRAMS.length]
    const typingSpeed = 85
    const deletingSpeed = 45
    const holdDelay = 900
    const gapDelay = 180

    let timeout: ReturnType<typeof setTimeout> | undefined

    if (!isDeleting && typeIndex < current.length) {
      timeout = setTimeout(() => {
        setTypeIndex((idx) => {
          const next = idx + 1
          setTypewriterText(current.slice(0, next))
          return next
        })
      }, typingSpeed)
    } else if (isDeleting && typeIndex > 0) {
      timeout = setTimeout(() => {
        setTypeIndex((idx) => {
          const next = Math.max(0, idx - 1)
          setTypewriterText(current.slice(0, next))
          return next
        })
      }, deletingSpeed)
    } else if (!isDeleting && typeIndex === current.length) {
      timeout = setTimeout(() => setIsDeleting(true), holdDelay)
    } else if (isDeleting && typeIndex === 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false)
        setProgramIndex((i) => (i + 1) % PROGRAMS.length)
        setTypewriterText("")
      }, gapDelay)
    }

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [isDeleting, programIndex, typeIndex])

  const saveLocalFeedback = (entry: any) => {
    const next = [entry, ...feedbackHistory].slice(0, 20)
    setFeedbackHistory(next)
    try {
      localStorage.setItem("feedbackHistory", JSON.stringify(next))
    } catch (e) {
      // ignore
    }
  }

  const profileName = profileCard.name.trim() || "Set your profile"
  const profileProgram = profileCard.program.trim() || "Add your program"
  const profileInitials = (profileCard.name || "").trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CT"
  const profileAccent = profileCard.cardColor || DEFAULT_PROFILE_CARD.cardColor
  const profileAccentDraft = profileDraft.cardColor || DEFAULT_PROFILE_CARD.cardColor
  const profileDraftName = profileDraft.name.trim() || profileName
  const profileDraftProgram = profileDraft.program.trim() || profileProgram
  const profileDraftInitials = (profileDraft.name || "").trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || profileInitials

  const markProfileDirty = useCallback(
    (next: ProfileCardState) => {
      const baseline = profileBaselineRef.current ?? profileCard
      setProfileDirty(!areProfilesEqual(next, baseline))
    },
    [profileCard],
  )

  const programOptions = PROGRAMS
  const trimmedDraftProgram = profileDraft.program.trim()
  const isCustomProgram = trimmedDraftProgram.length > 0 && !programOptions.includes(trimmedDraftProgram)
  const [programCustomSelected, setProgramCustomSelected] = useState(isCustomProgram)
  const programSelectValue = programCustomSelected ? "custom" : trimmedDraftProgram

  useEffect(() => {
    // When the editor opens, sync the custom flag to the current profile value
    if (profileEditorVisible) {
      setProgramCustomSelected(isCustomProgram)
    }
  }, [profileEditorVisible, isCustomProgram])

  useEffect(() => {
    // If the user types a preset program exactly, snap back to preset mode
    if (programCustomSelected && trimmedDraftProgram && programOptions.includes(trimmedDraftProgram)) {
      setProgramCustomSelected(false)
    }
  }, [programCustomSelected, trimmedDraftProgram, programOptions])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.dataset.profileEditing = profileEditorVisible ? "true" : "false"
    window.dispatchEvent(new CustomEvent("compareng:profile-open-state", { detail: { open: fullProfileDialogOpen, editing: profileEditorVisible } }))
    return () => {
      document.body.dataset.profileEditing = "false"
    }
  }, [profileEditorVisible, fullProfileDialogOpen])

  const handleSaveProfile = useCallback(() => {
    const next: ProfileCardState = {
      ...profileDraft,
      name: profileDraft.name.trim() || DEFAULT_PROFILE_CARD.name,
      program: profileDraft.program.trim() || DEFAULT_PROFILE_CARD.program,
    }
    setProfileDraft(next)
    setProfileCard(next)
    profileBaselineRef.current = next
    setProfileDirty(false)
  }, [profileDraft])

  // Expose save handler to other UI (e.g., navbar/bottom-nav back/save buttons)
  useEffect(() => {
    ;(window as any).comparengSaveProfile = () => handleSaveProfile()
    return () => {
      delete (window as any).comparengSaveProfile
    }
  }, [handleSaveProfile])

  const openProfileEditor = useCallback(() => {
    profileBaselineRef.current = profileCard
    setProfileDraft(profileCard)
    setProfileDirty(false)
    setProfileEditorVisible(true)
  }, [profileCard])

  const handleBackFromEditor = useCallback(() => {
    if (profileDirty) {
      handleSaveProfile()
    }
    setProfileEditorVisible(false)
  }, [handleSaveProfile, profileDirty])

  const levelInfo = useMemo(() => calculateLevelInfo(gamificationSnapshot.xp), [gamificationSnapshot.xp])
  const rankTier = useMemo(() => getRankTier(levelInfo.level), [levelInfo.level])
  const unlockedBadges = useMemo(() => {
    const termOrder = (term?: TermName) => (term ? TERM_SEQUENCE.indexOf(term) : 0)
    return gamificationSnapshot.unlockedBadges
      .map(getBadgeFromId)
      .filter((badge): badge is BadgeMeta => Boolean(badge))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "term" ? -1 : 1
        if (a.kind === "term" && b.kind === "term") {
          if (a.year !== b.year) return a.year - b.year
          return termOrder(a.term) - termOrder(b.term)
        }
        return a.year - b.year
      })
  }, [gamificationSnapshot.unlockedBadges])
  const completionPercent = progressOverview?.percentage ?? 0
  const xpToNextLevel = Math.max(0, levelInfo.next - gamificationSnapshot.xp)
  const expectedGradLabel = profileCard.expectedGraduation ?? "Not set (auto from Academic Planner)"
  const progressTotals = {
    total: progressOverview?.total ?? 0,
    passed: progressOverview?.passed ?? 0,
    active: progressOverview?.active ?? 0,
    pending: progressOverview?.pending ?? 0,
  }

  const scheduleProfileOpen = () => {
    if (profileHoverCloseTimer.current) clearTimeout(profileHoverCloseTimer.current)
    if (profileHoverOpenTimer.current) clearTimeout(profileHoverOpenTimer.current)
    profileHoverOpenTimer.current = setTimeout(() => setProfilePreviewOpen(true), 40)
  }

  const scheduleProfileClose = () => {
    if (profileHoverOpenTimer.current) clearTimeout(profileHoverOpenTimer.current)
    if (profileHoverCloseTimer.current) clearTimeout(profileHoverCloseTimer.current)
    profileHoverCloseTimer.current = setTimeout(() => setProfilePreviewOpen(false), 140)
  }

  const handleProfileClick = () => {
    if (profileHoverOpenTimer.current) clearTimeout(profileHoverOpenTimer.current)
    if (profileHoverCloseTimer.current) clearTimeout(profileHoverCloseTimer.current)
    setProfilePreviewOpen(false)
    setFullProfileDialogOpen(true)
    setProfileEditorVisible(false)
  }

  useEffect(() => {
    if (programSelectValue === "custom" && customProgramInputRef.current) {
      customProgramInputRef.current.focus()
    }
  }, [programSelectValue])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const handler = () => {
      setFullProfileDialogOpen(false)
      setProfileEditorVisible(false)
    }
    window.addEventListener("compareng:close-profile", handler)
    return () => window.removeEventListener("compareng:close-profile", handler)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const open = fullProfileDialogOpen
    document.body.dataset.profileOpen = open ? "true" : "false"
    window.dispatchEvent(new CustomEvent("compareng:profile-open-state", { detail: { open } }))
    return () => {
      document.body.dataset.profileOpen = "false"
    }
  }, [fullProfileDialogOpen])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (!profileHydrated) return
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileCard))
    } catch {
      // ignore write failures
    }
  }, [profileCard, profileHydrated])

  // Feedback logic moved to FeedbackDialog component; keep toast helpers intact for other uses

  return (
    <>
      <OnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onComplete={completeOnboarding}
        hasCompletedOnce={hasCompletedOnboarding}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        {/* Simple toast notification (uses Alert for consistent UI) */}
        {toastMessage && (
          <div className="fixed bottom-24 right-4 z-50 w-80 sm:right-6 md:bottom-6">
            <Alert variant={toastType === "error" ? "destructive" : "default"} className={toastType === "error" ? "" : "bg-green-600 text-white border-green-600"}>
              <div className="flex flex-col">
                <AlertTitle className={toastType === "error" ? "" : "text-white"}>{toastType === "error" ? "Error" : "Success"}</AlertTitle>
                <AlertDescription className={toastType === "error" ? "" : "text-white"}>{toastMessage}</AlertDescription>
              </div>
            </Alert>
          </div>
        )}
        <div className="fixed inset-x-0 top-0 z-50" ref={disclaimerRef}>
          <div className="w-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 p-2 text-xs md:text-sm">
            <div className="container mx-auto px-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="font-semibold">Disclaimer:</span>
                <span className="leading-snug">
                  This is a personal project and is NOT officially affiliated with FEU Tech or the FEU Tech CpE Department.
                </span>
              </div>
              <span className="signature-font credit-reveal text-sm md:text-base inline-block">
                Created by France Estrella
              </span>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 pb-12 pt-16">
          <div className="max-w-5xl mx-auto">
            {/* Header with Dark Mode Toggle */}
            <div className="relative mb-8 text-center pt-10 md:pt-12">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="hidden md:flex flex-wrap justify-center items-center gap-2 md:justify-start">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const nextTheme = theme === "dark" ? "light" : "dark"
                      trackAnalyticsEvent("theme.toggle", { to: nextTheme, source: "home" })
                      setTheme(nextTheme)
                    }}
                    aria-label="Toggle theme"
                    className="rounded-full border-slate-300 bg-white/80 text-slate-900 hover:bg-white transition-colors dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-white/80 text-slate-900 border-slate-300 hover:bg-white dark:bg-white/10 dark:text-white dark:border-white/40 dark:hover:bg-white/20"
                    onClick={() => {
                      trackAnalyticsEvent("onboarding.open", { source: "button" })
                      setOnboardingOpen(true)
                    }}
                  >
                    Start Onboarding
                  </Button>
                  <PatchNotesButton autoOpenOnce={shouldAutoOpenWhatsNew} buttonLabel="What's New" />
                </div>

                <div className="flex w-full items-start gap-3 justify-between md:w-auto md:ml-auto md:block">
                  <div className="md:hidden flex items-start justify-start">
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const nextOpen = !mobileActionMenuOpen
                          setMobileActionMenuOpen(nextOpen)
                          trackAnalyticsEvent("home.mobileMenu.toggle", { open: nextOpen })
                        }}
                        aria-label={mobileActionMenuOpen ? "Close quick actions" : "Open quick actions"}
                        className="rounded-full border-slate-300 bg-white/80 text-slate-900 hover:bg-white transition-colors dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                      >
                        {mobileActionMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                      </Button>

                      <AnimatePresence>
                        {mobileActionMenuOpen && (
                          <motion.div
                            key="home-mobile-actions"
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: "easeInOut" }}
                            className="absolute left-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-slate-900"
                          >
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                className="justify-start w-full"
                                onClick={() => {
                                  setMobileActionMenuOpen(false)
                                  trackAnalyticsEvent("onboarding.open", { source: "mobile-menu" })
                                  setOnboardingOpen(true)
                                }}
                              >
                                Start Onboarding
                              </Button>
                              <div
                                className="w-full [&>button]:w-full [&>button]:justify-start [&>button]:text-left"
                                onClick={() => {
                                  setMobileActionMenuOpen(false)
                                }}
                              >
                                <PatchNotesButton autoOpenOnce={shouldAutoOpenWhatsNew} buttonLabel="What's New" />
                              </div>
                              <Button
                                variant="outline"
                                className="justify-start w-full"
                                onClick={() => {
                                  const nextTheme = theme === "dark" ? "light" : "dark"
                                  trackAnalyticsEvent("theme.toggle", { to: nextTheme, source: "home-mobile-menu" })
                                  setTheme(nextTheme)
                                  setMobileActionMenuOpen(false)
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white">
                                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                  </span>
                                  <span>Toggle Theme</span>
                                </div>
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 ml-auto md:ml-0 md:justify-end">
                  <Popover open={profilePreviewOpen} onOpenChange={setProfilePreviewOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-slate-900/70 text-sm font-semibold uppercase text-white shadow-lg ring-2 ring-white/40 transition hover:-translate-y-[1px] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        style={{ textShadow: "0 0 6px rgba(0,0,0,0.55)", background: profileAccent }}
                        aria-label={`Open profile preview for ${profileName}`}
                        onMouseEnter={scheduleProfileOpen}
                        onMouseLeave={scheduleProfileClose}
                        onFocus={scheduleProfileOpen}
                        onBlur={scheduleProfileClose}
                        onClick={handleProfileClick}
                      >
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/25 via-black/0 to-white/10 opacity-80" />
                        <span className="relative drop-shadow-sm">{profileInitials}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      side="left"
                      sideOffset={8}
                      className="w-72 border-0 bg-transparent shadow-none p-0"
                      onClick={() => {
                        setProfilePreviewOpen(false)
                        setFullProfileDialogOpen(true)
                        setProfileEditorVisible(false)
                      }}
                    >
                      <div
                        className="rounded-2xl border border-white/15 p-4 text-white shadow-xl ring-1 ring-white/15"
                        style={{ background: profileAccent }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-base font-semibold uppercase tracking-wide ring-2 ring-white/50 shadow-inner">
                            {profileInitials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">Profile</p>
                            <p className="truncate text-lg font-semibold leading-tight">{profileName}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/85">
                              <span className="truncate">{profileProgram}</span>
                              <span className="opacity-70">•</span>
                              <span>Year {profileCard.year}</span>
                              {profileCard.expectedGraduation && (
                                <Badge variant="secondary" className="bg-white/25 text-white hover:bg-white/30">
                                  Grad {profileCard.expectedGraduation}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  </div>

                    <AnimatePresence>
                      {fullProfileDialogOpen && (
                        <motion.div
                          className="fixed inset-0 z-[12000]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => {
                              setFullProfileDialogOpen(false)
                              setProfileEditorVisible(false)
                            }}
                            aria-hidden
                          />
                          <motion.div
                            className="absolute inset-0 flex w-full items-start justify-center px-0 sm:items-center sm:px-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <div
                              ref={fullProfileCardRef}
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="full-profile-title"
                              className="relative flex h-screen max-h-[calc(100vh-16px)] flex-col overflow-y-auto rounded-none border-0 bg-white text-slate-900 shadow-2xl ring-0 outline-none dark:bg-slate-900 dark:text-white sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-3xl sm:overflow-hidden sm:rounded-3xl sm:border sm:border-slate-200/80 sm:ring-1 sm:ring-black/10 dark:sm:border-slate-800 dark:sm:ring-white/10"
                              style={{ background: rankTier.gradient }}
                              tabIndex={-1}
                            >
                              <div className="sticky top-0 z-10 h-1 w-full bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-slate-900/60" />
                              <div className="pointer-events-none absolute inset-0" style={{ background: rankTier.gradient }} />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/35 via-black/25 to-white/10" />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white/5" />
                              <motion.div
                                className="relative flex flex-col gap-4 p-4 sm:p-6"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                              >
                              <div className="relative overflow-hidden">
                                <motion.div
                                  className="flex w-full"
                                  animate={{ x: profileEditorVisible ? "-100%" : "0%" }}
                                  transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                                >
                                  <div className="w-full shrink-0 flex flex-col gap-4 min-h-0 max-w-3xl mx-auto">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-start gap-4">
                                        <div
                                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold uppercase tracking-wide ring-2 ring-white/60 shadow-inner ml-1 mt-1 text-white"
                                          style={{ background: profileAccent, textShadow: "0 0 6px rgba(0,0,0,0.55)" }}
                                        >
                                          {profileInitials}
                                        </div>
                                        <div className="min-w-0 space-y-1 text-left">
                                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">Profile overview</p>
                                          <p id="full-profile-title" className="truncate text-xl font-semibold leading-tight text-white">
                                            {profileName}
                                          </p>
                                          <p className="truncate text-sm text-white/90">{profileProgram}</p>
                                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-white/85">
                                            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/25">
                                              Year {profileCard.year}
                                            </Badge>
                                            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/25">
                                              Rank: {rankTier.name}
                                            </Badge>
                                            {profileCard.expectedGraduation && (
                                              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/25">
                                                Grad {profileCard.expectedGraduation}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="secondary"
                                          className="h-9 w-9 rounded-full bg-white text-slate-900 shadow hover:bg-white/90 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                          onClick={openProfileEditor}
                                          aria-label="Edit profile"
                                        >
                                          <motion.div
                                            animate={{ rotate: profileEditorVisible ? 20 : 0, scale: profileEditorVisible ? 0.92 : 1 }}
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </motion.div>
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-9 w-9 rounded-full bg-black/10 text-white hover:bg-black/20"
                                          onClick={() => {
                                            setFullProfileDialogOpen(false)
                                            setProfileEditorVisible(false)
                                          }}
                                          aria-label="Close"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <Card className="shadow-sm">
                                        <CardHeader className="pb-2 text-left">
                                          <CardTitle className="flex items-center gap-2 text-base">
                                            <Trophy className="h-4 w-4 text-amber-500" />
                                            Progress & rank
                                          </CardTitle>
                                          <CardDescription>Current XP and level</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-left">
                                          <div className="flex items-center justify-between text-sm font-medium">
                                            <span>Level {levelInfo.level}</span>
                                            <span className="text-muted-foreground">{Math.round(levelInfo.progress * 100)}%</span>
                                          </div>
                                          <Progress value={Math.round(levelInfo.progress * 100)} className="bg-slate-200 dark:bg-slate-800">
                                            <div
                                              className="h-full w-full flex-1 rounded-full"
                                              style={{
                                                transform: `translateX(-${100 - Math.round(levelInfo.progress * 100)}%)`,
                                                background: rankTier.accent,
                                              }}
                                            />
                                          </Progress>
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{gamificationSnapshot.xp.toLocaleString()} XP</span>
                                            <span>{xpToNextLevel.toLocaleString()} XP to next</span>
                                          </div>
                                        </CardContent>
                                      </Card>

                                      <Card className="shadow-sm">
                                        <CardHeader className="pb-2 text-left">
                                          <CardTitle className="flex items-center gap-2 text-base">
                                            <Medal className="h-4 w-4 text-emerald-500" />
                                            Academic progress
                                          </CardTitle>
                                          <CardDescription>Syncs from Course Tracker</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-left">
                                          <div className="flex items-center justify-between text-sm font-medium">
                                            <span>Overall completion</span>
                                            <span>{completionPercent}%</span>
                                          </div>
                                          <Progress value={completionPercent} className="bg-slate-200 dark:bg-slate-800">
                                            <div
                                              className="h-full w-full flex-1 rounded-full"
                                              style={{
                                                transform: `translateX(-${100 - completionPercent}%)`,
                                                background: profileAccent,
                                              }}
                                            />
                                          </Progress>
                                          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                            <div className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-900/60">
                                              <p className="font-semibold text-slate-900 dark:text-white">{progressTotals.passed}</p>
                                              <p className="text-[11px]">Passed</p>
                                            </div>
                                            <div className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-900/60">
                                              <p className="font-semibold text-slate-900 dark:text-white">{progressTotals.active}</p>
                                              <p className="text-[11px]">Active</p>
                                            </div>
                                            <div className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-900/60">
                                              <p className="font-semibold text-slate-900 dark:text-white">{progressTotals.pending}</p>
                                              <p className="text-[11px]">Pending</p>
                                            </div>
                                          </div>
                                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                                            Estimated graduation: <span className="font-semibold">{expectedGradLabel}</span>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>

                                      <div
                                        className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm text-left dark:border-slate-800 dark:bg-slate-900/60 w-full flex-1 min-h-0 overflow-y-auto max-h-[65vh] [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.8)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/60 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500/80 [WebkitOverflowScrolling:touch] md:flex-none md:min-h-[240px] md:max-h-[320px]"
                                      >
                                      <div className="flex items-center gap-2 pb-3">
                                        <Award className="h-4 w-4 text-indigo-500" />
                                        <div className="flex items-baseline gap-2">
                                          <p className="text-base font-semibold">Badges earned</p>
                                          <span className="text-xs text-muted-foreground">{unlockedBadges.length} total</span>
                                        </div>
                                      </div>
                                      {unlockedBadges.length > 0 ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          {unlockedBadges.map((badge) => (
                                            <div
                                              key={badge.id}
                                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition hover:-translate-y-[1px] hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                                            >
                                              <div className="min-w-0 space-y-1">
                                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{badge.label}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                  Year {badge.year}
                                                  {badge.term ? ` • ${badge.term}` : ""}
                                                </p>
                                              </div>
                                              <Badge variant="secondary" className="bg-slate-900 text-white shadow-sm dark:bg-white/15 dark:text-white text-[11px] px-2 py-1">
                                                +{badge.xp} XP
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          Earn badges by completing terms and years inside Course Tracker. Your badges and XP sync here automatically.
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="w-full shrink-0 space-y-4 max-w-3xl mx-auto">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="space-y-1 text-left">
                                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">Profile settings</p>
                                        <p className="truncate text-xl font-semibold leading-tight text-white">{profileName}</p>
                                        <p className="text-sm text-white/90">Update your badge identity without leaving this view.</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="secondary"
                                          className="h-9 w-9 rounded-full bg-white text-slate-900 shadow hover:bg-white/90 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                          onMouseEnter={() => setProfileBackHover(true)}
                                          onMouseLeave={() => setProfileBackHover(false)}
                                          onClick={handleBackFromEditor}
                                          aria-label={profileDirty ? "Save and go back" : "Back to profile overview"}
                                        >
                                          <motion.div
                                            animate={{ rotate: profileDirty && profileBackHover ? -12 : 0, scale: profileDirty && profileBackHover ? 0.96 : 1 }}
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                          >
                                            {profileDirty && profileBackHover ? <Check className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                                          </motion.div>
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-9 w-9 rounded-full bg-black/10 text-white hover:bg-black/20"
                                          onClick={() => {
                                            setFullProfileDialogOpen(false)
                                            setProfileEditorVisible(false)
                                          }}
                                          aria-label="Close"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div
                                      className="rounded-2xl border border-slate-200/50 bg-slate-900/80 p-4 text-white shadow-inner ring-1 ring-white/10 dark:border-slate-700/60 text-left"
                                      style={{ background: profileAccentDraft }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-semibold uppercase tracking-wide ring-2 ring-white/50 shadow-inner ml-1 mt-1 text-white"
                                          style={{ textShadow: "0 0 6px rgba(0,0,0,0.55)" }}
                                        >
                                          {profileDraftInitials}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">Preview</p>
                                          <p className="truncate text-lg font-semibold leading-tight text-left">{profileDraftName}</p>
                                          <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                                            <span className="truncate">{profileDraftProgram}</span>
                                            <span className="opacity-70">•</span>
                                            <span>Year {profileDraft.year}</span>
                                            {profileDraft.expectedGraduation && (
                                              <Badge variant="secondary" className="bg-white/25 text-white hover:bg-white/30">
                                                Grad {profileDraft.expectedGraduation}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <Sparkles className="h-5 w-5 text-white/80" />
                                      </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2 text-left">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs text-white/80 text-left">Display name</Label>
                                        <Input
                                          value={profileDraft.name}
                                          onChange={(e) =>
                                            setProfileDraft((prev) => {
                                              const next = { ...prev, name: e.target.value }
                                              markProfileDirty(next)
                                              return next
                                            })
                                          }
                                          placeholder="NeeBot"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs text-white/80 text-left">Program</Label>
                                        <Select
                                          value={programSelectValue}
                                          onValueChange={(value) => {
                                            if (value === "custom") {
                                              setProgramCustomSelected(true)
                                              setProfileDraft((prev) => {
                                                const keepCurrent = prev.program.trim() && (programCustomSelected || isCustomProgram)
                                                const next = { ...prev, program: keepCurrent ? prev.program : "" }
                                                markProfileDirty(next)
                                                return next
                                              })
                                              return
                                            }
                                            setProgramCustomSelected(false)
                                            setProfileDraft((prev) => {
                                              const next = { ...prev, program: value }
                                              markProfileDirty(next)
                                              return next
                                            })
                                          }}
                                        >
                                          <SelectTrigger className="bg-white/80 text-slate-900">
                                            <SelectValue placeholder="Choose your program" />
                                          </SelectTrigger>
                                          <SelectContent className="z-[13050]" position="popper">
                                            {programOptions.map((program) => (
                                              <SelectItem key={program} value={program}>
                                                {program}
                                              </SelectItem>
                                            ))}
                                            <SelectItem value="custom">Custom / Other</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        {(programSelectValue === "custom" || isCustomProgram) && (
                                          <Input
                                            ref={customProgramInputRef}
                                            value={profileDraft.program}
                                            onChange={(e) =>
                                              setProfileDraft((prev) => {
                                                const next = { ...prev, program: e.target.value }
                                                markProfileDirty(next)
                                                return next
                                              })
                                            }
                                            placeholder="Type your program"
                                            className="mt-2 bg-white/80 text-slate-900"
                                          />
                                        )}
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs text-white/80 text-left">Year level</Label>
                                        <Select
                                          value={String(profileDraft.year)}
                                          onValueChange={(value) =>
                                            setProfileDraft((prev) => {
                                              const next = { ...prev, year: Number(value) }
                                              markProfileDirty(next)
                                              return next
                                            })
                                          }
                                        >
                                          <SelectTrigger className="bg-white/80 text-slate-900">
                                            <SelectValue placeholder="Year" />
                                          </SelectTrigger>
                                          <SelectContent className="z-[13050]" position="popper">
                                            {[1, 2, 3, 4, 5, 6].map((year) => (
                                              <SelectItem key={year} value={String(year)}>
                                                Year {year}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs text-white/80 text-left">Graduation target</Label>
                                        <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white">
                                          <span className="truncate">{profileDraft.expectedGraduation ?? "Auto-filled from Academic Planner"}</span>
                                          <Badge variant="outline" className="text-[11px] text-white/90 border-white/40">Auto</Badge>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                        <Palette className="h-4 w-4" />
                                        <span>Avatar color</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {PROFILE_COLOR_OPTIONS.map((option) => (
                                          <button
                                            key={option.id}
                                            type="button"
                                            onClick={() =>
                                              setProfileDraft((prev) => {
                                                const next = { ...prev, cardColor: option.value }
                                                markProfileDirty(next)
                                                return next
                                              })
                                            }
                                            className={`relative flex h-12 items-center justify-center overflow-hidden rounded-lg border text-xs font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                                                profileDraft.cardColor === option.value
                                                ? "border-white/80 ring-2 ring-white/60"
                                                : "border-white/15 hover:border-white/40"
                                            }`}
                                            style={{ background: option.value }}
                                          >
                                            <span className="drop-shadow-sm">{option.label}</span>
                                            {profileDraft.cardColor === option.value && (
                                              <span className="absolute right-2 top-2 rounded-full bg-white/85 px-2 text-[10px] font-bold text-slate-900 shadow">Active</span>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="hidden md:flex flex-col gap-2 pt-4 mt-auto">
                                      <p className="text-xs text-white/80">Hit save to apply these updates across Course Tracker badges.</p>
                                      <Button className="w-full" onClick={handleSaveProfile} disabled={!profileDirty}>
                                        Save changes
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              </div>
                            </motion.div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                    </AnimatePresence>

                  </div>
              </div>
              <h1 className="mt-4 px-4 text-center font-bold leading-tight whitespace-nowrap mx-auto max-w-full text-[clamp(1.6rem,6vw,3rem)]">
                FEU Tech ComParEng Tools
              </h1>
            </div>

            {/* Hero Section */}
            <div className="text-center mb-8">
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                <span className="block">A collection of tools designed to help</span>
                <span className="inline-flex items-center gap-2 justify-center mt-1">
                  <span className="typewriter" aria-live="polite">
                    <span className="typewriter__text audiowide-regular">{typewriterText}</span>
                    <span className="typewriter__caret" aria-hidden="true" />
                  </span>
                </span>
                <span className="block mt-2">students at FEU Tech manage their academic journey more effectively.</span>
              </p>
            </div>

            {/* Extension Installation Guide */}
            {showExtensionCard && (
              <Card
                className={`relative mb-8 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 transition duration-300 ease-out transform ${isDismissingExtensionCard ? "opacity-0 -translate-y-2 scale-[0.98] pointer-events-none" : "opacity-100 translate-y-0 scale-100"}`}
              >
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/40"
                  aria-label="Dismiss extension install reminder"
                  onClick={dismissExtensionCard}
                >
                  <X className="h-4 w-4" />
                </button>
                <CardHeader className="gap-2">
                  <CardTitle className="flex items-center gap-2 pr-8">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Extension Installation Required
                  </CardTitle>
                  <CardDescription>
                    For full functionality of Schedule Maker and Academic Planner, please install the ComParEng Course
                    Data Extractor Extension
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <Button
                      className="w-full flex items-center gap-2"
                      onClick={() => {
                        trackAnalyticsEvent("home.install_extension_click")
                        window.open(
                          "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                          "_blank",
                        )
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Install Extension
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                          View Installation Guide
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>ComParEng Academic Tools Web App - Installation Guide</DialogTitle>
                          <DialogDescription>Follow these steps to install and use the extension</DialogDescription>
                        </DialogHeader>

                      {/* Content moved outside DialogDescription */}
                      <div className="space-y-4 mt-4">
                        <div>
                          <h3 className="font-bold">Pre-requisites (for Schedule Maker and Academic Planner):</h3>
                          <p>Install ComParEng Course Data Extractor Extension</p>
                        </div>

                        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
                          <ol className="list-decimal pl-5 space-y-2">
                            <li>
                              Download the extension from the &nbsp;
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                                onClick={() => {
                                  trackAnalyticsEvent("home.install_extension_click", { source: "install_guide" })
                                  window.open(
                                    "https://chromewebstore.google.com/detail/compareng-courses-data-ex/fdfappahfelppgjnpbobconjogebpiml",
                                    "_blank",
                                  )
                                }}
                              >
                                chrome web store. <ExternalLink className="h-3 w-3 inline" />
                              </Button>
                            </li>
                            <li>Click the "Add to Chrome" button to install.</li>
                            <li>A popup will open and click "Add extension".</li>
                          </ol>

                          <p className="font-medium mt-4">You have successfully installed the extension!</p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h3 className="font-bold mb-2">Using the Extension:</h3>
                          <ol className="list-decimal pl-5 space-y-2">
                            <li>
                              Login to SOLAR and go to{" "}
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                                onClick={() => window.open("https://solar.feutech.edu.ph/course/offerings", "_blank")}
                              >
                                https://solar.feutech.edu.ph/course/offerings
                              </Button>
                            </li>
                            <li>Select the current term and school year.</li>
                            <li>
                              Open the ComParEng Tools Web App:
                              <Button
                                variant="link"
                                className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal ml-2"
                                onClick={() => window.open("https://compareng-tools.vercel.app/", "_blank")}
                              >
                                https://compareng-tools.vercel.app/
                              </Button>
                            </li>
                          </ol>
                          <p className="font-medium mt-4">You are ready to use the App!</p>
                        </div>
                      </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Non-CpE Student Notice */}
            <NonCpeNotice
              onReportIssue={() => {
                setFeedbackDefaultSubject("Issue: Importing Program Curriculum")
                setFeedbackDialogOpen(true)
              }}
            />

            {/* Tools Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* Course Tracker Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105 flex flex-col h-full">
                <div className="bg-blue-700 dark:bg-blue-900 bg-gradient-to-r from-blue-600 to-blue-800 p-6">
                  <BookOpen className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Course Tracker</h2>
                  <p className="text-blue-100 mt-2">Track your academic progress through the CpE curriculum</p>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300 flex-1">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Mark courses as Pending, Active, or Passed</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View prerequisites and dependent courses</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Track your progress through the curriculum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>See which courses you can take next</span>
                    </li>
                  </ul>
                  <Link
                    href="/course-tracker"
                    onClick={() => trackAnalyticsEvent("home.open_course_tracker_click")}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors mt-auto"
                  >
                    Open Course Tracker
                  </Link>
                </div>
              </div>

              {/* Schedule Maker Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105 flex flex-col h-full">
                <div className="bg-purple-700 dark:bg-purple-900 bg-gradient-to-r from-purple-600 to-purple-800 p-6">
                  <Calendar className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Schedule Maker</h2>
                  <p className="text-purple-100 mt-2">Create your perfect class schedule with ease</p>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300 flex-1">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View available course sections</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Filter courses in your curriculum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Check for schedule conflicts</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Optimize your weekly schedule</span>
                    </li>
                  </ul>
                  <Link
                    href="/schedule-maker"
                    onClick={() => trackAnalyticsEvent("home.open_schedule_maker_click")}
                    className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors mt-auto"
                  >
                    Open Schedule Maker
                  </Link>
                </div>
              </div>

              {/* Academic Planner Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:transform hover:scale-105 flex flex-col h-full">
                <div className="bg-green-700 dark:bg-green-900 bg-gradient-to-r from-green-600 to-green-800 p-6">
                  <GraduationCap className="h-12 w-12 text-white mb-4" />
                  <h2 className="text-2xl font-bold text-white">Academic Planner</h2>
                  <p className="text-green-100 mt-2">Plan your path to graduation efficiently</p>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <ul className="space-y-2 mb-6 text-gray-700 dark:text-gray-300 flex-1">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Get personalized course recommendations</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Optimize your remaining semesters</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Identify courses needing petitions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Estimate your graduation timeline</span>
                    </li>
                  </ul>
                  <Link
                    href="/academic-planner"
                    onClick={() => trackAnalyticsEvent("home.open_academic_planner_click")}
                    className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-3 px-4 rounded-lg transition-colors mt-auto"
                  >
                    Open Academic Planner
                  </Link>
                </div>
              </div>
            </div>

            {/* Patch Notes Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Patch Notes</CardTitle>
                <CardDescription>Latest updates and improvements to the ComParEng Tools</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={orderedPatchNotes[0]?.version ?? "latest"}>
                  {/* Make the version tabs horizontally scrollable on small screens and contained within the card */}
                  <div className="mb-4 overflow-x-auto">
                    <TabsList className="min-w-full w-max flex-nowrap">
                      {orderedPatchNotes.map((note) => (
                        <TabsTrigger key={note.version} value={note.version} className="whitespace-nowrap">
                          {note.version}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {orderedPatchNotes.map((note) => (
                    <TabsContent key={note.version} value={note.version}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">{note.version}</h3>
                          <Badge variant="outline">{note.date}</Badge>
                        </div>
                        <ul className="space-y-2">
                          {note.changes.map((change, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span className="whitespace-pre-line">{change.description}</span>
                            </li>
                          ))}
                        </ul>
                        {note.hotfixes?.length ? (
                          <div className="mt-4 rounded-lg border border-amber-300/70 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
                            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-100">
                              Hotfixes
                            </p>
                            <div className="mt-3 space-y-3">
                              {note.hotfixes.map((hotfix) => (
                                <div key={hotfix.date}>
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">{hotfix.date}</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                                    {hotfix.items.map((item, idx) => (
                                      <li key={`${hotfix.date}-${idx}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
              <CardFooter className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <div>If you encounter any issues with the app, feel free to message them to our page.</div>
                <div>
                  <Dialog open={feedbackDialogOpen} onOpenChange={(open) => setFeedbackDialogOpen(open)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFeedbackDefaultSubject("")}
                      >
                        Send Feedback
                      </Button>
                    </DialogTrigger>
                    {/* Controlled feedback dialog */}
                    <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} defaultSubject={feedbackDefaultSubject} />
                  </Dialog>
                </div>
              </CardFooter>
            </Card>

            {/* About Section */}

            {/* Hello there! nyehehehe */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">About These Tools</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                These tools were created to help FEU Tech Computer Engineering students plan their academic journey more
                effectively. They are not officially affiliated with FEU Tech or the FEU Tech CpE Department.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <span className="signature-font credit-reveal inline-block mr-1">Created by France Estrella</span>
                For feedback or suggestions, please reach out via the{" "}
                <Button
                  variant="link"
                  className="text-blue-600 dark:text-blue-400 p-0 h-auto font-normal"
                  onClick={() => window.open("https://www.facebook.com/feutechCpEO", "_blank")}
                >
                  CpEO Page
                </Button>
                {/* Removed stray line */}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showJumpButton && (
          <motion.div
            key="home-floating-back-to-top"
            initial={{ opacity: 0, y: 22, scale: 0.9, rotate: -3 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 22, scale: 0.9, rotate: -3 }}
            transition={{ type: "spring", stiffness: 340, damping: 16 }}
            className="pointer-events-none fixed bottom-20 right-4 z-[10000] sm:bottom-16 sm:right-8 md:bottom-6 md:right-20 hidden md:block"
          >
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="pointer-events-auto shadow-lg shadow-slate-500/30"
              onClick={scrollToPageTop}
              aria-label="Back to top"
              asChild
            >
              <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="inline-flex items-center gap-1">
                <ArrowUp className="h-4 w-4" />
                Back to top
              </motion.span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
