import { NextResponse } from "next/server"
import { getAnalyticsSnapshot, recordAnalyticsEvent, resetAnalytics } from "@/lib/analytics-storage"

const requireKey = (request: Request) => {
  const configured = process.env.ANALYTICS_KEY
  if (!configured) return { ok: true as const }

  const url = new URL(request.url)
  const key = url.searchParams.get("key")
  if (key && key === configured) return { ok: true as const }

  return { ok: false as const, configured: true as const }
}

export async function GET(request: Request) {
  const auth = requireKey(request)
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(getAnalyticsSnapshot(), { status: 200 })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any
    const name = typeof body?.name === "string" ? body.name : ""
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 })
    }

    recordAnalyticsEvent({
      name,
      at: typeof body?.at === "number" ? body.at : Date.now(),
      path: typeof body?.path === "string" ? body.path : undefined,
      meta: body?.meta && typeof body.meta === "object" ? body.meta : undefined,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const auth = requireKey(request)
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  resetAnalytics()
  return NextResponse.json({ ok: true }, { status: 200 })
}
