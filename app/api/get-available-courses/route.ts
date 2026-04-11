import { NextResponse } from "next/server"
import { getCourseDataSnapshot } from "@/lib/course-storage"
import { buildCorsHeaders } from "@/lib/api-cors"

export async function GET(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }

  try {
    const requestUrl = new URL(request.url)
    const term = requestUrl.searchParams.get("term") || ""
    const schoolYear = requestUrl.searchParams.get("schoolYear") || ""

    const snapshot = getCourseDataSnapshot(term, schoolYear)
    const stored: any[] = Array.isArray(snapshot.data) ? snapshot.data : []

    // Log the data being returned
    console.log("Returning course data:", stored.length, "courses")

    // Return the stored course data
    return NextResponse.json(
      {
        success: true,
        data: stored,
        lastUpdated: snapshot.updatedAt || null,
        expiresAt: snapshot.expiresAt || null,
        isExpired: snapshot.isExpired,
        term: snapshot.term || null,
        schoolYear: snapshot.schoolYear || null,
      },
      { headers },
    )
  } catch (error) {
    console.error("Error fetching course data:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch course data: " + (error as Error).message,
      },
      { status: 500, headers },
    )
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  return NextResponse.json(
    {},
    {
      headers: corsHeaders,
    },
  )
}
