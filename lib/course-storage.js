// Temporary in-memory storage for course data
// Note: This will reset when the server restarts or when deployed to Vercel
// In a production app, you would use a database
let courseDataStorage = []

// Function to update the storage
function updateCourseData(data) {
  if (!Array.isArray(data)) {
    console.error("updateCourseData: data is not an array", data)
    return
  }

  courseDataStorage = data
  console.log("Course data updated:", courseDataStorage.length, "courses")

  // Log the first course for debugging
  if (data.length > 0) {
    console.log("Sample course:", data[0])
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
export { courseDataStorage, updateCourseData, saveCourseStatuses, loadCourseStatuses }
