// Temporary in-memory storage for course data
// Note: This will reset when the server restarts or when deployed to Vercel
// In a production app, you would use a database
const COURSE_DATA_TTL_MS = 60 * 60 * 1000 // 1 hour
const CURRICULUM_SIGNATURE_KEY = "courseCurriculumSignature"
const TRACKER_PREFERENCES_KEY = "courseTrackerPreferences"

/** @type {any[]} */
let courseDataStorage = []
let courseDataMeta = {
  updatedAt: 0,
  hash: "",
}

let latestGradeAttemptImport = {
  updatedAt: 0,
  payload: null,
}

/** @type {Record<string, any[]>} */
let courseDataStorageByTermYear = {}

/** @type {Record<string, { updatedAt: number; hash: string }>} */
let courseDataMetaByTermYear = {}

const getDiskCacheContext = () => {
  if (typeof window !== "undefined") return null

  try {
    // Use lazy require so client bundles that import this module do not pull Node-only deps.
    const fs = require("fs")
    const path = require("path")
    const os = require("os")
    const cachePath = path.join(os.tmpdir(), "compareng-course-data-cache.json")
    return { fs, cachePath }
  } catch {
    return null
  }
}

const readDiskCache = () => {
  const ctx = getDiskCacheContext()
  if (!ctx) return null

  try {
    if (!ctx.fs.existsSync(ctx.cachePath)) return null
    const raw = ctx.fs.readFileSync(ctx.cachePath, "utf8")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch (error) {
    console.error("Failed to read course cache from disk", error)
    return null
  }
}

const writeDiskCache = () => {
  const ctx = getDiskCacheContext()
  if (!ctx) return

  try {
    const payload = {
      courseDataStorage,
      courseDataMeta,
      courseDataStorageByTermYear,
      courseDataMetaByTermYear,
      latestGradeAttemptImport,
    }
    ctx.fs.writeFileSync(ctx.cachePath, JSON.stringify(payload), "utf8")
  } catch (error) {
    console.error("Failed to write course cache to disk", error)
  }
}

const syncFromDiskCache = () => {
  const parsed = readDiskCache()
  if (!parsed) return

  courseDataStorage = Array.isArray(parsed.courseDataStorage) ? parsed.courseDataStorage : []
  courseDataMeta = parsed.courseDataMeta && typeof parsed.courseDataMeta === "object"
    ? {
        updatedAt: Number(parsed.courseDataMeta.updatedAt) || 0,
        hash: typeof parsed.courseDataMeta.hash === "string" ? parsed.courseDataMeta.hash : "",
      }
    : { updatedAt: 0, hash: "" }

  courseDataStorageByTermYear =
    parsed.courseDataStorageByTermYear && typeof parsed.courseDataStorageByTermYear === "object"
      ? parsed.courseDataStorageByTermYear
      : {}

  courseDataMetaByTermYear =
    parsed.courseDataMetaByTermYear && typeof parsed.courseDataMetaByTermYear === "object"
      ? parsed.courseDataMetaByTermYear
      : {}

  latestGradeAttemptImport =
    parsed.latestGradeAttemptImport && typeof parsed.latestGradeAttemptImport === "object"
      ? {
          updatedAt: Number(parsed.latestGradeAttemptImport.updatedAt) || 0,
          payload: parsed.latestGradeAttemptImport.payload || null,
        }
      : { updatedAt: 0, payload: null }
}

const normalizeTermYearValue = (value) =>
  typeof value === "string" ? value.trim() : ""

const buildTermYearKey = (term, schoolYear) => {
  const normalizedTerm = normalizeTermYearValue(term)
  const normalizedSchoolYear = normalizeTermYearValue(schoolYear)
  if (!normalizedTerm || !normalizedSchoolYear) return ""
  return `${normalizedSchoolYear}::${normalizedTerm}`
}

const computeCurriculumSignature = (courses = []) => {
  if (!Array.isArray(courses)) return ""
  return courses
    .map((course) => [course?.id || "", course?.code || "", course?.name || ""].join("|"))
    .sort()
    .join("::")
}

const computeDataHash = (data) => {
  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error("Failed to hash course data", error)
    return `${Date.now()}-${Math.random()}`
  }
}

const clearCourseData = () => {
  syncFromDiskCache()
  courseDataStorage = []
  courseDataMeta = { updatedAt: 0, hash: "" }
  courseDataStorageByTermYear = {}
  courseDataMetaByTermYear = {}
  latestGradeAttemptImport = { updatedAt: 0, payload: null }
  writeDiskCache()
}

const updateGradeAttemptImport = (payload) => {
  syncFromDiskCache()

  const updatedAt = Date.now()
  latestGradeAttemptImport = {
    updatedAt,
    payload: payload && typeof payload === "object" ? payload : null,
  }

  writeDiskCache()

  return {
    updatedAt,
    hasPayload: Boolean(latestGradeAttemptImport.payload),
    runId: latestGradeAttemptImport?.payload?.runId || "",
  }
}

const getLatestGradeAttemptImport = () => {
  syncFromDiskCache()

  return {
    updatedAt: latestGradeAttemptImport.updatedAt || 0,
    payload: latestGradeAttemptImport.payload || null,
  }
}

const expireMetaIfNeeded = (meta) => {
  if (!meta?.updatedAt) return false
  const now = Date.now()
  if (now - meta.updatedAt > COURSE_DATA_TTL_MS) {
    return true
  }
  return false
}

const expireAllBucketsIfNeeded = () => {
  const now = Date.now()
  let expiredAny = false

  Object.keys(courseDataMetaByTermYear).forEach((key) => {
    const meta = courseDataMetaByTermYear[key]
    if (!meta?.updatedAt) return
    if (now - meta.updatedAt <= COURSE_DATA_TTL_MS) return

    delete courseDataMetaByTermYear[key]
    delete courseDataStorageByTermYear[key]
    expiredAny = true
  })

  if (expiredAny) {
    const latestSnapshot = getLatestBucketSnapshot()
    courseDataStorage = latestSnapshot?.data || []
    courseDataMeta = {
      updatedAt: latestSnapshot?.updatedAt || 0,
      hash: latestSnapshot?.hash || "",
    }
  }

  return expiredAny
}

const getLatestBucketSnapshot = () => {
  let latestKey = ""
  let latestUpdatedAt = 0

  Object.entries(courseDataMetaByTermYear).forEach(([key, meta]) => {
    if (!meta?.updatedAt) return
    if (meta.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = meta.updatedAt
      latestKey = key
    }
  })

  if (!latestKey) return null

  return {
    key: latestKey,
    data: courseDataStorageByTermYear[latestKey] || [],
    updatedAt: courseDataMetaByTermYear[latestKey]?.updatedAt || 0,
    hash: courseDataMetaByTermYear[latestKey]?.hash || "",
  }
}

// Function to update the storage
function updateCourseData(data) {
  syncFromDiskCache()

  if (!Array.isArray(data)) {
    console.error("updateCourseData: data is not an array", data)
    return { updatedAt: courseDataMeta.updatedAt, hasChanged: false }
  }

  if (data.length === 0) {
    console.warn("updateCourseData: empty course data received. Skipping storage update.")
    return { updatedAt: courseDataMeta.updatedAt, hasChanged: false }
  }

  const normalizedData = data.map((course) => ({ ...course }))
  const firstCourse = normalizedData[0] || {}
  const key = buildTermYearKey(firstCourse.term, firstCourse.schoolYear)

  if (!key) {
    console.error("updateCourseData: missing term/schoolYear key in payload", firstCourse)
    return { updatedAt: courseDataMeta.updatedAt, hasChanged: false }
  }

  const mixedKeys = normalizedData.some((course) => {
    return buildTermYearKey(course?.term, course?.schoolYear) !== key
  })

  if (mixedKeys) {
    console.error("updateCourseData: payload has mixed term/schoolYear values")
    return { updatedAt: courseDataMeta.updatedAt, hasChanged: false }
  }

  const incomingHash = computeDataHash(normalizedData)
  const previousMeta = courseDataMetaByTermYear[key] || { updatedAt: 0, hash: "" }
  const hasChanged = incomingHash !== previousMeta.hash

  const updatedAt = Date.now()

  courseDataStorageByTermYear[key] = normalizedData
  courseDataMetaByTermYear[key] = {
    updatedAt,
    hash: incomingHash,
  }

  // Keep legacy exports as "most recently updated" snapshot for compatibility.
  courseDataStorage = normalizedData
  courseDataMeta = {
    updatedAt,
    hash: incomingHash,
  }

  console.log("Course data updated:", courseDataStorage.length, "courses for", key)

  // Log the first course for debugging
  if (normalizedData.length > 0) {
    console.log("Sample course:", normalizedData[0])
  }

  writeDiskCache()

  return {
    updatedAt,
    hasChanged,
    term: normalizeTermYearValue(firstCourse.term),
    schoolYear: normalizeTermYearValue(firstCourse.schoolYear),
  }
}

const getCourseDataSnapshot = (term, schoolYear) => {
  syncFromDiskCache()

  const expiredAny = expireAllBucketsIfNeeded()
  if (expiredAny) {
    writeDiskCache()
  }

  const key = buildTermYearKey(term, schoolYear)

  if (key) {
    const data = courseDataStorageByTermYear[key] || []
    const meta = courseDataMetaByTermYear[key] || { updatedAt: 0, hash: "" }
    const isExpired = expireMetaIfNeeded(meta)
    if (isExpired) {
      delete courseDataStorageByTermYear[key]
      delete courseDataMetaByTermYear[key]
      writeDiskCache()
      return {
        data: [],
        updatedAt: 0,
        expiresAt: null,
        isExpired: true,
        term: normalizeTermYearValue(term),
        schoolYear: normalizeTermYearValue(schoolYear),
      }
    }

    return {
      data,
      updatedAt: meta.updatedAt,
      expiresAt: meta.updatedAt ? meta.updatedAt + COURSE_DATA_TTL_MS : null,
      isExpired: false,
      term: normalizeTermYearValue(term),
      schoolYear: normalizeTermYearValue(schoolYear),
      requestedTermYearKey: key,
    }
  }

  const latest = getLatestBucketSnapshot()
  return {
    data: latest?.data || [],
    updatedAt: latest?.updatedAt || 0,
    expiresAt: latest?.updatedAt ? latest.updatedAt + COURSE_DATA_TTL_MS : null,
    isExpired: expiredAny,
  }
}

// Function to save course statuses to localStorage
function saveCourseStatuses(courses) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("courseStatuses", JSON.stringify(courses))
      const signature = computeCurriculumSignature(courses)
      localStorage.setItem(CURRICULUM_SIGNATURE_KEY, signature)
      console.log("Course statuses saved to localStorage")
    } catch (error) {
      console.error("Error saving course statuses to localStorage:", error)
    }
  }
}

// Function to load course statuses from localStorage
function loadCourseStatuses() {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("courseStatuses")
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error("Error parsing saved course statuses:", error)
    }
  }
  return null
}

function loadCurriculumSignature() {
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem(CURRICULUM_SIGNATURE_KEY) || ""
    } catch (error) {
      console.error("Error loading curriculum signature:", error)
    }
  }
  return ""
}

function saveTrackerPreferences(preferences) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(TRACKER_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.error("Error saving tracker preferences:", error)
  }
}

function loadTrackerPreferences() {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(TRACKER_PREFERENCES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return {
      startYear: typeof parsed.startYear === "number" ? parsed.startYear : undefined,
      currentYearLevel: typeof parsed.currentYearLevel === "number" ? parsed.currentYearLevel : undefined,
      currentTerm: typeof parsed.currentTerm === "string" ? parsed.currentTerm : undefined,
    }
  } catch (error) {
    console.error("Error loading tracker preferences:", error)
  }
  return null
}

// Use ES Module exports
export {
  COURSE_DATA_TTL_MS,
  courseDataStorage,
  updateCourseData,
  updateGradeAttemptImport,
  getCourseDataSnapshot,
  getLatestGradeAttemptImport,
  clearCourseData,
  saveCourseStatuses,
  loadCourseStatuses,
  loadCurriculumSignature,
  saveTrackerPreferences,
  loadTrackerPreferences,
  TRACKER_PREFERENCES_KEY,
}
