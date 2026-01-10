"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type AnalyticsEvent = {
  name: string
  at: number
  path?: string
  meta?: Record<string, unknown>
}

type AnalyticsSnapshot = {
  counts: Record<string, number>
  recent: AnalyticsEvent[]
}

export default function AnalyticsClient({ initialKey }: { initialKey?: string }) {
  const [key, setKey] = useState(initialKey ?? "")
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const query = useMemo(() => {
    const k = key?.trim()
    return k ? `?key=${encodeURIComponent(k)}` : ""
  }, [key])

  const fetchSnapshot = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics${query}`, { cache: "no-store" })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as AnalyticsSnapshot
      setSnapshot(data)
      setError(null)
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchSnapshot()
    } catch (e: any) {
      setError(e?.message || "Failed to reset")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSnapshot()
    const id = window.setInterval(fetchSnapshot, 5000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const entries = useMemo(() => {
    const counts = snapshot?.counts ?? {}
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
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
                Refresh
              </Button>
              <Button variant="destructive" size="sm" onClick={reset} disabled={loading}>
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="text-sm font-medium sm:w-24">Key</div>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="(optional)" className="sm:max-w-sm" />
            </div>
            {error ? <div className="text-sm text-red-500">{error}</div> : null}
          </CardContent>
        </Card>

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
        </div>
      </div>
    </div>
  )
}
