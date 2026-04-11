import { NextResponse } from "next/server"
import { updateCourseData } from "@/lib/course-storage"
import { buildCorsHeaders } from "@/lib/api-cors"

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  const headers = {
    ...corsHeaders,
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
    const invalidCourseIndex = courseData.findIndex(
      (course) =>
        !(typeof course.courseCode === "string" &&
          typeof course.section === "string" &&
          typeof course.classSize === "string" &&
          typeof course.remainingSlots === "string" &&
          typeof course.meetingDays === "string" &&
          typeof course.meetingTime === "string" &&
          typeof course.room === "string" &&
          typeof course.hasSlots === "boolean" &&
          typeof course.term === "string" &&
          typeof course.schoolYear === "string" &&
          course.term.trim().length > 0 &&
          course.schoolYear.trim().length > 0),
    )

    const isValid = invalidCourseIndex === -1

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Each course must have courseCode, section, classSize, remainingSlots, meetingDays, meetingTime, room, hasSlots, term, and schoolYear properties",
          invalidCourseIndex,
          invalidCourseSample: invalidCourseIndex >= 0 ? courseData[invalidCourseIndex] : null,
        },
        { status: 400, headers },
      )
    }

    const firstTerm = courseData[0]?.term?.trim()
    const firstSchoolYear = courseData[0]?.schoolYear?.trim()
    const hasMixedTermYear = courseData.some(
      (course) => course.term.trim() !== firstTerm || course.schoolYear.trim() !== firstSchoolYear,
    )

    if (hasMixedTermYear) {
      return NextResponse.json(
        {
          success: false,
          error: "All rows in one payload must have the same term and schoolYear.",
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
export async function OPTIONS(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  return NextResponse.json(
    {},
    {
      headers: corsHeaders,
    },
  )
}
