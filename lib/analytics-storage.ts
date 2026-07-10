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
  maxEventTypes: number
}

const getState = (): AnalyticsState => {
  const g = globalThis as unknown as { __comparengAnalytics?: AnalyticsState }
  if (!g.__comparengAnalytics) {
    g.__comparengAnalytics = { counts: {}, recent: [], maxRecent: 500, maxEventTypes: 250 }
  }
  // Preserve compatibility with an already-warm instance created by an older build.
  g.__comparengAnalytics.maxEventTypes ??= 250
  return g.__comparengAnalytics
}

export const recordAnalyticsEvent = (event: AnalyticsEvent) => {
  const state = getState()
  const hasExistingKey = Object.prototype.hasOwnProperty.call(state.counts, event.name)
  const atCapacity = !hasExistingKey && Object.keys(state.counts).length >= state.maxEventTypes
  const key = atCapacity ? "analytics.other" : event.name
  state.counts[key] = (state.counts[key] ?? 0) + 1
  state.recent.unshift(atCapacity ? { ...event, name: key } : event)
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
