// Temporary in-memory storage for course data
// Note: This will reset when the server restarts or when deployed to Vercel
// In a production app, you would use a database
const COURSE_DATA_TTL_MS = 60 * 60 * 1000 // 1 hour

/** @type {any[]} */
let courseDataStorage = []
let courseDataMeta = {
  updatedAt: 0,
  hash: "",
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
  courseDataStorage = []
  courseDataMeta = { updatedAt: 0, hash: "" }
}

const expireCourseDataIfNeeded = () => {
  if (!courseDataMeta.updatedAt) return false
  const now = Date.now()
  if (now - courseDataMeta.updatedAt > COURSE_DATA_TTL_MS) {
    clearCourseData()
    return true
  }
  return false
}

// Function to update the storage
function updateCourseData(data) {
  if (!Array.isArray(data)) {
    console.error("updateCourseData: data is not an array", data)
    return { updatedAt: courseDataMeta.updatedAt, hasChanged: false }
  }

  const normalizedData = data.map((course) => ({ ...course }))
  const incomingHash = computeDataHash(normalizedData)
  const hasChanged = incomingHash !== courseDataMeta.hash

  courseDataStorage = normalizedData
  courseDataMeta = {
    updatedAt: Date.now(),
    hash: incomingHash,
  }

  console.log("Course data updated:", courseDataStorage.length, "courses")

  // Log the first course for debugging
  if (normalizedData.length > 0) {
    console.log("Sample course:", normalizedData[0])
  }

  return { updatedAt: courseDataMeta.updatedAt, hasChanged }
}

const getCourseDataSnapshot = () => {
  const isExpired = expireCourseDataIfNeeded()
  return {
    data: courseDataStorage,
    updatedAt: courseDataMeta.updatedAt,
    expiresAt: courseDataMeta.updatedAt ? courseDataMeta.updatedAt + COURSE_DATA_TTL_MS : null,
    isExpired,
  }
}

// Function to save course statuses to localStorage
function saveCourseStatuses(courses) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("courseStatuses", JSON.stringify(courses))
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

// Use ES Module exports
export {
  COURSE_DATA_TTL_MS,
  courseDataStorage,
  updateCourseData,
  getCourseDataSnapshot,
  clearCourseData,
  saveCourseStatuses,
  loadCourseStatuses,
}
