type AnalyticsMeta = Record<string, unknown>

export const trackAnalyticsEvent = (name: string, meta?: AnalyticsMeta) => {
  if (typeof window === "undefined") return

  try {
    const payload = {
      name,
      at: Date.now(),
      path: window.location?.pathname,
      meta,
    }

    // keepalive helps ensure it still sends during navigation
    fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // ignore analytics failures
    })
  } catch {
    // ignore analytics failures
  }
}
