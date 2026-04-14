"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { orderedPatchNotes } from "@/lib/patch-notes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Bot, RefreshCw, Sparkles, ShieldCheck, FileText, Wrench, AlertTriangle } from "lucide-react"

type Props = {
  autoOpenOnce?: boolean
  buttonLabel?: string
}

type MajorIntroStage = "hidden" | "icon" | "title" | "highlights" | "details" | "header"

const majorStageRank: Record<MajorIntroStage, number> = {
  hidden: 0,
  icon: 1,
  title: 2,
  highlights: 3,
  details: 4,
  header: 5,
}

export default function PatchNotesButton({ autoOpenOnce = false, buttonLabel = "What’s New" }: Props) {
  const latest = useMemo(() => orderedPatchNotes[0], [])
  const latestNonSilent = useMemo(() => orderedPatchNotes.find((note) => !note.silent), [])
  const [open, setOpen] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [showAllChanges, setShowAllChanges] = useState(false)
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 })
  const [confettiBursts, setConfettiBursts] = useState<number[]>([])
  const [activeVersion, setActiveVersion] = useState<string | undefined>(latest?.version)
  const [majorIntroStage, setMajorIntroStage] = useState<MajorIntroStage>("hidden")
  const explicitCloseRequested = useRef(false)
  const introCloseLocked = useRef(false)

  const activeNote = useMemo(() => {
    if (!activeVersion) return latest
    return orderedPatchNotes.find((note) => note.version === activeVersion) || latest
  }, [activeVersion, latest])

  useEffect(() => {
    if (!autoOpenOnce || !latestNonSilent) return
    try {
      const seen = localStorage.getItem("whatsNew.seenVersion")
      if (seen !== latestNonSilent.version) {
        setActiveVersion(latestNonSilent.version)
        setOpen(true)
        localStorage.setItem("whatsNew.seenVersion", latestNonSilent.version)
      }
    } catch {
      // ignore storage errors
    }
  }, [autoOpenOnce, latestNonSilent])

  useEffect(() => {
    const updateLayout = () => {
      const compact = window.innerWidth < 640
      setIsCompactLayout(compact)
      setShowAllChanges(!compact)
    }

    updateLayout()
    window.addEventListener("resize", updateLayout)
    return () => window.removeEventListener("resize", updateLayout)
  }, [])

  if (!activeNote) return null

  const changeLimit = 5
  const visibleChanges =
    isCompactLayout && !showAllChanges ? activeNote.changes.slice(0, changeLimit) : activeNote.changes
  const changeGroupMeta = {
    extension: { label: "Extension", icon: Bot },
    new: { label: "New", icon: Sparkles },
    improved: { label: "Improved", icon: Wrench },
    fixed: { label: "Fixed", icon: ShieldCheck },
    "known-issue": { label: "Known Issues", icon: AlertTriangle },
  } as const

  const groupedVisibleChanges = useMemo(() => {
    const groupOrder: Array<(typeof activeNote.changes)[number]["type"]> = ["extension", "new", "improved", "fixed", "known-issue"]

    return groupOrder
      .map((type) => ({
        type,
        label: changeGroupMeta[type].label,
        Icon: changeGroupMeta[type].icon,
        items: visibleChanges.filter((change) => change.type === type),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeNote.changes, changeGroupMeta, visibleChanges])
  const isMajorUpdate = Boolean(!activeNote.silent && latestNonSilent && activeNote.version === latestNonSilent.version)
  const isMajorStageActive = (stage: MajorIntroStage) => majorStageRank[majorIntroStage] >= majorStageRank[stage]
  const hasOverflowUpdates = isCompactLayout && activeNote.changes.length > changeLimit
  const useFixedMobileActions = isMajorUpdate && isCompactLayout && isMajorStageActive("details")
  const showFixedShowAll = hasOverflowUpdates && useFixedMobileActions
  const showCloseInActionBar = !isMajorUpdate || !isCompactLayout || isMajorStageActive("header")
  const showActionBar = !isMajorUpdate
    ? true
    : isCompactLayout
      ? isMajorStageActive("details") && (showFixedShowAll || showCloseInActionBar)
      : isMajorStageActive("header")
  const majorStageHeights = isCompactLayout
    ? {
        hidden: 220,
        icon: 220,
        title: 250,
        highlights: 430,
        details: 620,
        header: 680,
      }
    : {
        hidden: 240,
        icon: 240,
        title: 270,
        highlights: 470,
        details: 680,
        header: 760,
      }
  const majorTargetHeight = majorStageHeights[majorIntroStage]

  useEffect(() => {
    if (!open || !isMajorUpdate) {
      introCloseLocked.current = false
      setMajorIntroStage("hidden")
      return
    }

    introCloseLocked.current = true
    explicitCloseRequested.current = false

    setMajorIntroStage("icon")
    // Slower, more readable timing
    const titleTimer = window.setTimeout(() => {
      setMajorIntroStage("title")
    }, 850)
    const highlightsTimer = window.setTimeout(() => {
      setMajorIntroStage("highlights")
    }, 2100)
    const detailsTimer = window.setTimeout(() => {
      setMajorIntroStage("details")
    }, 4100)
    const headerTimer = window.setTimeout(() => {
      setMajorIntroStage("header")
    }, 5400)

    return () => {
      window.clearTimeout(titleTimer)
      window.clearTimeout(highlightsTimer)
      window.clearTimeout(headerTimer)
      window.clearTimeout(detailsTimer)
    }
  }, [open, isMajorUpdate, activeNote.version])

  useEffect(() => {
    if (majorIntroStage === "header") {
      introCloseLocked.current = false
    }
  }, [majorIntroStage])

  const majorHighlights = [
    {
      icon: <Bot className="h-5 w-5" />,
      label: "Extension automation",
      detail: "Offerings auto-refresh, grades auto-import, and active courses auto-add into Schedule Maker.",
    },
    {
      icon: <RefreshCw className="h-5 w-5" />,
      label: "SOLAR-OSES auto register",
      detail: "Selected Schedule Maker courses can now auto-register directly to SOLAR-OSES.",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Unified portability",
      detail: "Cross-tool import and export flows are now more consistent and easier to use.",
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: "Onboarding 2.0",
      detail: "Interactive previews and integrated FAQs make first-time setup clearer.",
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: "Planner clarity",
      detail: "Improved loading and refresh feedback during generation and data updates.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      label: "Security hardening",
      detail: "CORS handling and CSP nonce/policy updates improve integration stability and safety.",
    },
  ]

  const triggerConfetti = () => {
    if (!isMajorUpdate) return
    const id = Date.now()
    setConfettiBursts((prev) => [...prev, id])
    window.setTimeout(() => {
      setConfettiBursts((prev) => prev.filter((burst) => burst !== id))
    }, 2500)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Force version and lock immediately on open to avoid mobile trigger race conditions.
      if (latestNonSilent) {
        setActiveVersion(latestNonSilent.version)
        introCloseLocked.current = true
      }
      explicitCloseRequested.current = false
      setOpen(true)
      return
    }

    // Hard guard: never allow close before header stage during major-update sequence.
    if (!nextOpen && isMajorUpdate && majorIntroStage !== "header") {
      return
    }

    // Ignore all non-explicit dismiss paths while intro lock is active.
    if (!nextOpen && introCloseLocked.current && !explicitCloseRequested.current) {
      return
    }

    if (!nextOpen && open) {
      triggerConfetti()
    }

    if (nextOpen) {
      explicitCloseRequested.current = false
    }

    setOpen(nextOpen)
  }

  const handleCloseClick = () => {
    explicitCloseRequested.current = true
    introCloseLocked.current = false
    handleOpenChange(false)
  }

  return (
    <>
      {isMajorUpdate &&
        confettiBursts.map((burstId) => <ConfettiOverlay key={burstId} />)}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="bg-white/80 text-slate-900 border-slate-300 hover:bg-white dark:bg-white/10 dark:text-white dark:border-white/40 dark:hover:bg-white/20"
            onClick={() => setActiveVersion(latestNonSilent?.version ?? latest?.version)}
          >
            {buttonLabel}
          </Button>
        </DialogTrigger>
        <DialogContent
          hideCloseButton={isMajorUpdate && !isMajorStageActive("header")}
          className={cn(
            "overflow-hidden",
            isMajorUpdate ? "max-w-3xl" : "max-w-2xl",
            isMajorUpdate && "max-h-none sm:max-h-none",
            isMajorUpdate && "major-update-dialog-enter bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 text-white border-0 shadow-[0_20px_80px_rgba(16,185,129,0.35)]",
            isCompactLayout
              ? "w-[calc(100vw-1rem)] max-w-none rounded-2xl p-0"
              : "p-0",
            isMajorUpdate && isCompactLayout && "dialog-content-static-motion !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-[100svh] !max-w-none !rounded-none"
          )}
          style={
            isMajorUpdate
              ? {
                  height: isCompactLayout ? "100svh" : `${majorTargetHeight}px`,
                  transition: "height 1200ms cubic-bezier(0.22, 1, 0.36, 1)",
                  willChange: "height",
                  backgroundImage: `radial-gradient(circle at ${spotlight.x}% ${spotlight.y}%, rgba(16,185,129,0.4), transparent 45%), linear-gradient(135deg, #020617, #064e3b)`
                }
              : undefined
          }
          onMouseMove={(event) => {
            if (!isMajorUpdate) return
            const rect = event.currentTarget.getBoundingClientRect()
            const x = ((event.clientX - rect.left) / rect.width) * 100
            const y = ((event.clientY - rect.top) / rect.height) * 100
            setSpotlight({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) })
          }}
          onMouseLeave={() => {
            if (!isMajorUpdate) return
            setSpotlight({ x: 50, y: 50 })
          }}
          onPointerDownOutside={(event) => {
            if (isMajorUpdate && !isMajorStageActive("header")) {
              event.preventDefault()
            }
          }}
          onInteractOutside={(event) => {
            if (isMajorUpdate && !isMajorStageActive("header")) {
              event.preventDefault()
            }
          }}
          onEscapeKeyDown={(event) => {
            if (isMajorUpdate && !isMajorStageActive("header")) {
              event.preventDefault()
            }
          }}
        >
        <div
          className={cn(
            "[overscroll-behavior:contain] [scrollbar-width:thin] [scrollbar-gutter:stable] [scroll-behavior:smooth] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full",
            isMajorUpdate
              ? (isMajorStageActive("details") ? "overflow-y-auto" : "overflow-y-hidden")
              : "overflow-y-auto",
            isMajorUpdate ? "max-h-[90svh]" : "max-h-[85svh]",
            isMajorUpdate
              ? "[scrollbar-color:rgba(167,243,208,0.55)_transparent] [&::-webkit-scrollbar-thumb]:bg-emerald-200/45 [&::-webkit-scrollbar-thumb:hover]:bg-emerald-200/70"
              : "[scrollbar-color:rgba(148,163,184,0.55)_transparent] [&::-webkit-scrollbar-thumb]:bg-slate-300/70 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600/70 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400/80 dark:[&::-webkit-scrollbar-thumb:hover]:bg-slate-500/80",
            isCompactLayout ? "p-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]" : "p-6",
            isMajorUpdate && isCompactLayout && isMajorStageActive("header") && "[scrollbar-gutter:unset]"
          )}
        >
        {!isMajorUpdate && (
          <DialogHeader className={cn("mb-2", isCompactLayout && "items-center text-center")}
          >
            <DialogTitle>
              v{activeNote.version} — {activeNote.title}
            </DialogTitle>
            <DialogDescription className={cn(
              "text-sm pb-2",
              isCompactLayout && "mt-1 text-center"
            )}
            >
              {activeNote.date}
            </DialogDescription>
          </DialogHeader>
        )}
        {isMajorUpdate && (
          <>
            <div className={cn(
              "fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-[#0a2327] transition-all duration-500",
              isMajorStageActive("highlights") && "opacity-0 pointer-events-none",
              !isMajorStageActive("highlights") && "opacity-100"
            )}>
              {majorIntroStage === "icon" && (
                <Sparkles className="h-16 w-16 text-emerald-200 major-intro-icon-enter" />
              )}
              {majorIntroStage === "title" && (
                <span className="flex items-center gap-3 rounded-full border border-emerald-200/60 bg-[#0a2327] px-7 py-3 text-emerald-100/90 shadow-lg major-intro-pill-enter">
                  <Sparkles className="h-6 w-6 text-emerald-200 major-intro-icon-enter" />
                  <span className="text-lg font-semibold tracking-wide major-intro-text-enter">New Major Update!</span>
                </span>
              )}
            </div>

            <DialogHeader className={cn(
              "relative z-20 mb-2 w-full major-header-shell",
              isCompactLayout && "items-center text-center",
              isMajorUpdate && isCompactLayout && isMajorStageActive("header") && "sticky -top-8 z-30 -mx-4 px-4 pt-[calc(env(safe-area-inset-top,0px)+2rem)] pb-2 overflow-visible bg-gradient-to-b from-[#052a28] via-[#052a28]/95 to-transparent backdrop-blur-md before:pointer-events-none before:absolute before:content-[''] before:top-0 before:bottom-0 before:-left-4 before:w-4 before:bg-gradient-to-b before:from-[#052a28] before:via-[#052a28]/95 before:to-transparent after:pointer-events-none after:absolute after:content-[''] after:top-0 after:bottom-0 after:-right-6 after:w-6 after:bg-gradient-to-b after:from-[#052a28] after:via-[#052a28]/95 after:to-transparent",
              isMajorStageActive("header") ? "major-header-shell-open major-header-enter" : "major-header-shell-closed"
            )}
            >
              <DialogTitle className={cn(
                "text-emerald-200",
                isCompactLayout
                  ? "mx-auto flex w-full max-w-[19.5rem] items-start justify-center gap-1.5 text-left leading-tight"
                  : "flex items-center gap-1"
              )}>
                <Sparkles className={cn("animate-pulse shrink-0", isCompactLayout ? "mt-0.5 h-8 w-8" : "h-7 w-7")} />
                <span className={cn(isCompactLayout ? "pt-0.5" : "")}>v{activeNote.version} — {activeNote.title}</span>
              </DialogTitle>
              <DialogDescription className={cn(
                "text-sm text-emerald-100/80 pb-2",
                isCompactLayout && "mt-1 text-center"
              )}
              >
                {activeNote.date}
              </DialogDescription>
            </DialogHeader>

            {isMajorStageActive("highlights") && (
              <div className={cn(
                "relative z-10 mt-2 mb-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a2327] via-[#0a2327] to-emerald-900/60 p-6 text-white shadow-2xl transition-transform duration-500 ease-in-out",
                majorIntroStage === "highlights" && "major-highlights-focus",
                isMajorStageActive("details") && "major-highlights-lift",
                isCompactLayout && "max-h-72 overflow-y-auto px-4 [scrollbar-gutter:auto] [overscroll-behavior:contain] [scrollbar-width:none] [scroll-behavior:smooth] [&::-webkit-scrollbar]:w-0"
              )}>
                <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/80">Major Highlights</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {majorHighlights.map((item, index) => (
                    <div
                      key={item.label}
                      className="major-update-highlight-enter flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:border-emerald-200/60 hover:bg-emerald-500/10"
                      style={{ animationDelay: `${120 + index * 70}ms` }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-100 animate-[pulse_4s_ease-in-out_infinite]">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-xs text-emerald-50/80">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
        <div className={cn(
          isMajorUpdate
            ? (isMajorStageActive("details")
              ? (isCompactLayout ? "space-y-2 py-1" : "space-y-3 py-2")
              : "space-y-0 py-0")
            : (isCompactLayout ? "space-y-2 py-1" : "space-y-3 py-2"),
          isMajorUpdate && "major-details-shell",
          isMajorUpdate && isMajorStageActive("details") ? "major-details-shell-open" : "major-details-shell-closed"
        )}
          aria-label="Latest updates"
        >
          <div className="major-details-inner">
          {groupedVisibleChanges.map((group, groupIndex) => (
            <section
              key={group.type}
              className={cn(
                "space-y-2",
                groupIndex > 0 && "pt-3",
                isMajorUpdate && majorIntroStage === "details" && "major-note-group-enter"
              )}
              style={
                isMajorUpdate && majorIntroStage === "details"
                  ? { animationDelay: `${120 + groupIndex * 90}ms` }
                  : undefined
              }
            >
              <h4 className={cn(
                "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em]",
                isMajorUpdate
                  ? "text-emerald-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
                  : "text-slate-600 dark:text-slate-300"
              )}>
                <group.Icon className="h-3.5 w-3.5" />
                {group.label}
              </h4>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {group.items.map((item, index) => (
                  <li key={`${group.type}-${index}`} className="leading-snug whitespace-pre-line">
                    {item.description}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {hasOverflowUpdates && !useFixedMobileActions && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 rounded-full px-4 font-semibold",
                  isMajorUpdate
                    ? "border-emerald-200/80 bg-emerald-100 text-emerald-950 shadow-[0_6px_18px_rgba(16,185,129,0.28)] hover:bg-white"
                    : "border-slate-400 bg-slate-100 text-slate-900 hover:bg-slate-200"
                )}
                onClick={() => setShowAllChanges((prev) => !prev)}
              >
                {showAllChanges ? "Show fewer updates" : `Show all ${activeNote.changes.length} updates`}
              </Button>
            </div>
          )}
          </div>
        </div>
        {activeNote.hotfixes && activeNote.hotfixes.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-50">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-100">
              Hotfixes
            </p>
            <div className="mt-3 space-y-3">
              {activeNote.hotfixes.map((hotfix) => (
                <div key={hotfix.date}>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">{hotfix.date}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                    {hotfix.items.map((item, index) => (
                      <li key={`${hotfix.date}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-500",
          !showActionBar
            ? "max-h-0 opacity-0 pointer-events-none"
            : (useFixedMobileActions ? "max-h-40 opacity-100" : "max-h-16 opacity-100"),
          isMajorUpdate && isCompactLayout && isMajorStageActive("details") && "fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2 bg-gradient-to-t from-[#052a28] via-[#052a28]/95 to-transparent backdrop-blur"
        )}>
          {showFixedShowAll && (
            <div className="mb-2">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 w-full rounded-full px-4 font-semibold",
                  isMajorUpdate
                    ? "border-emerald-200/80 bg-emerald-100 text-emerald-950 shadow-[0_6px_18px_rgba(16,185,129,0.28)] hover:bg-white"
                    : "border-slate-400 bg-slate-100 text-slate-900 hover:bg-slate-200"
                )}
                onClick={() => setShowAllChanges((prev) => !prev)}
              >
                {showAllChanges ? "Show fewer updates" : `Show all ${activeNote.changes.length} updates`}
              </Button>
            </div>
          )}
          {showCloseInActionBar && (
            <DialogFooter className={cn(isCompactLayout && !useFixedMobileActions && "pt-2")}>
              <Button variant="outline" className={cn(isCompactLayout && "w-full")}
                onClick={handleCloseClick}
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </div>
        </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const confettiColors = ["#34d399", "#a7f3d0", "#fef08a", "#f9a8d4", "#c4b5fd", "#fde68a", "#bef264"]

const ConfettiOverlay = () => {
  const pieces = useMemo(() =>
    Array.from({ length: 70 }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.4 + Math.random() * 1.2,
      size: 8 + Math.random() * 10,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      rotation: Math.random() * 360,
      drift: (Math.random() - 0.5) * 40,
    })),
  [])

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden">
        {pieces.map((piece, idx) => (
          <span
            key={`${piece.left}-${idx}`}
            className="patch-notes-confetti absolute block"
            style={{
              left: `${piece.left}%`,
              top: "-10%",
              width: `${piece.size}px`,
              height: `${piece.size * 0.55}px`,
              backgroundColor: piece.color,
              borderRadius: "2px",
              transform: `rotate(${piece.rotation}deg)`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              ["--confetti-drift" as any]: `${piece.drift}px`,
            }}
          />
        ))}
      </div>
    </>
  )
}
