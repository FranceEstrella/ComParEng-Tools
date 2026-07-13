import { NextResponse } from "next/server"

export type RateLimitPolicy = {
  name: string
  limit: number
  windowMs: number
  scope: "ip" | "global"
}

type RateLimitCounter = {
  count: number
  expiresAt: number
}

export type RateLimitResult = {
  status: "allowed" | "limited" | "unavailable"
  limit?: number
  remaining?: number
  resetAt?: number
  retryAfterSeconds?: number
  policy?: string
}

type RedisConfig = { url: string; token: string }

const globalState = globalThis as typeof globalThis & {
  __comparengRateLimits?: Map<string, RateLimitCounter>
  __comparengRateLimitConfigWarningShown?: boolean
}

function getMemoryStore() {
  if (!globalState.__comparengRateLimits) {
    globalState.__comparengRateLimits = new Map()
  }
  return globalState.__comparengRateLimits
}

function normalizeRedisRestUrl(value: string) {
  return value.replace(/\/$/, "")
}

function parseRedisConnectionUrl(value: string): RedisConfig | null {
  try {
    const parsed = new URL(value)
    const token = parsed.password?.trim()
    if (!parsed.hostname || !token) return null

    return {
      url: `https://${parsed.hostname}`,
      token,
    }
  } catch {
    return null
  }
}

function warnAboutRedisConfig(message: string) {
  if (globalState.__comparengRateLimitConfigWarningShown) return
  globalState.__comparengRateLimitConfigWarningShown = true
  console.error(`[rate-limit] ${message}`)
}

function getRedisConfig(): RedisConfig | null {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim()
  if (restUrl && token) {
    return { url: normalizeRedisRestUrl(restUrl), token }
  }

  const connectionUrl =
    process.env.UPSTASH_REDIS_URL?.trim() || process.env.KV_URL?.trim() || process.env.REDIS_URL?.trim()
  if (connectionUrl) {
    const config = parseRedisConnectionUrl(connectionUrl)
    if (!config) {
      warnAboutRedisConfig(
        "Invalid Upstash Redis connection string. Use UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or a rediss:// URL with credentials in UPSTASH_REDIS_URL, KV_URL, or REDIS_URL.",
      )
    }
    return config
  }

  warnAboutRedisConfig(
    "No distributed Redis store is configured. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_URL/KV_URL/REDIS_URL.",
  )
  return null
}

function useMemoryStore() {
  return process.env.NODE_ENV !== "production" || process.env.RATE_LIMIT_MEMORY_FALLBACK === "true"
}

export function getClientIp(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown"

  return forwarded.split(",", 1)[0]?.trim() || "unknown"
}

async function hashIdentifier(value: string) {
  const salt = process.env.RATE_LIMIT_IP_SALT || "compareng-rate-limit"
  const bytes = new TextEncoder().encode(`${salt}:${value}`)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function checkMemoryLimit(key: string, policy: RateLimitPolicy, now: number): RateLimitResult {
  const store = getMemoryStore()
  const previous = store.get(key)
  const current = !previous || previous.expiresAt <= now
    ? { count: 1, expiresAt: now + policy.windowMs }
    : { ...previous, count: previous.count + 1 }

  store.set(key, current)

  if (store.size > 5_000) {
    for (const [storedKey, counter] of store) {
      if (counter.expiresAt <= now) store.delete(storedKey)
      if (store.size <= 4_000) break
    }
  }

  const remaining = Math.max(0, policy.limit - current.count)
  const retryAfterSeconds = Math.max(1, Math.ceil((current.expiresAt - now) / 1000))
  return {
    status: current.count <= policy.limit ? "allowed" : "limited",
    limit: policy.limit,
    remaining,
    resetAt: current.expiresAt,
    retryAfterSeconds,
    policy: policy.name,
  }
}

async function checkRedisLimit(
  config: RedisConfig,
  key: string,
  policy: RateLimitPolicy,
  now: number,
): Promise<RateLimitResult> {
  const response = await fetch(`${config.url}/multi-exec`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, policy.windowMs, "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(2_500),
  })

  if (!response.ok) {
    throw new Error(`Rate-limit store returned HTTP ${response.status}`)
  }

  const results = (await response.json()) as Array<{ result?: unknown; error?: string }>
  if (!Array.isArray(results) || results.some((item) => item?.error)) {
    throw new Error("Rate-limit store returned an invalid response")
  }

  const count = Number(results[0]?.result)
  const ttl = Number(results[2]?.result)
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
    throw new Error("Rate-limit store returned invalid counters")
  }

  const resetAt = now + Math.max(1, ttl > 0 ? ttl : policy.windowMs)
  return {
    status: count <= policy.limit ? "allowed" : "limited",
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    policy: policy.name,
  }
}

export async function applyRateLimits(request: Request, policies: RateLimitPolicy[]): Promise<RateLimitResult> {
  const now = Date.now()
  const redis = getRedisConfig()
  if (!useMemoryStore() && !redis) {
    console.error("[rate-limit] A distributed store is required in production.")
    return { status: "unavailable" }
  }

  try {
    const ipHash = await hashIdentifier(getClientIp(request))
    let mostRestrictive: RateLimitResult = { status: "allowed" }

    for (const policy of policies) {
      const identifier = policy.scope === "global" ? "global" : ipHash
      const key = `compareng:rate-limit:${policy.name}:${identifier}`
      const result = useMemoryStore()
        ? checkMemoryLimit(key, policy, now)
        : await checkRedisLimit(redis as RedisConfig, key, policy, now)

      if (result.status === "limited") return result
      if (
        mostRestrictive.remaining === undefined ||
        (result.remaining ?? Number.POSITIVE_INFINITY) / (result.limit ?? 1) <
          mostRestrictive.remaining / (mostRestrictive.limit ?? 1)
      ) {
        mostRestrictive = result
      }
    }
    return mostRestrictive
  } catch (error) {
    console.error("[rate-limit] Store check failed.", error)
    return { status: "unavailable" }
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  const headers = new Headers({ "Cache-Control": "no-store" })
  if (result.limit !== undefined) headers.set("RateLimit-Limit", String(result.limit))
  if (result.remaining !== undefined) headers.set("RateLimit-Remaining", String(result.remaining))
  if (result.resetAt !== undefined) {
    headers.set("RateLimit-Reset", String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))))
  }
  if (result.status === "limited" && result.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(result.retryAfterSeconds))
  }
  return headers
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { success: false, code: "rate_limited", error: "Too many requests. Please try again later." },
    { status: 429, headers: rateLimitHeaders(result) },
  )
}

export function rateLimitUnavailableResponse() {
  return NextResponse.json(
    { success: false, code: "service_unavailable", error: "Request protection is temporarily unavailable." },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
  )
}
