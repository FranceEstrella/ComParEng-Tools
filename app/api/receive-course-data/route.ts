import { NextResponse } from "next/server"
import { updateCourseData } from "@/lib/course-storage"

export async function POST(request: Request) {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }

  try {
    // Parse the request body
    const courseData = await request.json()

    // Log the request body
    console.log(
      "Received request body:",
      typeof courseData,
      Array.isArray(courseData) ? courseData.length : "not an array",
    )

    // Validate that courseData is an array
    if (!Array.isArray(courseData)) {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be an array",
        },
        { status: 400, headers },
      )
    }

    // Validate each course object has the required properties
    const isValid = courseData.every(
      (course) =>
        typeof course.courseCode === "string" &&
        typeof course.section === "string" &&
        typeof course.classSize === "string" &&
        typeof course.remainingSlots === "string" &&
        typeof course.meetingDays === "string" &&
        typeof course.meetingTime === "string" &&
        typeof course.room === "string" &&
        typeof course.hasSlots === "boolean",
    )

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Each course must have courseCode, section, classSize, remainingSlots, meetingDays, meetingTime, room, and hasSlots properties",
        },
        { status: 400, headers },
      )
    }

    // Store the data in our temporary storage
    const updateResult = updateCourseData(courseData)
    console.log("Course data updated successfully:", courseData.length, "courses")

    // Send success response
    return NextResponse.json(
      {
        success: true,
        message: "Course data received successfully.",
        lastUpdated: updateResult?.updatedAt || null,
        hasChanged: updateResult?.hasChanged ?? true,
      },
      { headers },
    )
  } catch (error) {
    console.error("Error processing course data:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON in request body: " + (error as Error).message,
      },
      { status: 400, headers },
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
