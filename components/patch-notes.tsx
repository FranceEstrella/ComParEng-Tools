"use client"

import { useEffect, useMemo, useState } from "react"
import { patchNotes } from "@/lib/patch-notes"
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

type Props = {
  autoOpenOnce?: boolean
  buttonLabel?: string
}

export default function PatchNotesButton({ autoOpenOnce = false, buttonLabel = "What’s New" }: Props) {
  const latest = useMemo(() => patchNotes[0], [])
  const [open, setOpen] = useState(false)

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

  if (!latest) return null

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-transparent">{buttonLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            v{latest.version} — {latest.title}
          </DialogTitle>
          <DialogDescription>{latest.date}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {latest.changes.map((c, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <Badge variant={c.type === "fixed" ? "secondary" : c.type === "new" ? "default" : "outline"}>
                {c.type}
              </Badge>
              <span>{c.description}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
