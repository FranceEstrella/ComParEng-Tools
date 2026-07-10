export const FEEDBACK_MAX_BODY_BYTES = 20 * 1024
export const ANALYTICS_MAX_BODY_BYTES = 6 * 1024

export type FeedbackInput = {
  name: string
  subject: string
  message: string
  website: string
}

export type AnalyticsInput = {
  name: string
  at: number
  path?: string
  meta?: Record<string, string | number | boolean | null>
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){1,5}$/
const META_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,49}$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null
}

export function validateFeedbackPayload(payload: Record<string, unknown>): ValidationResult<FeedbackInput> {
  const rawName = optionalString(payload.name)
  const subject = optionalString(payload.subject)
  const message = optionalString(payload.message)
  const website = optionalString(payload.website) ?? ""

  if (payload.name !== undefined && rawName === null) {
    return { ok: false, message: "Name must be a string." }
  }
  if (payload.website !== undefined && typeof payload.website !== "string") {
    return { ok: false, message: "Invalid submission." }
  }
  if (!subject) {
    return { ok: false, message: "Subject is required." }
  }
  if (!message || message.length < 10) {
    return { ok: false, message: "Message must contain at least 10 characters." }
  }
  if (rawName && rawName.length > 100) {
    return { ok: false, message: "Name must not exceed 100 characters." }
  }
  if ((rawName && CONTROL_CHARACTER_PATTERN.test(rawName)) || CONTROL_CHARACTER_PATTERN.test(subject)) {
    return { ok: false, message: "Name and subject must not contain control characters." }
  }
  if (subject.length > 160) {
    return { ok: false, message: "Subject must not exceed 160 characters." }
  }
  if (message.length > 10_000) {
    return { ok: false, message: "Message must not exceed 10,000 characters." }
  }
  if (website.length > 250) {
    return { ok: false, message: "Invalid submission." }
  }

  return {
    ok: true,
    value: {
      name: rawName || "Anonymous",
      subject,
      message,
      website,
    },
  }
}

export function validateAnalyticsPayload(
  payload: Record<string, unknown>,
  now = Date.now(),
): ValidationResult<AnalyticsInput> {
  const name = optionalString(payload.name)
  if (!name || name.length > 100 || !EVENT_NAME_PATTERN.test(name)) {
    return { ok: false, message: "Event name has an invalid format." }
  }

  let path: string | undefined
  if (payload.path !== undefined) {
    if (typeof payload.path !== "string") {
      return { ok: false, message: "Event path must be a string." }
    }
    path = payload.path.trim()
    if (!path.startsWith("/") || path.length > 256 || CONTROL_CHARACTER_PATTERN.test(path)) {
      return { ok: false, message: "Event path has an invalid format." }
    }
  }

  let meta: AnalyticsInput["meta"]
  if (payload.meta !== undefined) {
    if (!payload.meta || typeof payload.meta !== "object" || Array.isArray(payload.meta)) {
      return { ok: false, message: "Event metadata must be an object." }
    }

    const entries = Object.entries(payload.meta as Record<string, unknown>)
    if (entries.length > 12) {
      return { ok: false, message: "Event metadata contains too many fields." }
    }

    meta = {}
    for (const [key, value] of entries) {
      if (!META_KEY_PATTERN.test(key)) {
        return { ok: false, message: "Event metadata contains an invalid field name." }
      }
      if (typeof value === "string") {
        if (value.length > 250 || CONTROL_CHARACTER_PATTERN.test(value)) {
          return { ok: false, message: "Event metadata contains an invalid string value." }
        }
        meta[key] = value
      } else if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          return { ok: false, message: "Event metadata contains an invalid number." }
        }
        meta[key] = value
      } else if (typeof value === "boolean" || value === null) {
        meta[key] = value
      } else {
        return { ok: false, message: "Event metadata values must be primitive values." }
      }
    }

    if (JSON.stringify(meta).length > 2_048) {
      return { ok: false, message: "Event metadata is too large." }
    }
  }

  const suppliedAt = typeof payload.at === "number" && Number.isFinite(payload.at) ? payload.at : now
  const earliestAccepted = now - 10 * 60 * 1000
  const latestAccepted = now + 5 * 60 * 1000
  const at = suppliedAt >= earliestAccepted && suppliedAt <= latestAccepted ? suppliedAt : now

  return { ok: true, value: { name, at, path, meta } }
}
