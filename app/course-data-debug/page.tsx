"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const COURSE_OFFERINGS_STORAGE_KEYS = [
  "comparengCourseOfferingsLatest",
  "comparengCourseDataLatest",
  "courseOfferingsPayload",
]

const formatTimestamp = (value: number) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

const parsePayload = (raw: string | null) => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { data: parsed, extractedAt: 0, term: null as string | null, schoolYear: null as string | null }
    }

    if (!parsed || typeof parsed !== "object") return null
    const data =
      Array.isArray((parsed as any).data)
        ? (parsed as any).data
        : Array.isArray((parsed as any).courses)
          ? (parsed as any).courses
          : Array.isArray((parsed as any).rows)
            ? (parsed as any).rows
            : null

    if (!data) return null

    return {
      data,
      extractedAt: Number((parsed as any).extractedAt || (parsed as any).updatedAt || (parsed as any).lastUpdated || 0),
      term: typeof (parsed as any).term === "string" ? (parsed as any).term : null,
      schoolYear: typeof (parsed as any).schoolYear === "string" ? (parsed as any).schoolYear : null,
      raw: parsed,
    }
  } catch {
    return null
  }
}

const readLocalCourseOfferings = () => {
  if (typeof window === "undefined") return null
  for (const key of COURSE_OFFERINGS_STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key)
    const parsed = parsePayload(raw)
    if (parsed) return { key, raw, parsed }
  }
  return null
}

export default function CourseDataDebugPage() {
  const [payload, setPayload] = useState<ReturnType<typeof readLocalCourseOfferings> | null>(null)

  const refresh = useCallback(() => {
    setPayload(readLocalCourseOfferings())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const summary = useMemo(() => {
    const parsed = payload?.parsed
    const data = Array.isArray(parsed?.data) ? parsed?.data : []
    return {
      count: data.length,
      extractedAt: parsed?.extractedAt ?? 0,
      term: parsed?.term ?? "-",
      schoolYear: parsed?.schoolYear ?? "-",
    }
  }, [payload])

  const json = payload?.parsed?.raw ?? payload?.parsed ?? payload

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Course Data Debug</h1>
          <p className="text-sm text-muted-foreground">
            Reads the same localStorage payload that Schedule Maker uses.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <span className="text-muted-foreground">Key:</span> {payload?.key ?? "-"}
          </div>
          <div>
            <span className="text-muted-foreground">Count:</span> {summary.count}
          </div>
          <div>
            <span className="text-muted-foreground">Extracted:</span> {formatTimestamp(summary.extractedAt)}
          </div>
          <div>
            <span className="text-muted-foreground">Term:</span> {summary.term}
          </div>
          <div>
            <span className="text-muted-foreground">School Year:</span> {summary.schoolYear}
          </div>
        </div>
        {!payload ? (
          <p className="text-sm text-muted-foreground">
            No local course payload found yet. Open the Course Offerings page with the extension running.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <pre className="overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(json, null, 2)}
        </pre>
      </div>
    </div>
  )
}
