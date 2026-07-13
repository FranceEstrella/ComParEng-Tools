import { getRedisConfig, type RedisConfig } from "@/lib/server/upstash"

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

type UpstashResult = { result?: unknown; error?: string }

const ANALYTICS_COUNTS_KEY = "compareng:analytics:counts"
const ANALYTICS_RECENT_KEY = "compareng:analytics:recent"
const ANALYTICS_MAX_RECENT = 500
const ANALYTICS_MAX_EVENT_TYPES = 250
const ANALYTICS_SNAPSHOT_RECENT_LIMIT = 200

const globalState = globalThis as typeof globalThis & {
  __comparengAnalytics?: AnalyticsState
  __comparengAnalyticsStoreWarningShown?: boolean
}

const getState = (): AnalyticsState => {
  if (!globalState.__comparengAnalytics) {
    globalState.__comparengAnalytics = { counts: {}, recent: [], maxRecent: ANALYTICS_MAX_RECENT, maxEventTypes: ANALYTICS_MAX_EVENT_TYPES }
  }
  globalState.__comparengAnalytics.maxEventTypes ??= ANALYTICS_MAX_EVENT_TYPES
  globalState.__comparengAnalytics.maxRecent ??= ANALYTICS_MAX_RECENT
  return globalState.__comparengAnalytics
}

function warnAboutAnalyticsStore(message: string) {
  if (globalState.__comparengAnalyticsStoreWarningShown) return
  globalState.__comparengAnalyticsStoreWarningShown = true
  console.error(`[analytics] ${message}`)
}

function recordMemoryAnalyticsEvent(event: AnalyticsEvent) {
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

function getMemoryAnalyticsSnapshot(): AnalyticsSnapshot {
  const state = getState()
  return {
    counts: { ...state.counts },
    recent: state.recent.slice(0, ANALYTICS_SNAPSHOT_RECENT_LIMIT),
  }
}

function resetMemoryAnalytics() {
  const state = getState()
  state.counts = {}
  state.recent = []
}

async function upstashTransaction(config: RedisConfig, commands: unknown[][]): Promise<UpstashResult[]> {
  const response = await fetch(`${config.url}/multi-exec`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(2_500),
  })

  if (!response.ok) {
    throw new Error(`Analytics store returned HTTP ${response.status}`)
  }

  const results = (await response.json()) as UpstashResult[] | { error?: string }
  if (!Array.isArray(results)) {
    throw new Error("Analytics store returned an invalid response")
  }
  if (results.some((item) => item?.error)) {
    throw new Error("Analytics store returned an error")
  }

  return results
}

function parseRecentEvents(value: unknown): AnalyticsEvent[] {
  if (!Array.isArray(value)) return []
  const events: AnalyticsEvent[] = []

  for (const item of value) {
    if (typeof item !== "string") continue
    try {
      const parsed = JSON.parse(item) as AnalyticsEvent
      if (parsed && typeof parsed.name === "string" && typeof parsed.at === "number") {
        events.push(parsed)
      }
    } catch {
      continue
    }
  }

  return events
}

function parseCounts(value: unknown): Record<string, number> {
  if (!Array.isArray(value)) return {}

  const counts: Record<string, number> = {}
  for (let index = 0; index + 1 < value.length; index += 2) {
    const key = value[index]
    const rawCount = value[index + 1]
    if (typeof key !== "string") continue

    const count = Number(rawCount)
    if (Number.isFinite(count)) {
      counts[key] = count
    }
  }

  return counts
}

async function getRedisAnalyticsSnapshot(config: RedisConfig): Promise<AnalyticsSnapshot> {
  const results = await upstashTransaction(config, [
    ["HGETALL", ANALYTICS_COUNTS_KEY],
    ["LRANGE", ANALYTICS_RECENT_KEY, 0, ANALYTICS_SNAPSHOT_RECENT_LIMIT - 1],
  ])

  return {
    counts: parseCounts(results[0]?.result),
    recent: parseRecentEvents(results[1]?.result),
  }
}

async function recordRedisAnalyticsEvent(config: RedisConfig, event: AnalyticsEvent) {
  const [exists, count] = await upstashTransaction(config, [
    ["HEXISTS", ANALYTICS_COUNTS_KEY, event.name],
    ["HLEN", ANALYTICS_COUNTS_KEY],
  ])

  const hasExistingKey = Boolean(exists?.result)
  const distinctEventTypes = Number(count?.result)
  const key = !hasExistingKey && Number.isFinite(distinctEventTypes) && distinctEventTypes >= ANALYTICS_MAX_EVENT_TYPES
    ? "analytics.other"
    : event.name
  const storedEvent = key === event.name ? event : { ...event, name: key }

  await upstashTransaction(config, [
    ["HINCRBY", ANALYTICS_COUNTS_KEY, key, 1],
    ["LPUSH", ANALYTICS_RECENT_KEY, JSON.stringify(storedEvent)],
    ["LTRIM", ANALYTICS_RECENT_KEY, 0, ANALYTICS_MAX_RECENT - 1],
  ])
}

async function resetRedisAnalytics(config: RedisConfig) {
  await upstashTransaction(config, [["DEL", ANALYTICS_COUNTS_KEY, ANALYTICS_RECENT_KEY]])
}

export async function recordAnalyticsEvent(event: AnalyticsEvent) {
  const config = getRedisConfig()
  if (!config) {
    recordMemoryAnalyticsEvent(event)
    return
  }

  try {
    await recordRedisAnalyticsEvent(config, event)
  } catch (error) {
    warnAboutAnalyticsStore("Redis analytics storage failed. Falling back to local in-memory tracking for this instance.")
    console.error("[analytics] Store write failed.", error)
    recordMemoryAnalyticsEvent(event)
  }
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const config = getRedisConfig()
  if (!config) {
    return getMemoryAnalyticsSnapshot()
  }

  try {
    return await getRedisAnalyticsSnapshot(config)
  } catch (error) {
    warnAboutAnalyticsStore("Redis analytics snapshot failed. Falling back to local in-memory analytics for this instance.")
    console.error("[analytics] Snapshot read failed.", error)
    return getMemoryAnalyticsSnapshot()
  }
}

export async function resetAnalytics() {
  const config = getRedisConfig()
  if (!config) {
    resetMemoryAnalytics()
    return
  }

  try {
    await resetRedisAnalytics(config)
  } catch (error) {
    warnAboutAnalyticsStore("Redis analytics reset failed. Clearing local in-memory analytics for this instance.")
    console.error("[analytics] Reset failed.", error)
  } finally {
    resetMemoryAnalytics()
  }
}
