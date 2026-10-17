import Slang from '../models/Slang.js'
import { requestPython } from './aiController.js'
import { classifyAssistantQuery, dictionaryCandidates, escapeRegex } from '../utils/assistantQuery.js'

import { getAiErrorCode, sendAssistantError } from '../utils/aiErrors.js'

function invalidInput(response, message) {
  return response.status(400).json({ success: false, message })
}

export async function queryAssistant(request, response) {
  if (typeof request.body?.text !== 'string') return invalidInput(response, 'Text is required')
  const text = request.body.text.trim()
  if (!text) return invalidInput(response, 'Text is required')
  if (text.length > 2000) return invalidInput(response, 'Text cannot exceed 2000 characters')

  // Greetings do not need a database or a paid provider call.
  if (/^(?:(?:hello|hi|hey|namaste|namaskar|\u0928\u092e\u0938\u094d\u0924\u0947|\u0928\u092e\u0938\u094d\u0915\u093e\u0930|\u0939\u0947\u0932\u094b)[\s!?,.]*)+$/iu.test(text)) {
    return response.json({ success: true, source: 'assistant', data: { message: 'Hello! Ask me about a slang word, or send an English, Hindi, or Hinglish phrase to explain.' } })
  }
  const query = classifyAssistantQuery(text)

  if (query.isSimple && query.dictionaryTerm) {
    try {
      for (const term of dictionaryCandidates(query.dictionaryTerm)) {
        const slang = await Slang.findOne({ word: new RegExp(`^${escapeRegex(term)}$`, 'i') }).lean()
        if (slang) return response.json({ success: true, source: 'dictionary', data: slang })
      }
    } catch {
      return response.status(500).json({ success: false, message: 'Dictionary search is temporarily unavailable.' })
    }
  }

  try {
    const result = await requestPython(request, '/api/process', {
      method: 'POST',
      body: JSON.stringify({ text: query.text }),
    })
    const data = result.payload
    if (!result.response.ok) {
      const retryAfter = result.response.headers.get('retry-after')
      if (retryAfter && /^\d+$/.test(retryAfter)) response.set('Retry-After', retryAfter)
      return sendAssistantError(response, getAiErrorCode(data?.code, result.response.status))
    }
    if (data?.source !== 'ai' || typeof data.translation !== 'string' || !data.translation.trim() || typeof data.explanation !== 'string' || !data.explanation.trim() || !Array.isArray(data.detectedSlang)) {
      return sendAssistantError(response, 'AI_INVALID_RESPONSE')
    }
    const { translation, explanation, detectedSlang } = data
    return response.json({
      success: true,
      source: 'ai',
      data: { original: text, translation, explanation, detectedSlang },
    })
  } catch (error) {
    return sendAssistantError(response, error.code)
  }
}
