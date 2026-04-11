const STATIC_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://compareng-tools.vercel.app",
  "https://compareng-coursetracker.vercel.app",
]

const CHROME_EXTENSION_ORIGIN_RE = /^chrome-extension:\/\/[a-p]{32}$/

function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) {
    return true
  }

  if (CHROME_EXTENSION_ORIGIN_RE.test(origin)) {
    return true
  }

  const extraOrigins = process.env.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  return Boolean(extraOrigins?.includes(origin))
}

export function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("origin")
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  }

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }

  return headers
}
