export type AnalyticsEvent = {
  name: string
  at: number
  path?: string
  meta?: Record<string, unknown>
}

export type AnalyticsSnapshot = {
  counts: Record<string, number>
  recent: AnalyticsEvent[]
}

type AnalyticsState = {
  counts: Record<string, number>
  recent: AnalyticsEvent[]
  maxRecent: number
}

const getState = (): AnalyticsState => {
  const g = globalThis as unknown as { __comparengAnalytics?: AnalyticsState }
  if (!g.__comparengAnalytics) {
    g.__comparengAnalytics = { counts: {}, recent: [], maxRecent: 500 }
  }
  return g.__comparengAnalytics
}

export const recordAnalyticsEvent = (event: AnalyticsEvent) => {
  const state = getState()
  const key = event.name
  state.counts[key] = (state.counts[key] ?? 0) + 1
  state.recent.unshift(event)
  if (state.recent.length > state.maxRecent) {
    state.recent.length = state.maxRecent
  }
}

export const getAnalyticsSnapshot = (): AnalyticsSnapshot => {
  const state = getState()
  return {
    counts: { ...state.counts },
    recent: state.recent.slice(0, 200),
  }
}

export const resetAnalytics = () => {
  const state = getState()
  state.counts = {}
  state.recent = []
}
