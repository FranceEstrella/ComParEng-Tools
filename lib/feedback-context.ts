let lastHint = ""
let lastUpdated = 0

export const setFeedbackContextHint = (hint: string) => {
  lastHint = hint || ""
  lastUpdated = Date.now()
}

export const getFeedbackContextHint = () => {
  return { hint: lastHint, updatedAt: lastUpdated }
}

export const clearFeedbackContextHint = () => {
  lastHint = ""
  lastUpdated = 0
}
