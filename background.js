// Chrome Extension Background Script
// Using standard JavaScript without ES modules

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractedCourseData") {
    console.log("Received course data from content script:", message.data.length, "courses")

    // Send the data to your backend
    fetch("https://compareng-coursetracker.vercel.app/api/receive-course-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message.data),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("HTTP error! Status: " + response.status)
        }
        return response.json()
      })
      .then((data) => {
        console.log("Data sent successfully:", data)
        sendResponse({ success: true, message: "Data sent to backend" })
      })
      .catch((error) => {
        console.error("Error sending data to backend:", error)
        sendResponse({ success: false, error: error.message })
      })

    return true // Keep the message channel open for the async response
  }
})
