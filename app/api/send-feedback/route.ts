import { NextResponse } from "next/server"
import { recordAnalyticsEvent } from "@/lib/analytics-storage"
import {
  applyRateLimits,
  rateLimitHeaders,
  rateLimitResponse,
  rateLimitUnavailableResponse,
  type RateLimitPolicy,
} from "@/lib/server/rate-limit"
import { ApiRequestError, readJsonObject } from "@/lib/server/request"
import { FEEDBACK_MAX_BODY_BYTES, validateFeedbackPayload } from "@/lib/server/validation"

export const runtime = "nodejs"

const FEEDBACK_LIMITS: RateLimitPolicy[] = [
  { name: "feedback-ip-10m", limit: 3, windowMs: 10 * 60 * 1000, scope: "ip" },
  { name: "feedback-ip-day", limit: 10, windowMs: 24 * 60 * 60 * 1000, scope: "ip" },
  { name: "feedback-global-hour", limit: 200, windowMs: 60 * 60 * 1000, scope: "global" },
]

function errorResponse(status: number, code: string, error: string, headers?: HeadersInit) {
  return NextResponse.json(
    { success: false, code, error },
    { status, headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers)) } },
  )
}
// Environment variables used:
// - MAILGUN_API_KEY (full key, e.g. "key-...")
// - MAILGUN_DOMAIN (the sending domain, e.g. "mg.example.com")
// - SENDER_EMAIL (optional, defaults to "no-reply@compareng.app")
export async function POST(request: Request) {
  const rateLimit = await applyRateLimits(request, FEEDBACK_LIMITS)
  if (rateLimit.status === "limited") return rateLimitResponse(rateLimit)
  if (rateLimit.status === "unavailable") return rateLimitUnavailableResponse()

  const responseHeaders = rateLimitHeaders(rateLimit)

  try {
    const rawPayload = await readJsonObject(request, FEEDBACK_MAX_BODY_BYTES)
    const validation = validateFeedbackPayload(rawPayload)
    if (!validation.ok) {
      return errorResponse(400, "invalid_feedback", validation.message, responseHeaders)
    }

    const { name, subject, message, website } = validation.value

    // Silently accept honeypot submissions so automated senders receive no useful signal.
    if (website) {
      recordAnalyticsEvent({ name: "feedback.spam_blocked", at: Date.now(), path: "/api/send-feedback" })
      return NextResponse.json({ success: true }, { status: 200, headers: responseHeaders })
    }

    const mailgunKey = process.env.MAILGUN_API_KEY
    const mailgunDomain = process.env.MAILGUN_DOMAIN
    const sender = process.env.SENDER_EMAIL || "no-reply@compareng.app"
    const recipient = "dozey.help@gmail.com"

    if (!mailgunKey || !mailgunDomain) {
      console.error("[send-feedback] Mailgun is not configured.")
      recordAnalyticsEvent({
        name: "feedback.send_failed",
        at: Date.now(),
        path: "/api/send-feedback",
        meta: { reason: "mailgun_not_configured" },
      })
      return errorResponse(503, "feedback_unavailable", "Feedback delivery is temporarily unavailable.", responseHeaders)
    }

    const bodyText = [`From: ${name}`, `Subject: ${subject}`, "", message].join("\n")
    const form = new URLSearchParams()
    form.append("from", `${escapeHeader(sender)} (ComParEng Tools) <${escapeHeader(sender)}>`)
    form.append("to", recipient)
    form.append("subject", `[ComParEng Feedback] ${subject}`)
    form.append("text", bodyText)
    form.append("html", `<pre>${escapeHtml(bodyText)}</pre>`)

    const basic = Buffer.from(`api:${mailgunKey}`).toString("base64")
    let sendResponse: Response
    try {
      sendResponse = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(8_000),
      })
    } catch (error) {
      console.error("[send-feedback] Mailgun request failed.", error)
      recordAnalyticsEvent({
        name: "feedback.send_failed",
        at: Date.now(),
        path: "/api/send-feedback",
        meta: { reason: "mailgun_unreachable" },
      })
      return errorResponse(502, "feedback_delivery_failed", "Feedback could not be delivered.", responseHeaders)
    }

    if (!sendResponse.ok) {
      const providerRequestId = sendResponse.headers.get("x-request-id")
      console.error("[send-feedback] Mailgun rejected the request.", {
        status: sendResponse.status,
        requestId: providerRequestId,
      })
      recordAnalyticsEvent({
        name: "feedback.send_failed",
        at: Date.now(),
        path: "/api/send-feedback",
        meta: { reason: "mailgun_error", status: sendResponse.status },
      })
      return errorResponse(502, "feedback_delivery_failed", "Feedback could not be delivered.", responseHeaders)
    }

    recordAnalyticsEvent({ name: "feedback.send_success", at: Date.now(), path: "/api/send-feedback" })
    return NextResponse.json({ success: true }, { status: 200, headers: responseHeaders })
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return errorResponse(error.status, error.code, error.message, responseHeaders)
    }

    console.error("[send-feedback] Unexpected error.", error)
    recordAnalyticsEvent({
      name: "feedback.send_failed",
      at: Date.now(),
      path: "/api/send-feedback",
      meta: { reason: "unexpected_error" },
    })
    return errorResponse(500, "unexpected_error", "An unexpected error occurred.", responseHeaders)
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")
}

function escapeHeader(value: string) {
  return value.replace(/\r|\n/g, "")
}
