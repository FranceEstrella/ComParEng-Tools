import { NextResponse } from "next/server"
import { buildCorsHeaders } from "@/lib/api-cors"
import { updateGradeAttemptImport } from "@/lib/course-storage"

type ImportedGradeAttempt = {
  courseCode: string
  finalGrade: string
  schoolYear: string
  portalTermLabel: string
  term: string
  chronologicalIndex: number
}

const isValidAttempt = (attempt: any) => {
  return Boolean(
    attempt &&
      typeof attempt.courseCode === "string" &&
      attempt.courseCode.trim().length > 0 &&
      typeof attempt.finalGrade === "string" &&
      attempt.finalGrade.trim().length > 0 &&
      typeof attempt.schoolYear === "string" &&
      attempt.schoolYear.trim().length > 0 &&
      typeof attempt.portalTermLabel === "string" &&
      attempt.portalTermLabel.trim().length > 0 &&
      typeof attempt.term === "string" &&
      attempt.term.trim().length > 0 &&
      typeof attempt.chronologicalIndex === "number",
  )
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }

  try {
    const body = await request.json()
    const runId = typeof body?.runId === "string" ? body.runId.trim() : ""
    const attempts = Array.isArray(body?.attempts) ? (body.attempts as ImportedGradeAttempt[]) : []

    if (!runId) {
      return NextResponse.json({ success: false, error: "runId is required." }, { status: 400, headers })
    }

    if (!Array.isArray(attempts) || attempts.length === 0) {
      return NextResponse.json({ success: false, error: "attempts must be a non-empty array." }, { status: 400, headers })
    }

    const invalidIndex = attempts.findIndex((attempt) => !isValidAttempt(attempt))
    if (invalidIndex >= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid grade-attempt payload.",
          invalidIndex,
          invalidSample: attempts[invalidIndex],
        },
        { status: 400, headers },
      )
    }

    const payload = {
      runId,
      attempts,
      summary: body?.summary && typeof body.summary === "object" ? body.summary : null,
      extractedAt: typeof body?.extractedAt === "number" ? body.extractedAt : Date.now(),
      source: "solar-grades",
    }

    const updateResult = updateGradeAttemptImport(payload)

    return NextResponse.json(
      {
        success: true,
        runId,
        accepted: attempts.length,
        lastUpdated: updateResult.updatedAt,
      },
      { headers },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON in request body: " + (error as Error).message,
      },
      { status: 400, headers },
    )
  }
}

export async function OPTIONS(request: Request) {
  const corsHeaders = buildCorsHeaders(request)
  return NextResponse.json({}, { headers: corsHeaders })
}
