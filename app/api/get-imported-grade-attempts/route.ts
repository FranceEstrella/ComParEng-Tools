import { NextResponse } from "next/server"
import { buildCorsHeaders } from "@/lib/api-cors"
import { getLatestGradeAttemptImport } from "@/lib/course-storage"

export async function GET(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }

  try {
    const latest = getLatestGradeAttemptImport()

    return NextResponse.json(
      {
        success: true,
        updatedAt: latest.updatedAt || 0,
        payload: latest.payload || null,
      },
      { headers },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch imported grade attempts: " + (error as Error).message,
      },
      { status: 500, headers },
    )
  }
}

export async function OPTIONS(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  return NextResponse.json({}, { headers: corsHeaders })
}
