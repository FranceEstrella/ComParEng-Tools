import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isDev = process.env.NODE_ENV !== "production"

function buildEnforcedCsp(nonce: string) {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
    : `script-src 'self' 'nonce-${nonce}' blob:`

  return [
    "default-src 'self'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ")
}

function buildReportOnlyCsp(nonce: string) {
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' blob:`
    : `script-src 'self' 'nonce-${nonce}'`

  return [
    "default-src 'self'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ")
}

function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

export function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const enforcedCsp = buildEnforcedCsp(nonce)
  const reportOnlyCsp = buildReportOnlyCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("x-csp-nonce", nonce)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Expose nonce for debugging/verification during staged rollout.
  response.headers.set("x-nonce", nonce)
  response.headers.set("x-csp-nonce", nonce)
  response.headers.set("Content-Security-Policy", enforcedCsp)
  response.headers.set("Content-Security-Policy-Report-Only", reportOnlyCsp)
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)"],
}
