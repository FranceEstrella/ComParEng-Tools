import { NextResponse } from "next/server"
import { getCourseDataSnapshot } from "@/lib/course-storage"

export async function GET() {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }

  try {
    const snapshot = getCourseDataSnapshot()
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
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      },
    },
  )
}
