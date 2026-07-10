import { createHash, timingSafeEqual } from "node:crypto"

export type AdminAuthResult = "authorized" | "unauthorized" | "misconfigured"

function digest(value: string) {
  return new Uint8Array(createHash("sha256").update(value, "utf8").digest())
}

export function constantTimeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right))
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() ?? ""
}

export function authorizeAnalyticsAdmin(request: Request): AdminAuthResult {
  const configuredKey = process.env.ANALYTICS_KEY?.trim()
  if (!configuredKey) {
    return process.env.NODE_ENV === "production" ? "misconfigured" : "authorized"
  }

  const suppliedKey = getBearerToken(request)
  return suppliedKey && constantTimeEqual(suppliedKey, configuredKey) ? "authorized" : "unauthorized"
}
