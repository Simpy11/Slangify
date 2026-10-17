import api from './api.js'

const timeout = Number(import.meta.env.VITE_AI_TIMEOUT_MS || 60000)
if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('VITE_AI_TIMEOUT_MS must be a positive number')

export async function getAiHealth(config = {}) {
  const response = await api.get('/ai/health', config)
  return response.data
}

async function requestAnswer(path, text, config) {
  const started = Date.now()
  try {
    const response = await api.post(path, { text }, { timeout, ...config })
    return response.data
  } catch (error) {
    // No input, URLs, credentials, or provider bodies in browser diagnostics.
    console.warn('AI request failed', { layer: 'react_to_express', duration_ms: Date.now() - started,
      status: error.response?.status ?? null,
      code: error.response?.data?.code || error.code,
      timeout_ms: timeout })
    throw error
  }
}

export function processWithAI(text, config = {}) {
  return requestAnswer('/ai/process', text, config)
}

export function queryAssistant(text, config = {}) {
  return requestAnswer('/assistant/query', text, config)
}
