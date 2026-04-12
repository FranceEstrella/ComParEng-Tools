"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PreviewMode = "card" | "table"
type CourseStatus = "pending" | "active" | "passed"
type GradeValue = "1.00" | "1.25" | "1.50" | "2.00"

type PreviewCourse = {
  code: string
  title: string
  units: number
  prerequisites: string[]
  status: CourseStatus
  lastTaken?: string
}

const previewCourses: PreviewCourse[] = [
  {
    code: "CPE0009",
    title: "Discrete Mathematics for CpE",
    units: 3,
    prerequisites: ["COE0011"],
    status: "pending",
  },
  {
    code: "CPE0011",
    title: "Fundamentals of Electronic Circuits",
    units: 3,
    prerequisites: ["CPE0005"],
    status: "active",
    lastTaken: "Y2 • Term 1",
  },
  {
    code: "CPE0011L",
    title: "Fundamentals of Electronic Circuits (Lab)",
    units: 1,
    prerequisites: ["CPE0005"],
    status: "pending",
  },
  {
    code: "GED0043",
    title: "Specialized English Program 3",
    units: 3,
    prerequisites: ["GED0031"],
    status: "passed",
    lastTaken: "Y2 • Term 1",
  },
]

const statusClasses: Record<CourseStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/40",
  active: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-100 dark:border-blue-400/40",
  passed: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/40",
}

const gradeCycle: GradeValue[] = ["1.00", "1.25", "1.50", "2.00"]

function StatusPill({ status, compact = false }: { status: CourseStatus; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wide",
        compact ? "h-4.5 px-1.5 text-[9px]" : "h-5 px-2 text-[10px]",
        statusClasses[status]
      )}
    >
      {status}
    </span>
  )
}

export default function OnboardingCourseTrackerPreview() {
  const [mode, setMode] = useState<PreviewMode>("card")
  const [grades, setGrades] = useState<Record<string, GradeValue | null>>({
    CPE0011: "1.25",
    GED0043: "1.50",
  })

  const totals = useMemo(() => {
    const passed = previewCourses.filter((course) => course.status === "passed").length
    const active = previewCourses.filter((course) => course.status === "active").length
    const pending = previewCourses.filter((course) => course.status === "pending").length
    return { passed, active, pending }
  }, [])

  const handleAddGrade = (courseCode: string) => {
    setGrades((prev) => {
      const current = prev[courseCode]
      if (!current) {
        return { ...prev, [courseCode]: gradeCycle[0] }
      }
      const idx = gradeCycle.indexOf(current)
      const next = gradeCycle[(idx + 1) % gradeCycle.length]
      return { ...prev, [courseCode]: next }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900/75">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Course Tracker</p>
          <p className="text-[10px] text-muted-foreground">Preview both layouts used in the tracker.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "card" ? "default" : "outline"}
            className={cn(
              "h-6 px-2 text-[10px]",
              mode === "card" ? "bg-blue-600 text-white hover:bg-blue-500" : ""
            )}
            onClick={() => setMode("card")}
          >
            Version: Card
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "table" ? "default" : "outline"}
            className={cn(
              "h-6 px-2 text-[10px]",
              mode === "table" ? "bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900" : ""
            )}
            onClick={() => setMode("table")}
          >
            Version: Table
          </Button>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Passed {totals.passed}</Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Active {totals.active}</Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Pending {totals.pending}</Badge>
      </div>

      {mode === "card" ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {previewCourses.map((course) => (
            <div key={course.code} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">{course.code}</p>
                  <p className="line-clamp-2 text-[10px] text-muted-foreground">{course.title}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{course.units}U</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {course.prerequisites.map((prerequisite) => (
                  <span key={`${course.code}-${prerequisite}`} className="rounded-full border border-slate-300 px-1.5 py-0.5 text-[9px] text-slate-700 dark:border-white/20 dark:text-slate-200">
                    {prerequisite}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <StatusPill status={course.status} />
                <span className="text-[9px] text-muted-foreground">{course.lastTaken ?? "Not yet taken"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
          <div className="overflow-x-auto">
            <div className="min-w-[470px]">
              <div className="grid grid-cols-[84px_minmax(0,1.4fr)_28px_70px_64px_70px] bg-slate-100/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <span>Code</span>
                <span>Course</span>
                <span className="text-center">U</span>
                <span className="text-center">Status</span>
                <span className="text-center">Grade</span>
                <span className="text-right">Last taken</span>
              </div>
              {previewCourses.map((course) => (
                <div
                  key={`table-${course.code}`}
                  className="grid grid-cols-[84px_minmax(0,1.4fr)_28px_70px_64px_70px] items-center gap-1 border-t border-slate-200/90 px-2 py-1.5 text-[10px] text-slate-700 dark:border-white/10 dark:text-slate-200"
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{course.code}</span>
                  <span className="line-clamp-2 pr-1">{course.title}</span>
                  <span className="text-center">{course.units}</span>
                  <div className="flex justify-center">
                    <StatusPill status={course.status} compact />
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="inline-flex h-5 min-w-[48px] items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 text-[9px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                      onClick={() => handleAddGrade(course.code)}
                    >
                      {grades[course.code] ? (
                        <span>{grades[course.code]}</span>
                      ) : (
                        <>
                          <Plus className="h-2.5 w-2.5" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="truncate text-right text-[9px] text-muted-foreground">{course.lastTaken ?? "-"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
