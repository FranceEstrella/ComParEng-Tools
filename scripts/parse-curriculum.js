const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const COURSE_CODE_REGEX = /[A-Z]{2,5}\s*\d{1,5}[A-Z]?/gi

const normalizeCourseCode = (value = '') => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

const looksLikeEmptyDependency = (value = '') => {
  const trimmed = value.trim()
  return (
    trimmed.length === 0 ||
    /^(?:none|n\/a|tba|tbd|not applicable|no prereq|no prerequisites|nil|--|-|—|–)$/i.test(trimmed)
  )
}

const extractCourseCodes = (value) => {
  if (!value) return []
  if (looksLikeEmptyDependency(value)) return []
  const sanitized = value.replace(/&/g, ',').replace(/\band\b/gi, ',')
  const matches = sanitized.toUpperCase().match(COURSE_CODE_REGEX)
  if (!matches) return []
  const seen = new Set()
  const codes = []
  matches.forEach((match) => {
    const normalized = normalizeCourseCode(match)
    if (normalized.length >= 3 && !seen.has(normalized)) {
      seen.add(normalized)
      codes.push(normalized)
    }
  })
  return codes
}

function parseCurriculumHtml(html) {
  const dom = new JSDOM(html)
  const doc = dom.window.document

  const tbody = doc.querySelector('tbody')
  if (!tbody) return []

  const courses = []
  let currentYear = 1
  let currentTerm = 'Term 1'

  const headerCells = Array.from(doc.querySelectorAll('thead th, thead td'))
  let unitsColIndex = null
  let prereqColIndex = null
  let requiredForColIndex = null
  if (headerCells.length > 0) {
    headerCells.forEach((th, idx) => {
      const txt = (th.textContent || '').trim()
      if (/unit|credit|units|credits/i.test(txt) && unitsColIndex === null) {
        unitsColIndex = idx
      }
      const normalized = txt.toLowerCase()
      if (prereqColIndex === null && /pre[\s-]?req|prerequisite/i.test(normalized) && !/co[\s-]?req/i.test(normalized)) {
        prereqColIndex = idx
      }
      if (requiredForColIndex === null && /(required\s*for|required[\s-]*for|dependent\s*courses?|dependents)/i.test(normalized)) {
        requiredForColIndex = idx
      }
    })
  }

  const pendingRequiredForLinks = []

  const rows = Array.from(tbody.querySelectorAll('tr'))
  rows.forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'))
    const rowText = tr.textContent?.trim() || ''

    if (tds.length === 1) {
      const header = rowText.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
      if (/first year|year 1|1st year/i.test(header)) currentYear = 1
      else if (/second year|year 2|2nd year/i.test(header)) currentYear = 2
      else if (/third year|year 3|3rd year/i.test(header)) currentYear = 3
      else if (/fourth year|year 4|4th year/i.test(header)) currentYear = 4

      const parenMatch = header.match(/\(([^)]+)\)/)
      let termText = parenMatch ? parenMatch[1] : header
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
        currentTerm = 'Term 1'
      }
      return
    }

    if (tds.length >= 2) {
      const code = tds[0].textContent?.trim() || ''
      const name = tds[1].textContent?.trim() || ''

      const parseCandidateNumber = (txt) => {
        if (!txt) return undefined
        const s = txt.trim()
        if (s.length === 0) return undefined
        const whole = s.match(/^(\d+)(?:\.\d+)?$/)
        if (whole) {
          const n = Number(whole[1])
          if (Number.isFinite(n) && n >= 0 && n <= 9) return n
        }
          // Scan digit runs and ensure surrounding characters are not letters
          const digitRe = /\d+/g
          let m
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

      let credits = undefined
      if (unitsColIndex !== null && unitsColIndex < tds.length) {
        credits = parseCandidateNumber(tds[unitsColIndex].textContent)
      }
      if (credits === undefined) {
        for (let i = 1; i < tds.length; i++) {
          const candidate = parseCandidateNumber(tds[i].textContent)
          if (candidate !== undefined) { credits = candidate; break }
        }
      }

      if (code || name) {
        const prereqText = prereqColIndex !== null && prereqColIndex < tds.length ? tds[prereqColIndex].textContent : null
        const requiredForText = requiredForColIndex !== null && requiredForColIndex < tds.length ? tds[requiredForColIndex].textContent : null

        const prereqCodes = extractCourseCodes(prereqText)
        const requiredForCodes = extractCourseCodes(requiredForText)

        const id = code || name.slice(0, 8).replace(/\s+/g, '_')
        const newCourse = { id, code: code || id, name: name || '', credits: credits ?? 0, status: 'pending', prerequisites: prereqCodes, description: null, year: currentYear, term: currentTerm }

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

  const codeToCourse = new Map()
  courses.forEach((course) => {
    if (course.code) {
      codeToCourse.set(normalizeCourseCode(course.code), course)
    }
  })

  courses.forEach((course) => {
    const resolved = []
    const seen = new Set()
    course.prerequisites.forEach((rawCode) => {
      const normalized = normalizeCourseCode(rawCode)
      const referenced = codeToCourse.get(normalized)
      if (referenced && referenced.id !== course.id && !seen.has(referenced.id)) {
        seen.add(referenced.id)
        resolved.push(referenced.id)
      }
    })
    course.prerequisites = resolved
  })

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

  return courses
}

let htmlPath = path.join(__dirname, '..', 'Program Curriculum.html')
if (!fs.existsSync(htmlPath)) {
  // fallback to sample
  htmlPath = path.join(__dirname, 'sample-curriculum.html')
  if (!fs.existsSync(htmlPath)) {
    console.error('No curriculum HTML found. Looked for Program Curriculum.html and sample-curriculum.html')
    process.exit(1)
  }
}

const html = fs.readFileSync(htmlPath, 'utf8')
const parsed = parseCurriculumHtml(html)
console.log(`Parsed ${parsed.length} courses:`)
parsed.forEach((c) => console.log(`${c.code} | ${c.name} | credits=${c.credits} | Year ${c.year} ${c.term}`))
