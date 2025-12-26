// Export the initialCourses array for use in API routes
const initialCourses = [
  {
    id: "COE0001",
    code: "COE0001",
    name: "ENGINEERING MATHEMATICS 1",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "COE0003",
    code: "COE0003",
    name: "ENGINEERING MATHEMATICS 2",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "COE0005",
    code: "COE0005",
    name: "CHEMISTRY FOR ENGINEERS 1",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "GED0001",
    code: "GED0001",
    name: "SPECIALIZED ENGLISH PROGRAM 1",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "GED0004",
    code: "GED0004",
    name: "PHYSICAL EDUCATION 1",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "GED0006",
    code: "GED0006",
    name: "PERSONAL AND PROFESSIONAL EFFECTIVENESS",
    credits: 2,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "GED0007",
    code: "GED0007",
    name: "ART APPRECIATION",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "NSTP1",
    code: "NSTP1",
    name: "CIVIC WELFARE TRAINING SERVICE 1",
    credits: 0,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 1",
  },
  {
    id: "COE0007",
    code: "COE0007",
    name: "CALCULUS 1",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0001", "COE0003"],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "COE0009",
    code: "COE0009",
    name: "PHYSICS FOR ENGINEERS 1 (LEC)",
    credits: 2,
    status: "pending",
    prerequisites: ["COE0001", "COE0003"],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "COE0009L",
    code: "COE0009L",
    name: "PHYSICS FOR ENGINEERS 1 (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["COE0001", "COE0003"],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "GED0015",
    code: "GED0015",
    name: "PHYSICAL EDUCATION 2",
    credits: 3,
    status: "pending",
    prerequisites: ["GED0004"],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "GED0019",
    code: "GED0019",
    name: "UNDERSTANDING THE SELF",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "GED0021",
    code: "GED0021",
    name: "SPECIALIZED ENGLISH PROGRAM 2",
    credits: 3,
    status: "pending",
    prerequisites: ["GED0001"],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "GED0027",
    code: "GED0027",
    name: "MATHEMATICS IN THE MODERN WORLD",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "GED0085",
    code: "GED0085",
    name: "GENDER AND SOCIETY",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 2",
  },
  {
    id: "COE0011",
    code: "COE0011",
    name: "ENGINEERING DATA ANALYSIS",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0007"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "COE0013",
    code: "COE0013",
    name: "CALCULUS 2",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0007"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "COE0015",
    code: "COE0015",
    name: "PHYSICS FOR ENGINEERS 2 (LEC)",
    credits: 2,
    status: "pending",
    prerequisites: ["COE0009", "COE0007"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "COE0015L",
    code: "COE0015L",
    name: "PHYSICS FOR ENGINEERS 2 (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["COE0009", "COE0007"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "COE0017",
    code: "COE0017",
    name: "CHEMISTRY FOR ENGINEERS 2 (LEC)",
    credits: 2,
    status: "pending",
    prerequisites: ["COE0005"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "COE0017L",
    code: "COE0017L",
    name: "CHEMISTRY FOR ENGINEERS 2 (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["COE0005"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "GED0023",
    code: "GED0023",
    name: "PHYSICAL EDUCATION 3",
    credits: 3,
    status: "pending",
    prerequisites: ["GED0015"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "GED0031",
    code: "GED0031",
    name: "PURPOSIVE COMMUNICATION",
    credits: 3,
    status: "pending",
    prerequisites: ["GED0021"],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "NSTP2",
    code: "NSTP2",
    name: "CIVIC WELFARE TRAINING SERVICE 2",
    credits: 0,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 1,
    term: "Term 3",
  },
  {
    id: "COE0019",
    code: "COE0019",
    name: "DIFFERENTIAL EQUATIONS",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0013"],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "COE0025L",
    code: "COE0025L",
    name: "COMPUTER AIDED DRAFTING",
    credits: 1,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "CPE0001",
    code: "CPE0001",
    name: "COMPUTER ENGINEERING AS A DISCIPLINE",
    credits: 1,
    status: "pending",
    prerequisites: ["GED0006"],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "CPE0003L",
    code: "CPE0003L",
    name: "Programming Logic and Design",
    credits: 2,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "CPE0004L",
    code: "CPE0004L",
    name: "COMPUTER HARDWARE FUNDAMENTALS",
    credits: 1,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "CPE0005",
    code: "CPE0005",
    name: "FUNDAMENTALS OF ELECTRICAL CIRCUITS (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0015"],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "CPE0005L",
    code: "CPE0005L",
    name: "FUNDAMENTALS OF ELECTRICAL CIRCUITS (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["COE0015"],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "GED0009",
    code: "GED0009",
    name: "READINGS IN PHILIPPINE HISTORY",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "GED0035",
    code: "GED0035",
    name: "THE CONTEMPORARY WORLD",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 1",
  },
  {
    id: "COE0020",
    code: "COE0020",
    name: "G.E. ELECTIVE – BIOENGINEERING",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "CPE0007L",
    code: "CPE0007L",
    name: "Computer Programming for CpE",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0003L"],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "CPE0009",
    code: "CPE0009",
    name: "DISCRETE MATHEMATICS FOR CPE",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0011"],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "CPE0011",
    code: "CPE0011",
    name: "FUNDAMENTALS OF ELECTRONIC CIRCUITS (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0005"],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "CPE0011L",
    code: "CPE0011L",
    name: "FUNDAMENTALS OF ELECTRONIC CIRCUITS (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0005"],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "CPE0013",
    code: "CPE0013",
    name: "NUMERICAL METHODS FOR CPE",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0019"],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "GED0011",
    code: "GED0011",
    name: "SCIENCE, TECHNOLOGY AND SOCIETY",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "GED0043",
    code: "GED0043",
    name: "SPECIALIZED ENGLISH PROGRAM 3",
    credits: 3,
    status: "pending",
    prerequisites: ["GED0031"],
    description: null,
    year: 2,
    term: "Term 2",
  },
  {
    id: "COE0039",
    code: "COE0039",
    name: "ENGINEERING ECONOMICS",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0011"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0015L",
    code: "CPE0015L",
    name: "COMPUTER ENGINEERING DRAFTING AND DESIGN",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0011"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0017L",
    code: "CPE0017L",
    name: "OBJECT ORIENTED PROGRAMMING",
    credits: 2,
    status: "pending",
    prerequisites: ["CPE0007L"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0019",
    code: "CPE0019",
    name: "FUNDAMENTALS OF MIXED SIGNALS AND SENSORS",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0011"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0021",
    code: "CPE0021",
    name: "LOGIC CIRCUITS AND DESIGN (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0011"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0021L",
    code: "CPE0021L",
    name: "LOGIC CIRCUITS AND DESIGN (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0011"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0023",
    code: "CPE0023",
    name: "DATA AND DIGITAL COMMUNICATION",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0011"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "CPE0025",
    code: "CPE0025",
    name: "FEEDBACK AND CONTROL SYSTEM",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0005", "CPE0013"],
    description: null,
    year: 2,
    term: "Term 3",
  },
  {
    id: "COE0049",
    code: "COE0049",
    name: "ENGINEERING MANAGEMENT",
    credits: 2,
    status: "pending",
    prerequisites: ["COE0039"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "COE0057",
    code: "COE0057",
    name: "DESIGN THINKING FOR ENGINEERS",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "CPE0027L",
    code: "CPE0027L",
    name: "Introduction to HDL",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0021"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "CPE0029",
    code: "CPE0029",
    name: "MICROPROCESSORS (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0021"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "CPE0029L",
    code: "CPE0029L",
    name: "MICROPROCESSORS (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0021"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "CPE0031",
    code: "CPE0031",
    name: "COMPUTER NETWORKS AND SECURITY (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0023"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "CPE0031L",
    code: "CPE0031L",
    name: "COMPUTER NETWORKS AND SECURITY (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0023"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "CPE0071",
    code: "CPE0071",
    name: "TECHNICAL ELECTIVE FOR CPE",
    credits: 2,
    status: "pending",
    prerequisites: ["CPE0021"],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "GED0049",
    code: "GED0049",
    name: "LIFE AND WORKS OF RIZAL",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 3,
    term: "Term 1",
  },
  {
    id: "COE0059",
    code: "COE0059",
    name: "TECHNOPRENEURSHIP FOR ENGINEERS",
    credits: 3,
    status: "pending",
    prerequisites: ["COE0049", "COE0057"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0033L",
    code: "CPE0033L",
    name: "DATA STRUCTURES AND ALGORITHMS FOR CPE",
    credits: 2,
    status: "pending",
    prerequisites: ["CPE0017L"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0035",
    code: "CPE0035",
    name: "EMBEDDED SYSTEMS (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0029"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0035L",
    code: "CPE0035L",
    name: "EMBEDDED SYSTEMS (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0029"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0037",
    code: "CPE0037",
    name: "COMPUTER ARCHITECTURE AND ORGANIZATION (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0029"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0037L",
    code: "CPE0037L",
    name: "COMPUTER ARCHITECTURE AND ORGANIZATION (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0029"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0039L",
    code: "CPE0039L",
    name: "Introduction to Database",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0017L"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0041",
    code: "CPE0041",
    name: "COGNATE/TRACK COURSE 1",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0031"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0043",
    code: "CPE0043",
    name: "Methods of Research for CPE",
    credits: 2,
    status: "pending",
    prerequisites: ["CPE0029", "GED0043", "COE0049"],
    description: null,
    year: 3,
    term: "Term 2",
  },
  {
    id: "CPE0045L",
    code: "CPE0045L",
    name: "CpE Practice and Design 1",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0043", "COE0059"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0047",
    code: "CPE0047",
    name: "OPERATING SYSTEMS (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0037"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0047L",
    code: "CPE0047L",
    name: "OPERATING SYSTEMS (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0037"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0049",
    code: "CPE0049",
    name: "SOFTWARE DESIGN (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0033L"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0049L",
    code: "CPE0049L",
    name: "SOFTWARE DESIGN (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0033L"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0051",
    code: "CPE0051",
    name: "EMERGING TECHNOLOGIES IN CPE",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0029"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0053L",
    code: "CPE0053L",
    name: "Seminars and Field Trips",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0029"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "CPE0055",
    code: "CPE0055",
    name: "COGNATE/TRACK COURSE 2",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0041"],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "GED0047",
    code: "GED0047",
    name: "FOREIGN LANGUAGE",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 3,
    term: "Term 3",
  },
  {
    id: "COE0061",
    code: "COE0061",
    name: "PROFESSIONAL DEVELOPMENT FOR ENGINEERS",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0001"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0057L",
    code: "CPE0057L",
    name: "CPE PRACTICE AND DESIGN 2",
    credits: 2,
    status: "pending",
    prerequisites: ["CPE0045L"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0059",
    code: "CPE0059",
    name: "DIGITAL SIGNAL PROCESSING (LEC)",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0025"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0059L",
    code: "CPE0059L",
    name: "DIGITAL SIGNAL PROCESSING (LAB)",
    credits: 1,
    status: "pending",
    prerequisites: ["CPE0025"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0061",
    code: "CPE0061",
    name: "CPE LAWS AND PROFESSIONAL PRACTICE",
    credits: 2,
    status: "pending",
    prerequisites: ["CPE0051"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0063",
    code: "CPE0063",
    name: "BASIC OCCUPATIONAL HEALTH AND SAFETY",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0051"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0065",
    code: "CPE0065",
    name: "COGNATE/TRACK COURSE 3",
    credits: 3,
    status: "pending",
    prerequisites: ["CPE0055"],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "GED0061",
    code: "GED0061",
    name: "ETHICS",
    credits: 3,
    status: "pending",
    prerequisites: [],
    description: null,
    year: 4,
    term: "Term 1",
  },
  {
    id: "CPE0067",
    code: "CPE0067",
    name: "INTERNSHIP 1 FOR CPE",
    credits: 9,
    status: "pending",
    prerequisites: ["CPE0031", "CPE0061"],
    description: null,
    year: 4,
    term: "Term 2",
  },
  {
    id: "CPE0069",
    code: "CPE0069",
    name: "INTERNSHIP 2 for CPE",
    credits: 9,
    status: "pending",
    prerequisites: ["CPE0067"],
    description: null,
    year: 4,
    term: "Term 3",
  },
]

// Extract just the course codes for filtering (always uppercase)
const curriculumCodes = initialCourses.map((course) => course.code.toUpperCase())

// Track canonical course codes for alias resolution
const canonicalCourseCodeSet = new Set(curriculumCodes)

// Map legacy/alias course codes to their canonical equivalent
const courseCodeAliasMap = new Map()

// Create a map of course codes to course details for quick lookup
const courseDetailsMap = initialCourses.reduce((map, course) => {
  map[course.code.toUpperCase()] = course
  return map
}, {})

const normalizeCourseCode = (code = "") => code.trim().toUpperCase()

const addCanonicalCourseCode = (code = "") => {
  const normalized = normalizeCourseCode(code)
  if (!normalized) return ""

  if (!canonicalCourseCodeSet.has(normalized)) {
    canonicalCourseCodeSet.add(normalized)
    curriculumCodes.push(normalized)
  }

  return normalized
}

const registerCourseCodeAliases = (aliases = {}) => {
  if (!aliases) return

  // Accept either an object map or an array of { alias, canonical }
  const entries = Array.isArray(aliases)
    ? aliases
    : Object.entries(aliases).map(([alias, canonical]) => ({ alias, canonical }))

  entries.forEach((entry) => {
    if (!entry) return
    const aliasCode = normalizeCourseCode(entry.alias || entry.legacy || entry.code || "")
    const canonicalCode = addCanonicalCourseCode(entry.canonical || entry.target || entry.new || "")
    if (!aliasCode || !canonicalCode) return

    // Do not alias a code to itself; this keeps labs distinct when identical
    if (aliasCode === canonicalCode) return

    courseCodeAliasMap.set(aliasCode, canonicalCode)
  })
}

const getAliasesForCanonical = (canonical = "") => {
  const normalized = normalizeCourseCode(canonical)
  if (!normalized) return []
  const aliases = []
  courseCodeAliasMap.forEach((target, alias) => {
    if (target === normalized) {
      aliases.push(alias)
    }
  })
  return aliases
}

const registerCourseDetails = (courseLike = {}) => {
  if (!courseLike) return null
  const rawCode = courseLike.code || courseLike.courseCode || courseLike.id || ""
  const canonical = addCanonicalCourseCode(rawCode)
  if (!canonical) return null

  const existing = courseDetailsMap[canonical] || {}
  const prerequisites = Array.isArray(courseLike.prerequisites)
    ? courseLike.prerequisites
    : existing.prerequisites || []

  const aliases = Array.isArray(courseLike.aliases)
    ? courseLike.aliases.map((alias) => normalizeCourseCode(alias)).filter(Boolean)
    : []

  if (aliases.length > 0) {
    registerCourseCodeAliases(aliases.map((alias) => ({ alias, canonical })))
  }

  const normalizedDetails = {
    ...existing,
    ...courseLike,
    id: courseLike.id || existing.id || canonical,
    code: canonical,
    name: courseLike.name || existing.name || canonical,
    credits:
      typeof courseLike.credits === "number"
        ? courseLike.credits
        : existing.credits !== undefined
          ? existing.credits
          : 0,
    status: courseLike.status || existing.status || "pending",
    prerequisites,
    description:
      courseLike.description !== undefined
        ? courseLike.description
        : existing.description ?? null,
    year:
      courseLike.year !== undefined
        ? courseLike.year
        : existing.year !== undefined
          ? existing.year
          : null,
    term:
      courseLike.term !== undefined
        ? courseLike.term
        : existing.term !== undefined
          ? existing.term
          : null,
  }

  courseDetailsMap[canonical] = normalizedDetails
  return normalizedDetails
}

const registerExternalCourses = (courses = []) => {
  if (!Array.isArray(courses)) return

  courses.forEach((course) => {
    if (!course) return
    if (typeof course === "string") {
      addCanonicalCourseCode(course)
      return
    }
    registerCourseDetails(course)
  })
}

const registerExternalCourseCodes = (codes = []) => {
  if (!Array.isArray(codes)) return
  codes.forEach((code) => addCanonicalCourseCode(code))
}

const collapseAliasSuffix = (code = "") => {
  let candidate = code
  while (candidate.length > 0) {
    const lastChar = candidate[candidate.length - 1]
    if (!/[A-Z]/.test(lastChar)) break

    // Preserve canonical lab variants (suffix "L") so they remain distinct courses.
    if (lastChar === "L" && canonicalCourseCodeSet.has(candidate)) break

    const shorter = candidate.slice(0, -1)
    if (!shorter) break
    if (canonicalCourseCodeSet.has(shorter)) {
      candidate = shorter
      continue
    }
    break
  }
  return candidate
}

const resolveCanonicalCourseCode = (rawCode = "") => {
  if (!rawCode) return ""
  const normalized = normalizeCourseCode(rawCode)

  // First resolve through explicit alias mappings
  const mapped = courseCodeAliasMap.get(normalized)
  if (mapped) {
    return collapseAliasSuffix(mapped)
  }

  if (canonicalCourseCodeSet.has(normalized)) return collapseAliasSuffix(normalized)

  let candidate = normalized
  while (candidate.length > 0) {
    candidate = candidate.slice(0, -1)
    if (candidate.length === 0) break
    if (canonicalCourseCodeSet.has(candidate)) {
      return collapseAliasSuffix(candidate)
    }
  }

  return normalized
}

const getCourseDetailsByCode = (rawCode = "") => {
  const canonical = resolveCanonicalCourseCode(rawCode)
  return courseDetailsMap[canonical] || null
}

export {
  initialCourses,
  curriculumCodes,
  courseDetailsMap,
  getAliasesForCanonical,
  resolveCanonicalCourseCode,
  getCourseDetailsByCode,
  registerCourseCodeAliases,
  registerExternalCourses,
  registerExternalCourseCodes,
}
