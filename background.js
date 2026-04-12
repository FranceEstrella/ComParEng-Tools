// Chrome Extension Background Script
// Using standard JavaScript without ES modules

const DATA_TARGET_KEY = "comparengDataUploadTarget"
const CUSTOM_ENDPOINT_KEY = "comparengCustomDataEndpoint"

const DATA_ENDPOINTS = {
  production: "https://compareng-tools.vercel.app/api/receive-course-data",
  localhost: "http://localhost:3000/api/receive-course-data",
  localhost127: "http://127.0.0.1:3000/api/receive-course-data",
  legacy: "https://compareng-coursetracker.vercel.app/api/receive-course-data",
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve)
  })
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve)
  })
}

function normalizeTarget(value) {
  const target = String(value || "").trim().toLowerCase()
  if (target === "production" || target === "localhost" || target === "localhost127" || target === "legacy" || target === "custom") {
    return target
  }
  return "production"
}

async function getUploadTargetConfig() {
  const stored = await storageGet([DATA_TARGET_KEY, CUSTOM_ENDPOINT_KEY])
  const target = normalizeTarget(stored?.[DATA_TARGET_KEY])
  const customEndpoint = String(stored?.[CUSTOM_ENDPOINT_KEY] || "").trim()
  const endpoint = target === "custom" ? customEndpoint : DATA_ENDPOINTS[target]

  return {
    target,
    endpoint,
    customEndpoint,
    endpoints: DATA_ENDPOINTS,
  }
}

async function setUploadTargetConfig(targetInput, customEndpointInput) {
  const target = normalizeTarget(targetInput)
  const customEndpoint = String(customEndpointInput || "").trim()

  if (target === "custom" && !/^https?:\/\//i.test(customEndpoint)) {
    throw new Error("Custom endpoint must start with http:// or https://")
  }

  await storageSet({
    [DATA_TARGET_KEY]: target,
    [CUSTOM_ENDPOINT_KEY]: customEndpoint,
  })

  return getUploadTargetConfig()
}

async function postExtractedCourseData(courseData, overrideTarget) {
  const config = await getUploadTargetConfig()
  const target = normalizeTarget(overrideTarget || config.target)
  const endpoint = target === "custom" ? config.customEndpoint : DATA_ENDPOINTS[target]

  if (!endpoint) {
    throw new Error("No upload endpoint configured. Set a custom endpoint in developer options.")
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(courseData),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`)
  }

  let parsed = null
  try {
    parsed = await response.json()
  } catch {
    parsed = { success: true }
  }

  return {
    target,
    endpoint,
    response: parsed,
  }
}

// Listen for messages from content script and popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    const action = message?.action

    if (action === "getDataUploadTarget") {
      const config = await getUploadTargetConfig()
      sendResponse({ success: true, ...config })
      return
    }

    if (action === "setDataUploadTarget") {
      const config = await setUploadTargetConfig(message?.target, message?.customEndpoint)
      sendResponse({ success: true, ...config })
      return
    }

    if (action === "extractedCourseData") {
      const count = Array.isArray(message?.data) ? message.data.length : 0
      console.log("Received course data from content script:", count, "courses")

      if (!Array.isArray(message?.data)) {
        sendResponse({ success: false, error: "Payload must be an array of extracted courses." })
        return
      }

      const result = await postExtractedCourseData(message.data, message?.target)
      console.log("Data sent successfully:", result.endpoint, result.response)
      sendResponse({
        success: true,
        target: result.target,
        endpoint: result.endpoint,
        message: "Data sent to backend",
        backend: result.response,
      })
      return
    }

    sendResponse({ success: false, error: `Unknown action: ${String(action || "")}` })
  })().catch((error) => {
    console.error("Background message handling failed:", error)
    sendResponse({ success: false, error: error?.message || String(error) })
  })

  return true // Keep the message channel open for async responses.
})
