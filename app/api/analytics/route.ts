import { NextResponse } from "next/server"
import { getAnalyticsSnapshot, recordAnalyticsEvent, resetAnalytics } from "@/lib/analytics-storage"
import { authorizeAnalyticsAdmin } from "@/lib/server/auth"
import {
  applyRateLimits,
  rateLimitHeaders,
  rateLimitResponse,
  rateLimitUnavailableResponse,
  type RateLimitPolicy,
} from "@/lib/server/rate-limit"
import { ApiRequestError, readJsonObject, readJsonValue } from "@/lib/server/request"
import { ANALYTICS_MAX_BODY_BYTES, validateAnalyticsPayload } from "@/lib/server/validation"

export const runtime = "nodejs"

const INGEST_LIMITS: RateLimitPolicy[] = [
  { name: "analytics-ingest-ip-minute", limit: 120, windowMs: 60 * 1000, scope: "ip" },
  { name: "analytics-ingest-global-minute", limit: 5_000, windowMs: 60 * 1000, scope: "global" },
]

const FAILED_AUTH_LIMITS: RateLimitPolicy[] = [
  { name: "analytics-auth-failure-ip-15m", limit: 5, windowMs: 15 * 60 * 1000, scope: "ip" },
  { name: "analytics-auth-failure-global-15m", limit: 100, windowMs: 15 * 60 * 1000, scope: "global" },
]

const ADMIN_DELETE_LIMITS: RateLimitPolicy[] = [
  { name: "analytics-admin-delete-ip-hour", limit: 10, windowMs: 60 * 60 * 1000, scope: "ip" },
]

function noStoreHeaders(extra?: HeadersInit) {
  return { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(extra)) }
}
async function authorizeAdminRequest(request: Request) {
  const auth = authorizeAnalyticsAdmin(request)
  if (auth === "authorized") return null

  if (auth === "misconfigured") {
    return NextResponse.json(
      { code: "analytics_not_configured", error: "Analytics administration is not configured." },
      { status: 503, headers: noStoreHeaders() },
    )
  }

  const rateLimit = await applyRateLimits(request, FAILED_AUTH_LIMITS)
  if (rateLimit.status === "limited") return rateLimitResponse(rateLimit)
  if (rateLimit.status === "unavailable") return rateLimitUnavailableResponse()

  return NextResponse.json(
    { code: "unauthorized", error: "Unauthorized" },
    { status: 401, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
  )
}

export async function GET(request: Request) {
  const unauthorized = await authorizeAdminRequest(request)
  if (unauthorized) return unauthorized

  return NextResponse.json(await getAnalyticsSnapshot(), {
    status: 200,
    headers: noStoreHeaders(),
  })
}

export async function POST(request: Request) {
  const rateLimit = await applyRateLimits(request, INGEST_LIMITS)
  if (rateLimit.status === "limited") return rateLimitResponse(rateLimit)

  // Analytics is best-effort. If protection is unavailable, acknowledge and drop
  // the event instead of accepting unbounded writes or affecting the user flow.
  if (rateLimit.status === "unavailable") {
    return NextResponse.json(
      { accepted: false },
      { status: 202, headers: noStoreHeaders({ "Retry-After": "30" }) },
    )
  }

  try {
    const payload = await readJsonValue(request, ANALYTICS_MAX_BODY_BYTES)
    const events = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown }).events)
        ? ((payload as { events: unknown[] }).events)
        : [payload]

    for (const event of events) {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return NextResponse.json(
          { code: "invalid_event", error: "Event payload must be an object." },
          { status: 400, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
        )
      }

      const validation = validateAnalyticsPayload(event as Record<string, unknown>)
      if (!validation.ok) {
        return NextResponse.json(
          { code: "invalid_event", error: validation.message },
          { status: 400, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
        )
      }

      await recordAnalyticsEvent(validation.value)
    }
    return NextResponse.json(
      { accepted: true },
      { status: 202, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
    )
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
      )
    }
    console.error("[analytics] Unexpected ingestion error.", error)
    return NextResponse.json(
      { code: "unexpected_error", error: "An unexpected error occurred." },
      { status: 500, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
    )
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await authorizeAdminRequest(request)
  if (unauthorized) return unauthorized

  if (request.headers.get("x-analytics-reset") !== "confirm") {
    return NextResponse.json(
      { code: "confirmation_required", error: "Reset confirmation is required." },
      { status: 400, headers: noStoreHeaders() },
    )
  }

  const rateLimit = await applyRateLimits(request, ADMIN_DELETE_LIMITS)
  if (rateLimit.status === "limited") return rateLimitResponse(rateLimit)
  if (rateLimit.status === "unavailable") return rateLimitUnavailableResponse()

  await resetAnalytics()
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: noStoreHeaders(rateLimitHeaders(rateLimit)) },
  )
}
