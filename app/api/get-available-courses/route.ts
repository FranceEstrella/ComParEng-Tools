import { NextResponse } from "next/server"
import { courseDataStorage } from "@/lib/course-storage"

export async function GET() {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
  }

  try {
    // Log the data being returned
    console.log("Returning course data:", courseDataStorage ? courseDataStorage.length : 0, "courses")

    // Return the stored course data
    return NextResponse.json(
      {
        success: true,
        data: courseDataStorage || [],
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
