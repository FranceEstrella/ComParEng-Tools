export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
  }
}

export async function readJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/json") {
    throw new ApiRequestError(415, "unsupported_media_type", "Content-Type must be application/json.")
  }

  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiRequestError(413, "payload_too_large", "Request body is too large.")
  }

  if (!request.body) {
    throw new ApiRequestError(400, "invalid_json", "A JSON object is required.")
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ApiRequestError(413, "payload_too_large", "Request body is too large.")
    }
    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(body))
  } catch {
    throw new ApiRequestError(400, "invalid_json", "Request body must contain valid JSON.")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiRequestError(400, "invalid_json", "Request body must be a JSON object.")
  }

  return parsed as Record<string, unknown>
}

