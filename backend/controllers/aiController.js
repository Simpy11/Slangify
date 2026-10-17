import { getAiErrorCode, sendAssistantError } from '../utils/aiErrors.js'
const REQUEST_TIMEOUT_MS = 55000
const unavailableMessage = 'AI processing service is currently unavailable.'

export async function requestPython(request, path, options = {}) {
  const serviceUrl = request.app.locals.pythonServiceUrl
  if (!serviceUrl) {
    throw Object.assign(new Error(unavailableMessage), { status: 503, code: 'AI_SERVICE_UNAVAILABLE' })
  }

  const started = Date.now()
  let upstreamStatus = null
  let code = 'OK'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), request.app.locals.pythonTimeoutMs || REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${serviceUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    })

    upstreamStatus = response.status
    let payload
    try {
      payload = await response.json()
    } catch {
      if (controller.signal.aborted) throw new DOMException('aborted', 'AbortError')
      if (!response.ok) payload = {}
      else throw Object.assign(new Error('Invalid response from processing service'), { status: 502, code: 'AI_INVALID_RESPONSE' })
    }

    if (!response.ok) code = getAiErrorCode(payload?.code, response.status)
    return { response, payload }
  } catch (error) {
    code = controller.signal.aborted ? 'AI_TIMEOUT' : error.code || 'AI_SERVICE_UNAVAILABLE'
    if (error.status === 502) throw error
    throw Object.assign(new Error(unavailableMessage), { status: controller.signal.aborted ? 504 : 503, code: controller.signal.aborted ? 'AI_TIMEOUT' : 'AI_SERVICE_UNAVAILABLE' })
  } finally {
    clearTimeout(timeout)
    console.info(JSON.stringify({ event: 'ai_request', layer: 'express_to_python',
      duration_ms: Date.now() - started, upstream_status: upstreamStatus, code,
      timeout_ms: request.app.locals.pythonTimeoutMs || REQUEST_TIMEOUT_MS }))
  }
}

function upstreamError(response, upstreamResponse, payload) {
  if (upstreamResponse.status >= 400 && upstreamResponse.status < 500) {
    return response.status(upstreamResponse.status).json({
      success: false,
      message: typeof payload?.message === 'string' ? payload.message : 'Processing request was rejected.',
    })
  }
  return response.status(502).json({ success: false, message: unavailableMessage })
}

function sendProxyError(response, error) {
  return sendAssistantError(response, error.code)
}

export async function getAiHealth(request, response) {
  try {
    const result = await requestPython(request, '/health')
    if (!result.response.ok) return upstreamError(response, result.response, result.payload)
    return response.json({ success: true, data: result.payload })
  } catch (error) {
    return sendProxyError(response, error)
  }
}

export async function processWithAi(request, response) {
  try {
    const result = await requestPython(request, '/api/process', {
      method: 'POST',
      body: JSON.stringify(request.body),
    })
    if (!result.response.ok) {
      const retryAfter = result.response.headers.get('retry-after')
      if (retryAfter && /^\d+$/.test(retryAfter)) response.set('Retry-After', retryAfter)
      if (result.payload?.code || [401, 403, 429, 503, 504].includes(result.response.status)) {
        return sendAssistantError(response, getAiErrorCode(result.payload?.code, result.response.status))
      }
      return upstreamError(response, result.response, result.payload)
    }
    return response.json(result.payload)
  } catch (error) {
    return sendProxyError(response, error)
  }
}
