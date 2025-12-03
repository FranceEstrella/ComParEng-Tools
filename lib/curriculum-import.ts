export type CurriculumCourseStatus = "passed" | "active" | "pending"

export type CurriculumCourse = {
  id: string
  code: string
  name: string
  credits: number
  status: CurriculumCourseStatus
  prerequisites: string[]
  description: string | null
  year: number
  term: string
}

const COURSE_CODE_REGEX = /[A-Z]{2,5}\s*\d{1,5}[A-Z]?/gi

const normalizeCourseCode = (value: string): string => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

const looksLikeEmptyDependency = (value: string): boolean => {
  const trimmed = value.trim()
  return (
    trimmed.length === 0 ||
    /^(?:none|n\/a|tba|tbd|not applicable|no prereq|no prerequisites|nil|--|-|—|–)$/i.test(trimmed)
  )
}

const extractCourseCodes = (value: string | null | undefined): string[] => {
  if (!value) return []
  if (looksLikeEmptyDependency(value)) return []

  const sanitized = value.replace(/&/g, ",").replace(/\band\b/gi, ",")
  const matches = sanitized.toUpperCase().match(COURSE_CODE_REGEX)
  if (!matches) return []

  const seen = new Set<string>()
  const codes: string[] = []
  matches.forEach((match) => {
    const normalized = normalizeCourseCode(match)
    if (normalized.length >= 3 && !seen.has(normalized)) {
      seen.add(normalized)
      codes.push(normalized)
    }
  })
  return codes
}

/**
 * Parse a Program Curriculum HTML file (from SOLAR) and extract courses.
 * The function is intentionally permissive by supporting tables where
 * course rows are regular <tr> with multiple <td>s and also handles
 * section header rows (single-cell rows) that indicate Year/Term.
 */
export const parseCurriculumHtml = (html: string): CurriculumCourse[] => {
  if (typeof window === "undefined") return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const tbody = doc.querySelector("tbody")
  if (!tbody) return []

  const courses: CurriculumCourse[] = []
  let currentYear = 1
  let currentTerm: string = "Term 1"

  // Try to detect header -> column index for units/credits/prereqs/dependents to reliably extract values
  const headerCells = Array.from(doc.querySelectorAll("thead th, thead td"))
  let unitsColIndex: number | null = null
  let prereqColIndex: number | null = null
  let requiredForColIndex: number | null = null
  if (headerCells.length > 0) {
    headerCells.forEach((th, idx) => {
      const txt = (th.textContent || "").trim()
      if (/unit|credit|units|credits/i.test(txt) && unitsColIndex === null) {
        unitsColIndex = idx
      }
      const normalized = txt.toLowerCase()
      if (
        prereqColIndex === null &&
        /pre[\s-]?req|prerequisite/i.test(normalized) &&
        !/co[\s-]?req/i.test(normalized)
      ) {
        prereqColIndex = idx
      }
      if (
        requiredForColIndex === null &&
        /(required\s*for|required[\s-]*for|dependent\s*courses?|dependents)/i.test(normalized)
      ) {
        requiredForColIndex = idx
      }
    })
  }

  const pendingRequiredForLinks: { sourceId: string; targetCodes: string[] }[] = []

  const rows = Array.from(tbody.querySelectorAll("tr"))
  rows.forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll("td"))
    const rowText = tr.textContent?.trim() || ""

    // Heuristic: a single-cell row is likely a section header (e.g. "First Year" or "Term 1")
    if (tds.length === 1) {
      // Normalize whitespace and collapse newlines so header like:
      // "FIRST YEAR ( 2ND TERM )" becomes "FIRST YEAR (2ND TERM)"
      const header = rowText.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim()

      // Detect year (FIRST, SECOND, THIRD, FOURTH)
      if (/first year|year 1|1st year/i.test(header)) currentYear = 1
      else if (/second year|year 2|2nd year/i.test(header)) currentYear = 2
      else if (/third year|year 3|3rd year/i.test(header)) currentYear = 3
      else if (/fourth year|year 4|4th year/i.test(header)) currentYear = 4

      // Prefer detecting a parenthesized term like "(2ND TERM)" first
      const parenMatch = header.match(/\(([^)]+)\)/)
      let termText = parenMatch ? parenMatch[1] : header

      // Now extract a term number from the termText
      const termOrdinalMatch = termText.match(/(1ST|2ND|3RD|4TH)\s*TERM/i)
      const termDigitMatch = termText.match(/(\d)(?:ST|ND|RD|TH)?\s*TERM/i)
      const termAfterWordMatch = termText.match(/TERM\s*[:\(\s]*\s*(\d)/i)

      if (termOrdinalMatch) {
        const digit = termOrdinalMatch[1].charAt(0)
        currentTerm = `Term ${digit}`
      } else if (termDigitMatch) {
        currentTerm = `Term ${termDigitMatch[1]}`
      } else if (termAfterWordMatch) {
        currentTerm = `Term ${termAfterWordMatch[1]}`
      } else {
        // No explicit term detected -> default to Term 1 for that year
        currentTerm = "Term 1"
      }

      return
    }

    // If it looks like a course row (code in first cell)
    if (tds.length >= 2) {
      const code = tds[0].textContent?.trim() || ""
      const name = tds[1].textContent?.trim() || ""

      // Attempt to find credits using the detected units column first
      let credits: number | undefined = undefined

      // Helper: parse a candidate cell text for an isolated/sensible numeric units value
      const parseCandidateNumber = (txt: string | null | undefined): number | undefined => {
        if (!txt) return undefined
        const s = txt.trim()
        if (s.length === 0) return undefined

        // Accept whole-cell integers like "3" or "0" (optionally decimals like "3.0")
        const whole = s.match(/^(\d+)(?:\.\d+)?$/)
        if (whole) {
          const n = Number(whole[1])
          if (Number.isFinite(n) && n >= 0 && n <= 9) return n
        }

        // Accept isolated numeric tokens but avoid digits embedded in alphanumeric course codes (e.g. COE123)
        // Scan digit runs and ensure surrounding characters are not letters
        const digitRe = /\d+/g
        let m: RegExpExecArray | null
        while ((m = digitRe.exec(s)) !== null) {
          const match = m[0]
          const idx = m.index
          const before = idx > 0 ? s[idx - 1] : undefined
          const after = idx + match.length < s.length ? s[idx + match.length] : undefined
          const beforeIsLetter = before ? /[A-Za-z]/.test(before) : false
          const afterIsLetter = after ? /[A-Za-z]/.test(after) : false
          if (!beforeIsLetter && !afterIsLetter) {
            const n = Number(match)
            if (Number.isFinite(n) && n >= 0 && n <= 9) return n
          }
        }

        return undefined
      }

      if (unitsColIndex !== null && unitsColIndex < tds.length) {
        const unitsTxt = tds[unitsColIndex].textContent || ""
        credits = parseCandidateNumber(unitsTxt)
      }

      // If the detected units column didn't help, scan non-code cells (skip code cell at tds[0])
      if (credits === undefined) {
        for (let i = 1; i < tds.length; i++) {
          const candidate = parseCandidateNumber(tds[i].textContent)
          if (candidate !== undefined) {
            credits = candidate
            break
          }
        }
      }

      // Only add rows that look like courses (must have a code or name)
      if (code || name) {
        const prereqText =
          prereqColIndex !== null && prereqColIndex < tds.length ? tds[prereqColIndex].textContent : null
        const requiredForText =
          requiredForColIndex !== null && requiredForColIndex < tds.length ? tds[requiredForColIndex].textContent : null

        const prereqCodes = extractCourseCodes(prereqText)
        const requiredForCodes = extractCourseCodes(requiredForText)

        const id = code || name.slice(0, 8).replace(/\s+/g, "_")
        const newCourse: CurriculumCourse = {
          id,
          code: code || id,
          name: name || "",
          credits: credits ?? 0,
          status: "pending",
          prerequisites: prereqCodes,
          description: null,
          year: currentYear,
          term: currentTerm,
        }

        courses.push(newCourse)

        if (requiredForCodes.length > 0) {
          pendingRequiredForLinks.push({ sourceId: newCourse.id, targetCodes: requiredForCodes })
        }
      }
    }
  })

  if (courses.length === 0) {
    return courses
  }

  const codeToCourse = new Map<string, CurriculumCourse>()
  courses.forEach((course) => {
    if (course.code) {
      codeToCourse.set(normalizeCourseCode(course.code), course)
    }
  })

  courses.forEach((course) => {
    const resolvedIds: string[] = []
    const seen = new Set<string>()
    course.prerequisites.forEach((rawCode) => {
      const normalized = normalizeCourseCode(rawCode)
      const referenced = codeToCourse.get(normalized)
      if (referenced && referenced.id !== course.id && !seen.has(referenced.id)) {
        seen.add(referenced.id)
        resolvedIds.push(referenced.id)
      }
    })
    course.prerequisites = resolvedIds
  })

  if (pendingRequiredForLinks.length > 0) {
    pendingRequiredForLinks.forEach(({ sourceId, targetCodes }) => {
      targetCodes.forEach((targetCode) => {
        const targetCourse = codeToCourse.get(normalizeCourseCode(targetCode))
        if (!targetCourse) return
        if (targetCourse.id === sourceId) return
        if (!targetCourse.prerequisites.includes(sourceId)) {
          targetCourse.prerequisites = [...targetCourse.prerequisites, sourceId]
        }
      })
    })
  }

  return courses
}
