"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Megaphone, Sparkles, ShieldCheck, FileText } from "lucide-react"

type Props = {
  autoOpenOnce?: boolean
  buttonLabel?: string
}

export default function PatchNotesButton({ autoOpenOnce = false, buttonLabel = "What’s New" }: Props) {
  const latest = useMemo(() => orderedPatchNotes[0], [])
  const [open, setOpen] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [showAllChanges, setShowAllChanges] = useState(false)
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 })
  const [confettiBursts, setConfettiBursts] = useState<number[]>([])

  useEffect(() => {
    if (!autoOpenOnce || !latest) return
    try {
      const seen = localStorage.getItem("whatsNew.seenVersion")
      if (seen !== latest.version) {
        setOpen(true)
        localStorage.setItem("whatsNew.seenVersion", latest.version)
      }
    } catch {
      // ignore storage errors
    }
  }, [autoOpenOnce, latest])

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

  if (!latest) return null

  const changeLimit = 5
  const visibleChanges = isCompactLayout && !showAllChanges ? latest.changes.slice(0, changeLimit) : latest.changes
  const isMajorUpdate = latest.version === "1.45"

  const majorHighlights = [
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: "Guided onboarding",
      detail: "Context-aware confirmations ship with the very first tour release.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      label: "Course data safety",
      detail: "Grade history + timeline backups now travel with your downloads.",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Transcript PDF",
      detail: "Export a polished TOR with one click from Course Tracker.",
    },
    {
      icon: <Megaphone className="h-5 w-5" />,
      label: "Anytime feedback",
      detail: "New floating Report button follows you throughout the app.",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Installable app",
      detail: "ComParEng Tools now advertises PWA install so it feels native on desktop.",
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
    if (!nextOpen && open) {
      triggerConfetti()
    }
    setOpen(nextOpen)
  }

  const handleCloseClick = () => {
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
          >
            {buttonLabel}
          </Button>
        </DialogTrigger>
        <DialogContent
          className={cn(
            "max-w-2xl",
            isMajorUpdate && "bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 text-white border-0 shadow-[0_20px_80px_rgba(16,185,129,0.35)]",
            isCompactLayout
              ? "left-0 top-0 h-screen w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-6 pt-8"
              : "p-6"
          )}
          style={
            isMajorUpdate
              ? {
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
        >
        <DialogHeader className={cn(isCompactLayout && "items-center text-center")}
        >
          <DialogTitle className={cn(isMajorUpdate && "flex items-center gap-2 text-emerald-200")}
          >
            {isMajorUpdate && <Sparkles className="h-5 w-5 animate-pulse" />}
            v{latest.version} — {latest.title}
          </DialogTitle>
          <DialogDescription className={cn(
            "text-sm",
            isMajorUpdate && "text-emerald-100/80",
            isCompactLayout && "mt-1 text-center"
          )}
          >
            {latest.date}
          </DialogDescription>
        </DialogHeader>
        {isMajorUpdate && (
          <div
            className={cn(
              "mb-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-white shadow-inner",
              isCompactLayout && "max-h-64 overflow-y-auto pr-2"
            )}
          >
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">Major highlights</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {majorHighlights.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition hover:border-emerald-200/60 hover:bg-emerald-500/10"
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
        <div className={cn("py-2", isCompactLayout ? "space-y-2" : "space-y-3")}
          aria-label="Latest updates"
        >
          {visibleChanges.map((c, idx) => (
            <div key={`${c.type}-${idx}`} className="flex items-start gap-2 text-sm">
              <Badge variant={c.type === "fixed" ? "secondary" : c.type === "new" ? "default" : "outline"}>
                {c.type}
              </Badge>
              <span className="leading-snug text-sm">{c.description}</span>
            </div>
          ))}
          {isCompactLayout && latest.changes.length > changeLimit && (
            <div className="pt-1">
              <Button variant="link" size="sm" className="px-0" onClick={() => setShowAllChanges((prev) => !prev)}>
                {showAllChanges ? "Show fewer updates" : `Show all ${latest.changes.length} updates`}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseClick}>Close</Button>
        </DialogFooter>
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
      <style jsx global>{`
        @keyframes patchNotesConfetti {
          0% {
            transform: translate3d(0, -10%, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--confetti-drift, 0px), 115vh, 0) rotate(540deg);
            opacity: 0;
          }
        }
        .patch-notes-confetti {
          animation: patchNotesConfetti 2.2s ease-out forwards;
          --confetti-drift: 0px;
        }
      `}</style>
    </>
  )
}
