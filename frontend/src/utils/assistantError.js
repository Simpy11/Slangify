const messages = {
  AI_PROVIDER_UNAVAILABLE: 'Gemini is temporarily unavailable or experiencing high demand. Try again later or search the slang dictionary.',
  AI_NOT_CONFIGURED: 'AI is not configured yet. Ask the site owner to configure Gemini, or search the slang dictionary.',
  AI_AUTH_ERROR: 'The AI service could not authenticate. Please contact the site owner or search the dictionary.',
  AI_QUOTA_EXCEEDED: 'The AI usage limit has been reached. Please try again later or search the slang dictionary.',
  AI_MODEL_UNAVAILABLE: 'The configured AI model is unavailable. Please contact the site owner or search the dictionary.',
  AI_TIMEOUT: 'The AI service took too long to respond. Please try again.',
  AI_SERVICE_UNAVAILABLE: 'The AI processing service is offline. Please try again later or search the slang dictionary.',
  AI_INVALID_REQUEST: 'The AI service configuration needs attention. Please contact the site owner.',
  AI_INVALID_RESPONSE: 'The AI service returned an incomplete answer. Please try again.',
  AI_NETWORK_ERROR: 'The AI provider could not be reached. Please try again later.',
}

export function getAssistantError(error) {
  const code = error.response?.data?.code
  if (Object.hasOwn(messages, code)) return messages[code]
  if (error.response?.status === 429) return messages.AI_QUOTA_EXCEEDED
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.response?.status === 504) return messages.AI_TIMEOUT
  return error.response?.status === 503
    ? 'AI explanation is temporarily unavailable. Try again or search the slang dictionary.'
    : "I couldn't reach Slangify right now. Please try again."
}
