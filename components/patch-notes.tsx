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

type Props = {
  autoOpenOnce?: boolean
  buttonLabel?: string
}

export default function PatchNotesButton({ autoOpenOnce = false, buttonLabel = "What’s New" }: Props) {
  const latest = useMemo(() => orderedPatchNotes[0], [])
  const [open, setOpen] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [showAllChanges, setShowAllChanges] = useState(false)

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

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
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
          isCompactLayout ? "max-w-md w-[min(92vw,24rem)] p-4" : "p-6"
        )}
      >
        <DialogHeader>
          <DialogTitle>
            v{latest.version} — {latest.title}
          </DialogTitle>
          <DialogDescription>{latest.date}</DialogDescription>
        </DialogHeader>
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
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
