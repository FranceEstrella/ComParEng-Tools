type AnalyticsMeta = Record<string, unknown>

type AnalyticsEvent = {
  name: string
  at: number
  path?: string
  meta?: AnalyticsMeta
}

const pendingEvents: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let listenersAttached = false

const FLUSH_DELAY_MS = 1000
const MAX_BATCH_SIZE = 10

function buildPayload(events: AnalyticsEvent[]) {
  return JSON.stringify({ events })
}

function clearFlushTimer() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

async function sendQueuedEvents() {
  if (typeof window === "undefined" || pendingEvents.length === 0) return

  const events = pendingEvents.splice(0, MAX_BATCH_SIZE)
  if (events.length === 0) return

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: buildPayload(events),
      keepalive: true,
    })
  } catch {
    // ignore analytics failures
  }

  if (pendingEvents.length > 0) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      sendQueuedEvents().catch(() => undefined)
    }, FLUSH_DELAY_MS)
  }
}

function flushQueuedEventsSoon() {
  if (flushTimer !== null || typeof window === "undefined") return

  flushTimer = setTimeout(() => {
    flushTimer = null
    sendQueuedEvents().catch(() => undefined)
  }, FLUSH_DELAY_MS)
}

function attachListeners() {
  if (listenersAttached || typeof window === "undefined") return
  listenersAttached = true

  window.addEventListener("pagehide", () => {
    if (pendingEvents.length === 0) return
    clearFlushTimer()
    const events = pendingEvents.splice(0, pendingEvents.length)
    try {
      navigator.sendBeacon("/api/analytics", new Blob([buildPayload(events)], { type: "application/json" }))
    } catch {
      // ignore analytics failures
    }
  })
}

export const trackAnalyticsEvent = (name: string, meta?: AnalyticsMeta) => {
  if (typeof window === "undefined") return
  attachListeners()

  try {
    pendingEvents.push({
      name,
      at: Date.now(),
      path: window.location?.pathname,
      meta,
    })

    flushQueuedEventsSoon()
  } catch {
    // ignore analytics failures
  }
}
