"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type PlannerMode = "balanced" | "crucial" | "easy"

type PlanTerm = {
  term: string
  units: number
  courses: string[]
}

const modeMeta: Record<
  PlannerMode,
  {
    title: string
    subtitle: string
    description: string
    className: string
  }
> = {
  balanced: {
    title: "Balanced",
    subtitle: "Evenly distributes credit load",
    description:
      "Uses every remaining term while keeping credit totals as close as possible so you avoid heavy swings.",
    className:
      "border-slate-300 bg-slate-50 text-slate-800 dark:border-white/20 dark:bg-white/5 dark:text-slate-100",
  },
  crucial: {
    title: "Crucial Courses First",
    subtitle: "Pushes domino prerequisites early",
    description:
      "Prioritizes courses that unlock other requirements so prerequisite chains clear sooner.",
    className:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100",
  },
  easy: {
    title: "Easy Courses First",
    subtitle: "Stacks lighter courses upfront",
    description:
      "Schedules non-prerequisite courses first, then lands tougher dependency chains later.",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
}

const samplePlans: Record<PlannerMode, PlanTerm[]> = {
  balanced: [
    { term: "Y2 • Term 2", units: 18, courses: ["CPE0009", "CPE0011", "GED0043"] },
    { term: "Y3 • Term 1", units: 19, courses: ["CPE0033L", "COE0049", "CPE0025"] },
    { term: "Y3 • Term 2", units: 18, courses: ["CPE0029", "CPE0031", "OJT"] },
  ],
  crucial: [
    { term: "Y2 • Term 2", units: 20, courses: ["CPE0011", "CPE0011L", "COE0019"] },
    { term: "Y3 • Term 1", units: 19, courses: ["CPE0033L", "CPE0035", "COE0049"] },
    { term: "Y3 • Term 2", units: 16, courses: ["CPE0029", "CPE0031", "THS"] },
  ],
  easy: [
    { term: "Y2 • Term 2", units: 17, courses: ["GED0043", "GE Elective", "NSTP"] },
    { term: "Y3 • Term 1", units: 18, courses: ["CPE0009", "COE0019", "CPE0011"] },
    { term: "Y3 • Term 2", units: 20, courses: ["CPE0033L", "COE0049", "CPE0035"] },
  ],
}

const summaryByMode: Record<PlannerMode, { target: string; totalTerms: number; avgLoad: string }> = {
  balanced: { target: "S.Y. 2027-2028", totalTerms: 6, avgLoad: "18.3" },
  crucial: { target: "S.Y. 2027-2028", totalTerms: 6, avgLoad: "18.8" },
  easy: { target: "S.Y. 2027-2028", totalTerms: 7, avgLoad: "17.1" },
}

export default function OnboardingAcademicPlannerPreview() {
  const [mode, setMode] = useState<PlannerMode>("balanced")

  const summary = summaryByMode[mode]
  const plan = useMemo(() => samplePlans[mode], [mode])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900/75">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Academic Planner</p>
          <p className="text-[10px] text-muted-foreground">Preview planning modes, graduation summary, and sample plan.</p>
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        {(Object.keys(modeMeta) as PlannerMode[]).map((key) => {
          const item = modeMeta[key]
          const active = mode === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-left transition",
                item.className,
                active ? "ring-1 ring-offset-1 ring-slate-400 dark:ring-white/40" : "opacity-90 hover:opacity-100"
              )}
            >
              <p className="text-[11px] font-semibold">{item.title}</p>
              <p className="text-[10px]">{item.subtitle}</p>
            </button>
          )
        })}
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">{modeMeta[mode].description}</p>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
          <p className="text-muted-foreground">Target graduation</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{summary.target}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
          <p className="text-muted-foreground">Remaining terms</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{summary.totalTerms}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
          <p className="text-muted-foreground">Avg units/term</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{summary.avgLoad}</p>
        </div>
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between bg-slate-100/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
          <span>Sample graduation plan</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[9px]">{modeMeta[mode].title}</Badge>
        </div>
        {plan.map((term) => (
          <div key={term.term} className="border-t border-slate-200/90 px-2 py-1.5 text-[10px] dark:border-white/10">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{term.term}</p>
              <span className="text-muted-foreground">{term.units} units</span>
            </div>
            <p className="mt-0.5 text-muted-foreground">{term.courses.join(" • ")}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
