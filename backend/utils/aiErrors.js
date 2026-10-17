// Only these public codes/messages cross the internal AI service boundary.
const errors = {
  AI_NOT_CONFIGURED: [503, 'AI is not configured yet. Add the Gemini API key on the server; dictionary search is still available.'],
  AI_AUTH_ERROR: [503, 'The AI service credentials were rejected. Check the server API key and its permissions.'],
  AI_QUOTA_EXCEEDED: [429, 'Gemini quota or rate limit exceeded. Check provider quota and billing, or try again later.'],
  AI_MODEL_UNAVAILABLE: [503, 'The configured AI model is unavailable. Check the server model setting.'],
  AI_TIMEOUT: [504, 'The AI service took too long to respond. Please try again.'],
  AI_SERVICE_UNAVAILABLE: [503, 'The AI processing service is offline. Please try again later or search the dictionary.'],
  AI_INVALID_REQUEST: [502, 'The AI provider rejected the request. Check the server model configuration.'],
  AI_INVALID_RESPONSE: [502, 'The AI service returned an incomplete answer. Please try again.'],
  AI_NETWORK_ERROR: [503, 'The AI provider could not be reached. Please try again later.'],
  AI_PROVIDER_UNAVAILABLE: [503, 'Gemini is temporarily unavailable or experiencing high demand. Try again later or search the slang dictionary.'],
}

export function getAiErrorCode(code, status) {
  if (Object.hasOwn(errors, code)) return code
  return ({ 401: 'AI_AUTH_ERROR', 403: 'AI_AUTH_ERROR', 429: 'AI_QUOTA_EXCEEDED',
    504: 'AI_TIMEOUT' })[status] || 'AI_PROVIDER_UNAVAILABLE'
}

export function sendAssistantError(response, code) {
  const safeCode = Object.hasOwn(errors, code) ? code : 'AI_PROVIDER_UNAVAILABLE'
  const [status, message] = errors[safeCode]
  console.warn(`Assistant request failed (${safeCode})`)
  return response.status(status).json({ success: false, code: safeCode, message })
}
