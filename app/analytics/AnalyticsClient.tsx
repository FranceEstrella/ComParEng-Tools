"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { AnalyticsSnapshot } from "@/lib/analytics-storage"
import {
  KeyRound,
  Lock,
  RefreshCw,
  Trash2,
  Activity,
  Sigma,
  ListOrdered,
  Clock,
  BarChart3,
  Route,
} from "lucide-react"

const KEY_STORAGE = "compareng.analytics.key"

const escapeHtml = (value: unknown) => {
  const s = String(value ?? "")
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const downloadTextFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const formatTimestampForFile = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

const formatCompact = (n: number) => {
  try {
    return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n)
  } catch {
    return String(n)
  }
}

const isUnauthorizedResponse = async (res: Response) => {
  if (res.status === 401) return true
  try {
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("application/json")) return false
    const body = (await res.json()) as any
    return body?.error === "Unauthorized"
  } catch {
    return false
  }
}

function MiniBars({ values, height = 44 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {values.map((v, idx) => (
        <div
          key={idx}
          className="w-2 rounded-sm bg-slate-300 dark:bg-slate-700"
          style={{ height: `${Math.max(2, Math.round((v / max) * height))}px` }}
          title={`${v}`}
        />
      ))}
    </div>
  )
}

function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-slate-500 dark:text-slate-400">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

export default function AnalyticsClient({ initialKey }: { initialKey?: string }) {
  const [keyInput, setKeyInput] = useState(initialKey ?? "")
  const [activeKey, setActiveKey] = useState(initialKey ?? "")
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const query = useMemo(() => {
    const k = activeKey?.trim()
    return k ? `?key=${encodeURIComponent(k)}` : ""
  }, [activeKey])

  const stopPolling = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startPolling = () => {
    stopPolling()
    intervalRef.current = window.setInterval(() => {
      fetchSnapshot().catch(() => {
        // handled in fetchSnapshot
      })
    }, 5000)
  }

  const applyKey = (next: string) => {
    const trimmed = next.trim()
    setActiveKey(trimmed)
    try {
      if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed)
      else localStorage.removeItem(KEY_STORAGE)
    } catch {
      // ignore storage failures
    }
  }

  const fetchSnapshot = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics${query}`, { cache: "no-store" })
      if (!res.ok) {
        const is401 = await isUnauthorizedResponse(res)
        if (is401) {
          setUnauthorized(true)
          setSnapshot(null)
          stopPolling()
          throw new Error("Unauthorized. Enter the analytics key to view this page.")
        }
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as AnalyticsSnapshot
      setSnapshot(data)
      setError(null)
      setUnauthorized(false)
      startPolling()
    } catch (e: any) {
      setSnapshot(null)
      setError(e?.message || "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  const reset = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics${query}`, { method: "DELETE" })
      if (!res.ok) {
        const is401 = await isUnauthorizedResponse(res)
        if (is401) {
          setUnauthorized(true)
          stopPolling()
          throw new Error("Unauthorized. Enter the analytics key to reset analytics.")
        }
        throw new Error(`HTTP ${res.status}`)
      }
      await fetchSnapshot()
    } catch (e: any) {
      setError(e?.message || "Failed to reset")
    } finally {
      setLoading(false)
    }
  }

  const exportHtml = () => {
    if (!snapshot) {
      setError("No analytics snapshot loaded yet. Click Refresh first.")
      return
    }

    const now = Date.now()
    const filename = `compareng-analytics-${formatTimestampForFile(now)}.html`

    const countsEntries = Object.entries(snapshot.counts ?? {}).sort((a, b) => b[1] - a[1])
    const total = Object.values(snapshot.counts ?? {}).reduce((a, b) => a + b, 0)
    const unique = Object.keys(snapshot.counts ?? {}).length
    const recent = snapshot.recent ?? []

    const activity = (() => {
      const hours = 24
      const buckets = Array.from({ length: hours }, () => 0)
      for (const evt of recent) {
        const ageHours = Math.floor((now - evt.at) / 3600000)
        if (ageHours < 0 || ageHours >= hours) continue
        const idx = hours - 1 - ageHours
        buckets[idx]++
      }
      return buckets
    })()

    const renderMiniBars = (values: number[]) => {
      const max = Math.max(1, ...values)
      return values
        .map((v) => {
          const h = Math.max(2, Math.round((v / max) * 44))
          return `<div class="bar" style="height:${h}px" title="${escapeHtml(v)}"></div>`
        })
        .join("")
    }

    const topEventsRows = countsEntries.slice(0, 8)
    const topMax = Math.max(1, ...topEventsRows.map(([, c]) => c))
    const renderTopEvents = () => {
      if (topEventsRows.length === 0) return `<div class="muted">No events yet.</div>`
      return topEventsRows
        .map(([name, count]) => {
          const pct = Math.max(2, Math.round((count / topMax) * 100))
          return `<div class="row">
  <div class="rowHead">
    <div class="name mono">${escapeHtml(name)}</div>
    <div class="badge">${escapeHtml(count)}</div>
  </div>
  <div class="meter"><div class="meterFill" style="width:${pct}%"></div></div>
</div>`
        })
        .join("\n")
    }

    const renderCountsList = () => {
      if (countsEntries.length === 0) return `<div class="muted">No events yet.</div>`
      return countsEntries
        .map(
          ([name, count]) =>
            `<div class="kv"><div class="k mono">${escapeHtml(name)}</div><div class="badge">${escapeHtml(count)}</div></div>`
        )
        .join("\n")
    }

    const renderRecentCards = () => {
      if (recent.length === 0) return `<div class="muted">No recent events.</div>`
      return recent
        .slice(0, 50)
        .map((evt) => {
          const when = new Date(evt.at).toLocaleString()
          const path = evt.path ? `<div class="muted mono">${escapeHtml(evt.path)}</div>` : ""
          return `<div class="eventCard">
  <div class="eventTop">
    <div class="eventName mono">${escapeHtml(evt.name)}</div>
    <div class="eventTime muted">${escapeHtml(when)}</div>
  </div>
  ${path}
</div>`
        })
        .join("\n")
    }

    const pathMap = new Map<string, number>()
    for (const evt of recent) {
      const p = evt.path || "(no path)"
      pathMap.set(p, (pathMap.get(p) ?? 0) + 1)
    }
    const topPaths = Array.from(pathMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    const renderTopPaths = () => {
      if (topPaths.length === 0) return `<div class="muted">No events yet.</div>`
      return topPaths
        .map(
          ([p, c]) =>
            `<div class="kv"><div class="k mono">${escapeHtml(p)}</div><div class="badge">${escapeHtml(c)}</div></div>`
        )
        .join("\n")
    }

    const renderKeyCountList = (items: Array<[string, number]>, empty: string) => {
      if (!items.length) return `<div class="muted">${escapeHtml(empty)}</div>`
      return items
        .map(
          ([k, v]) =>
            `<div class="kv"><div class="k">${escapeHtml(k)}</div><div class="v2">${escapeHtml(v)}</div></div>`
        )
        .join("\n")
    }

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Analytics</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f9fafb;
        --fg: #111827;
        --muted: #6b7280;
        --card: #ffffff;
        --border: #e5e7eb;
        --pill: #f1f5f9;
        --pill-fg: #0f172a;
        --bar: #cbd5e1;
        --bar-strong: #94a3b8;
        --meter: #e2e8f0;
        --meterFill: #94a3b8;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #111827;
          --fg: #f9fafb;
          --muted: #9ca3af;
          --card: #0b1220;
          --border: #1f2937;
          --pill: #111827;
          --pill-fg: #e5e7eb;
          --bar: #334155;
          --bar-strong: #475569;
          --meter: #1f2937;
          --meterFill: #475569;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      .container {
        max-width: 56rem;
        margin: 0 auto;
        padding: 40px 16px;
      }
      h1 { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
      .subtitle { margin-top: 6px; font-size: 13px; color: var(--muted); }
      .muted { color: var(--muted); }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .space6 { height: 24px; }
      .space4 { height: 16px; }
      .grid2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
      .grid4 { display: grid; grid-template-columns: 1fr; gap: 12px; }
      @media (min-width: 768px) {
        .grid2 { grid-template-columns: 1fr 1fr; }
        .grid4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
      }
      .cardHead {
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .cardTitle { font-size: 16px; font-weight: 700; }
      .cardBody { padding: 14px 16px; }
      .pillRow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--pill);
        color: var(--pill-fg);
        border: 1px solid var(--border);
        font-size: 12px;
      }
      .stats {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
      }
      .statsK { font-size: 12px; color: var(--muted); }
      .statsV { margin-top: 8px; font-size: 22px; font-weight: 800; line-height: 1; }
      .statsS { margin-top: 6px; font-size: 12px; color: var(--muted); }
      .bars { display: flex; align-items: flex-end; gap: 4px; height: 44px; }
      .bar { width: 8px; background: var(--bar); border-radius: 3px; }
      .sectionTitle { font-size: 16px; font-weight: 800; margin: 0 0 10px; }
      .row { margin-bottom: 10px; }
      .rowHead { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .name { font-size: 13px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        border: 1px solid var(--border);
        background: var(--pill);
        color: var(--pill-fg);
        flex: 0 0 auto;
      }
      .meter { height: 8px; border-radius: 999px; background: var(--meter); overflow: hidden; margin-top: 6px; }
      .meterFill { height: 100%; background: var(--meterFill); }
      .kv { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
      .k { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .v2 { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
      .eventList { max-height: 28rem; overflow: auto; padding-right: 6px; }
      .eventCard { border: 1px solid var(--border); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
      .eventTop { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .eventName { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .eventTime { font-size: 12px; }
      details { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--card); }
      summary { cursor: pointer; font-weight: 700; }
      pre { margin: 10px 0 0; padding: 10px; border-radius: 10px; background: rgba(128,128,128,.10); overflow: auto; }
      .insightsGrid { display: grid; grid-template-columns: 1fr; gap: 12px; }
      @media (min-width: 768px) { .insightsGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      .subCard { border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
      .subTitle { font-size: 12px; color: var(--muted); }
      .subLine { margin-top: 6px; font-size: 13px; }
      .subStrong { font-weight: 800; }
      .miniHead { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Analytics</h1>
      <div class="subtitle">Hidden page export. Generated: ${escapeHtml(new Date(now).toLocaleString())}</div>

      <div class="space6"></div>

      <div class="card">
        <div class="cardHead">
          <div class="cardTitle">Access</div>
          <div class="pillRow">
            <span class="pill">Key: ${escapeHtml(activeKey.trim() ? "present" : "none")}</span>
            <span class="pill">Unauthorized: ${escapeHtml(unauthorized ? "yes" : "no")}</span>
          </div>
        </div>
        <div class="cardBody">
          <div class="muted" style="font-size:12px;">This file contains a snapshot of in-memory analytics at export time.</div>
        </div>
      </div>

      <div class="space4"></div>

      <div class="grid4">
        <div class="stats"><div class="statsK">Total events</div><div class="statsV">${escapeHtml(total)}</div><div class="statsS">All-time (in-memory)</div></div>
        <div class="stats"><div class="statsK">Unique event types</div><div class="statsV">${escapeHtml(unique)}</div><div class="statsS">Distinct names</div></div>
        <div class="stats"><div class="statsK">Last event</div><div class="statsV">${escapeHtml(totals.lastAt ? new Date(totals.lastAt).toLocaleTimeString() : "—")}</div><div class="statsS">${escapeHtml(totals.lastAt ? new Date(totals.lastAt).toLocaleDateString() : "No events")}</div></div>
        <div class="stats"><div class="statsK">Activity (24h)</div><div class="statsV">${escapeHtml(activity.reduce((a, b) => a + b, 0))}</div><div class="statsS">From recent buffer</div></div>
      </div>

      <div class="space6"></div>

      <div class="grid2">
        <div class="card">
          <div class="cardHead"><div class="cardTitle">Activity (last 24 hours)</div></div>
          <div class="cardBody">
            ${recent.length ? `<div class="bars">${renderMiniBars(activity)}</div><div class="miniHead"><span>24h ago</span><span>now</span></div>` : `<div class="muted">No events yet.</div>`}
          </div>
        </div>
        <div class="card">
          <div class="cardHead"><div class="cardTitle">Top events</div></div>
          <div class="cardBody">
            ${renderTopEvents()}
          </div>
        </div>
      </div>

      <div class="space6"></div>

      <div class="card">
        <div class="cardHead"><div class="cardTitle">Insights</div></div>
        <div class="cardBody">
          <div class="insightsGrid">
            <div class="subCard">
              <div class="subTitle">Course Tracker</div>
              <div class="subLine">Curriculum imports: <span class="subStrong">${escapeHtml(insights.rawCounts.courseTrackerCurriculumImportSuccess)}</span> ok / <span class="subStrong">${escapeHtml(insights.rawCounts.courseTrackerCurriculumImportFailed)}</span> failed</div>
              <div class="subLine">Download progress: <span class="subStrong">${escapeHtml(insights.rawCounts.courseTrackerDownloadProgressClicks)}</span> clicks / <span class="subStrong">${escapeHtml(insights.rawCounts.courseTrackerDownloadProgressSuccess)}</span> success</div>
              <div class="subLine">Avg starting year: <span class="subStrong">${escapeHtml(insights.courseTrackerStartYear.avg === null ? "N/A" : insights.courseTrackerStartYear.avg.toFixed(1))}</span> <span class="muted">(n=${escapeHtml(insights.courseTrackerStartYear.n)})</span></div>
            </div>

            <div class="subCard">
              <div class="subTitle">Schedule Maker</div>
              <div class="subLine">Download schedule image: <span class="subStrong">${escapeHtml(insights.rawCounts.scheduleMakerDownloadImageSuccess)}</span> success</div>
              <div class="subLine">Export to calendar (ICS): <span class="subStrong">${escapeHtml(insights.rawCounts.scheduleMakerDownloadIcsSuccess)}</span> success</div>
              <div class="subLine">Add to SOLAR-OSES: <span class="subStrong">${escapeHtml(insights.rawCounts.scheduleMakerOpenSolarOsesClicks)}</span> clicks</div>
              <div class="subLine">Avg versions per term: <span class="subStrong">${escapeHtml(insights.scheduleMakerVersions.avg === null ? "N/A" : insights.scheduleMakerVersions.avg.toFixed(2))}</span> <span class="muted">(n=${escapeHtml(insights.scheduleMakerVersions.n)})</span></div>
              <div class="subLine">Selected courses: <span class="subStrong">${escapeHtml(insights.rawCounts.scheduleMakerExportSelectedSuccess)}</span> exports / <span class="subStrong">${escapeHtml(insights.rawCounts.scheduleMakerImportSelectedResult)}</span> imports</div>
            </div>

            <div class="subCard">
              <div class="subTitle">Academic Planner</div>
              <div class="subLine">Plans: <span class="subStrong">${escapeHtml(insights.rawCounts.plannerExportPlanSuccess)}</span> exports / <span class="subStrong">${escapeHtml(insights.rawCounts.plannerImportPlanSuccess)}</span> imports</div>
              <div class="subLine">Apply profile clicks: <span class="subStrong">${escapeHtml(insights.rawCounts.plannerApplyProfileClicks)}</span></div>
              <div class="space4"></div>
              <div class="subTitle">Profile usage (applied)</div>
              ${renderKeyCountList(insights.plannerAppliedProfiles, "No apply events yet.")}
              <div class="space4"></div>
              <div class="subTitle">Profile taps (selected)</div>
              ${renderKeyCountList(insights.plannerSelectedProfiles, "No selection events yet.")}
            </div>
          </div>

          <div class="space4"></div>

          <div class="grid2">
            <div class="subCard">
              <div class="subTitle">General</div>
              <div class="subLine">Feedback: <span class="subStrong">${escapeHtml(insights.rawCounts.feedbackSuccess)}</span> sent / <span class="subStrong">${escapeHtml(insights.rawCounts.feedbackFailed)}</span> failed</div>
              <div class="subLine">Onboarding: <span class="subStrong">${escapeHtml(insights.onboarding.completed)}</span> completed / <span class="subStrong">${escapeHtml(insights.onboarding.notCompletedEstimate)}</span> not completed (estimate)</div>
            </div>
            <div class="subCard">
              <div class="subTitle">Theme preference (from toggles)</div>
              ${renderKeyCountList(insights.themeToggles, "No theme toggle events yet.")}
            </div>
          </div>

          <div class="space4"></div>
          <div class="muted" style="font-size:12px;">Averages and breakdowns are computed from the “Recent” buffer (up to 200 events).</div>
        </div>
      </div>

      <div class="space6"></div>

      <div class="grid2">
        <div class="card">
          <div class="cardHead"><div class="cardTitle">Counts</div></div>
          <div class="cardBody">
            ${renderCountsList()}
          </div>
        </div>
        <div class="card">
          <div class="cardHead"><div class="cardTitle">Recent</div></div>
          <div class="cardBody">
            <div class="eventList">
              ${renderRecentCards()}
            </div>
          </div>
        </div>
      </div>

      <div class="space4"></div>

      <div class="card">
        <div class="cardHead"><div class="cardTitle">Top paths (recent)</div></div>
        <div class="cardBody">
          ${renderTopPaths()}
        </div>
      </div>

      <div class="space6"></div>

      <details>
        <summary>Raw snapshot JSON</summary>
        <pre class="mono">${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>
      </details>
    </div>
  </body>
</html>`

    downloadTextFile(filename, html, "text/html;charset=utf-8")
  }

  useEffect(() => {
    // Prefer URL-provided key, otherwise fall back to localStorage.
    try {
      const stored = localStorage.getItem(KEY_STORAGE)
      if (!initialKey && stored && !activeKey) {
        setKeyInput(stored)
        setActiveKey(stored)
      }
      if (initialKey) {
        localStorage.setItem(KEY_STORAGE, initialKey)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchSnapshot()
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const entries = useMemo(() => {
    const counts = snapshot?.counts ?? {}
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [snapshot])

  const totals = useMemo(() => {
    const counts = snapshot?.counts ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const unique = Object.keys(counts).length
    const lastAt = snapshot?.recent?.[0]?.at
    return { total, unique, lastAt }
  }, [snapshot])

  const activityLast24h = useMemo(() => {
    const recent = snapshot?.recent ?? []
    const now = Date.now()
    const hours = 24
    const buckets = Array.from({ length: hours }, () => 0)
    for (const evt of recent) {
      const ageHours = Math.floor((now - evt.at) / 3600000)
      if (ageHours < 0 || ageHours >= hours) continue
      const idx = hours - 1 - ageHours
      buckets[idx]++
    }
    return buckets
  }, [snapshot])

  const topEvents = useMemo(() => entries.slice(0, 8), [entries])

  const pathBreakdown = useMemo(() => {
    const recent = snapshot?.recent ?? []
    const map = new Map<string, number>()
    for (const evt of recent) {
      const p = evt.path || "(no path)"
      map.set(p, (map.get(p) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [snapshot])

  const insights = useMemo(() => {
    const recent = snapshot?.recent ?? []
    const counts = snapshot?.counts ?? {}

    const sumAvg = (items: number[]) => {
      if (items.length === 0) return null
      return items.reduce((a, b) => a + b, 0) / items.length
    }

    const numericMeta = (name: string, key: string) => {
      const values: number[] = []
      recent.forEach((evt) => {
        if (evt.name !== name) return
        const raw = evt.meta?.[key]
        if (typeof raw === "number" && Number.isFinite(raw)) values.push(raw)
      })
      return { n: values.length, avg: sumAvg(values) }
    }

    const countByMeta = (name: string, key: string) => {
      const map = new Map<string, number>()
      recent.forEach((evt) => {
        if (evt.name !== name) return
        const raw = evt.meta?.[key]
        if (typeof raw !== "string") return
        map.set(raw, (map.get(raw) ?? 0) + 1)
      })
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    }

    const courseTrackerStartYear = numericMeta("course_tracker.start_year_set", "year")
    const scheduleMakerVersions = numericMeta("schedule_maker.versions_count", "count")
    const plannerAppliedProfiles = countByMeta("academic_planner.apply_profile_success", "strategy")
    const plannerSelectedProfiles = countByMeta("academic_planner.profile_select", "strategy")
    const themeToggles = countByMeta("theme.toggle", "to")

    const onboardingOpened = counts["onboarding.open"] ?? 0
    const onboardingCompleted = counts["onboarding.complete"] ?? 0
    const onboardingNotCompletedEstimate = Math.max(0, onboardingOpened - onboardingCompleted)

    return {
      courseTrackerStartYear,
      scheduleMakerVersions,
      plannerAppliedProfiles,
      plannerSelectedProfiles,
      themeToggles,
      onboarding: {
        opened: onboardingOpened,
        completed: onboardingCompleted,
        notCompletedEstimate: onboardingNotCompletedEstimate,
      },
      rawCounts: {
        courseTrackerCurriculumImportSuccess: counts["course_tracker.curriculum_import_success"] ?? 0,
        courseTrackerCurriculumImportFailed: counts["course_tracker.curriculum_import_failed"] ?? 0,
        courseTrackerDownloadProgressClicks: counts["course_tracker.download_progress_click"] ?? 0,
        courseTrackerDownloadProgressSuccess: counts["course_tracker.download_progress_success"] ?? 0,
        scheduleMakerDownloadImageSuccess: counts["schedule_maker.download_image_success"] ?? 0,
        scheduleMakerDownloadIcsSuccess: counts["schedule_maker.download_ics_success"] ?? 0,
        scheduleMakerOpenSolarOsesClicks: counts["schedule_maker.open_solar_oses_click"] ?? 0,
        scheduleMakerExportSelectedSuccess: counts["schedule_maker.export_selected_courses_success"] ?? 0,
        scheduleMakerImportSelectedResult: counts["schedule_maker.import_selected_courses_result"] ?? 0,
        plannerExportPlanSuccess: counts["academic_planner.export_plan_success"] ?? 0,
        plannerImportPlanSuccess: counts["academic_planner.import_plan_success"] ?? 0,
        plannerApplyProfileClicks: counts["academic_planner.apply_profile_click"] ?? 0,
        feedbackSuccess: counts["feedback.send_success"] ?? 0,
        feedbackFailed: counts["feedback.send_failed"] ?? 0,
      },
    }
  }, [snapshot])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Hidden page. If you set `ANALYTICS_KEY`, open with `?key=...`.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Access</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchSnapshot} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportHtml} disabled={!snapshot || loading}>
                Export HTML
              </Button>
              <Button variant="destructive" size="sm" onClick={reset} disabled={loading}>
                <Trash2 className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-sm font-medium sm:w-24 flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Key
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={unauthorized ? "Required" : "(optional)"}
                  className="sm:max-w-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyKey(keyInput)
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => applyKey(keyInput)}
                    disabled={loading || keyInput.trim() === activeKey.trim()}
                  >
                    Apply
                  </Button>
                  {activeKey.trim() ? (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      unlocked
                    </Badge>
                  ) : (
                    <Badge variant="outline">no key</Badge>
                  )}
                </div>
              </div>
            </div>
            {error ? <div className="text-sm text-red-500">{error}</div> : null}
            {unauthorized ? (
              <div className="text-xs text-muted-foreground">
                Set the server env var `ANALYTICS_KEY` and then enter it here (or open the page with `?key=...`).
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Total events"
            value={formatCompact(totals.total)}
            sub="All-time (in-memory)"
            icon={<Sigma className="h-5 w-5" />}
          />
          <StatCard
            title="Unique event types"
            value={formatCompact(totals.unique)}
            sub="Distinct names"
            icon={<ListOrdered className="h-5 w-5" />}
          />
          <StatCard
            title="Last event"
            value={totals.lastAt ? new Date(totals.lastAt).toLocaleTimeString() : "—"}
            sub={totals.lastAt ? new Date(totals.lastAt).toLocaleDateString() : "No events"}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Activity (24h)"
            value={formatCompact(activityLast24h.reduce((a, b) => a + b, 0))}
            sub="From recent buffer"
            icon={<Activity className="h-5 w-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Activity (last 24 hours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot?.recent?.length ? (
                <div className="space-y-2">
                  <MiniBars values={activityLast24h} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>24h ago</span>
                    <span>now</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No events yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events yet.</div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(1, ...topEvents.map(([, c]) => c))
                    return topEvents.map(([name, count]) => (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                        <div className="h-2 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-slate-400 dark:bg-slate-600"
                            style={{ width: `${Math.max(2, Math.round((count / max) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-muted-foreground">Course Tracker</div>
                  <div className="mt-2 text-sm">Curriculum imports: <span className="font-semibold">{insights.rawCounts.courseTrackerCurriculumImportSuccess}</span> ok / <span className="font-semibold">{insights.rawCounts.courseTrackerCurriculumImportFailed}</span> failed</div>
                  <div className="mt-1 text-sm">Download progress: <span className="font-semibold">{insights.rawCounts.courseTrackerDownloadProgressClicks}</span> clicks / <span className="font-semibold">{insights.rawCounts.courseTrackerDownloadProgressSuccess}</span> success</div>
                  <div className="mt-1 text-sm">Avg starting year: <span className="font-semibold">{insights.courseTrackerStartYear.avg === null ? "N/A" : insights.courseTrackerStartYear.avg.toFixed(1)}</span> <span className="text-xs text-muted-foreground">(n={insights.courseTrackerStartYear.n})</span></div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-muted-foreground">Schedule Maker</div>
                  <div className="mt-2 text-sm">Download schedule image: <span className="font-semibold">{insights.rawCounts.scheduleMakerDownloadImageSuccess}</span> success</div>
                  <div className="mt-1 text-sm">Export to calendar (ICS): <span className="font-semibold">{insights.rawCounts.scheduleMakerDownloadIcsSuccess}</span> success</div>
                  <div className="mt-1 text-sm">Add to SOLAR-OSES: <span className="font-semibold">{insights.rawCounts.scheduleMakerOpenSolarOsesClicks}</span> clicks</div>
                  <div className="mt-1 text-sm">Avg versions per term: <span className="font-semibold">{insights.scheduleMakerVersions.avg === null ? "N/A" : insights.scheduleMakerVersions.avg.toFixed(2)}</span> <span className="text-xs text-muted-foreground">(n={insights.scheduleMakerVersions.n})</span></div>
                  <div className="mt-1 text-sm">Selected courses: <span className="font-semibold">{insights.rawCounts.scheduleMakerExportSelectedSuccess}</span> exports / <span className="font-semibold">{insights.rawCounts.scheduleMakerImportSelectedResult}</span> imports</div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-muted-foreground">Academic Planner</div>
                  <div className="mt-2 text-sm">Plans: <span className="font-semibold">{insights.rawCounts.plannerExportPlanSuccess}</span> exports / <span className="font-semibold">{insights.rawCounts.plannerImportPlanSuccess}</span> imports</div>
                  <div className="mt-1 text-sm">Apply profile clicks: <span className="font-semibold">{insights.rawCounts.plannerApplyProfileClicks}</span></div>
                  <div className="mt-2 text-xs text-muted-foreground">Profile usage (applied)</div>
                  {insights.plannerAppliedProfiles.length ? (
                    <div className="mt-1 space-y-1">
                      {insights.plannerAppliedProfiles.map(([strategy, count]) => (
                        <div key={strategy} className="flex items-center justify-between text-sm">
                          <span className="truncate">{strategy}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-muted-foreground">No apply events yet.</div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">Profile taps (selected)</div>
                  {insights.plannerSelectedProfiles.length ? (
                    <div className="mt-1 space-y-1">
                      {insights.plannerSelectedProfiles.map(([strategy, count]) => (
                        <div key={strategy} className="flex items-center justify-between text-sm">
                          <span className="truncate">{strategy}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-muted-foreground">No selection events yet.</div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-muted-foreground">General</div>
                  <div className="mt-2 text-sm">Feedback: <span className="font-semibold">{insights.rawCounts.feedbackSuccess}</span> sent / <span className="font-semibold">{insights.rawCounts.feedbackFailed}</span> failed</div>
                  <div className="mt-1 text-sm">Onboarding: <span className="font-semibold">{insights.onboarding.completed}</span> completed / <span className="font-semibold">{insights.onboarding.notCompletedEstimate}</span> not completed (estimate)</div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-muted-foreground">Theme preference (from toggles)</div>
                  {insights.themeToggles.length ? (
                    <div className="mt-2 space-y-1">
                      {insights.themeToggles.map(([mode, count]) => (
                        <div key={mode} className="flex items-center justify-between text-sm">
                          <span className="truncate">{mode}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">No theme toggle events yet.</div>
                  )}
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Averages and breakdowns are computed from the “Recent” buffer (up to 200 events).
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Counts</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events yet.</div>
              ) : (
                <div className="space-y-2">
                  {entries.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium truncate">{name}</div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent</CardTitle>
            </CardHeader>
            <CardContent>
              {!snapshot?.recent?.length ? (
                <div className="text-sm text-muted-foreground">No recent events.</div>
              ) : (
                <div className="space-y-2 max-h-[28rem] overflow-auto pr-2">
                  {snapshot.recent.slice(0, 50).map((evt, idx) => (
                    <div key={`${evt.at}-${idx}`} className="rounded-md border border-slate-200 dark:border-slate-800 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">{evt.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(evt.at).toLocaleString()}</div>
                      </div>
                      {evt.path ? <div className="text-xs text-muted-foreground">{evt.path}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Route className="h-5 w-5" />
                Top paths (recent)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pathBreakdown.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events yet.</div>
              ) : (
                <div className="space-y-2">
                  {pathBreakdown.map(([p, count]) => (
                    <div key={p} className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium truncate">{p}</div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
