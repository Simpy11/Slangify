import request from 'supertest'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp } from '../app.js'

const app = createApp('http://localhost:5173', 'http://python.internal:8000', { pythonTimeoutMs: 50 })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Express to FastAPI proxy', () => {
  test('malformed JSON never echoes request content in errors', async () => {
    const response = await request(app).post('/api/assistant/query')
      .set('Content-Type', 'application/json').send('{"private-input":')
    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Request body must be valid JSON')
    expect(JSON.stringify(response.body)).not.toContain('private-input')
  })

  test('proxies the Python health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', service: 'slangify-python' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(app).get('/api/ai/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true, data: { status: 'ok', service: 'slangify-python' } })
    expect(fetchMock).toHaveBeenCalledWith('http://python.internal:8000/health', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  test.each([false, true])('forwards actual provider configured=%s from the selected instance', async (configured) => {
    const configuredApp = createApp('http://localhost:5173', 'http://127.0.0.1:8001')
    const health = { status: 'ok', service: 'slangify-python', provider: { name: 'gemini', model: 'gemini-2.5-flash', configured } }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(health), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await request(configuredApp).get('/api/ai/health')
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(health)
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8001/health')
  })

  test('proxies process input and its structural response', async () => {
    const payload = {
      success: true,
      input: 'What does delulu mean?',
      message: 'Python processing service is connected.',
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(app).post('/api/ai/process').send({ text: payload.input })
    expect(response.status).toBe(200)
    expect(response.body).toEqual(payload)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: payload.input })
  })

  test('preserves safe FastAPI validation failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: 'Invalid request data.',
    }), { status: 422, headers: { 'Content-Type': 'application/json' } })))

    const response = await request(app).post('/api/ai/process').send({ text: '' })
    expect(response.status).toBe(422)
    expect(response.body).toEqual({ success: false, message: 'Invalid request data.' })
  })

  test('maps FastAPI server failures to a safe gateway error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'private failure' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })))

    const response = await request(app).get('/api/ai/health')
    expect(response.status).toBe(502)
    expect(response.body.message).toBe('AI processing service is currently unavailable.')
    expect(JSON.stringify(response.body)).not.toContain('private failure')
  })

  test('returns 503 without crashing when FastAPI is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused at private URL')))
    const response = await request(app).post('/api/ai/process').send({ text: 'rizz' })
    expect(response.status).toBe(503)
    expect(response.body.code).toBe('AI_SERVICE_UNAVAILABLE')
  })

  test('aborts an unresponsive FastAPI request after the configured timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const startedAt = Date.now()
    const response = await request(app).get('/api/ai/health')
    expect(response.status).toBe(504)
    expect(response.body.code).toBe('AI_TIMEOUT')
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(40)
  })

  test('returns 502 for a non-JSON Python response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })))
    const response = await request(app).get('/api/ai/health')
    expect(response.status).toBe(502)
    expect(response.body.code).toBe('AI_INVALID_RESPONSE')
  })

  test('returns 503 when the Python URL is not configured', async () => {
    const unconfiguredApp = createApp('http://localhost:5173', '')
    const response = await request(unconfiguredApp).get('/api/ai/health')
    expect(response.status).toBe(503)
  })
})


test('preserves Gemini diagnostics and Retry-After through the AI proxy', async () => {
  const app = createApp('http://localhost:5173', 'http://python.test')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: false, code: 'AI_QUOTA_EXCEEDED', message: 'private upstream details',
  }), { status: 429, headers: { 'Retry-After': '60' } })))
  const response = await request(app).post('/api/ai/process').send({ text: 'some slang' })
  expect(response.status).toBe(429)
  expect(response.body.code).toBe('AI_QUOTA_EXCEEDED')
  expect(response.headers['retry-after']).toBe('60')
  expect(response.body.message).not.toContain('private upstream details')
  vi.unstubAllGlobals()
})


test.each([429, 503, 504])('preserves upstream HTTP %s even without a JSON code', async (status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status })))
  const response = await request(app).post('/api/ai/process').send({ text: 'some slang' })
  expect(response.status).toBe(status)
  expect(response.body.code).toBe(({ 429: 'AI_QUOTA_EXCEEDED', 503: 'AI_PROVIDER_UNAVAILABLE', 504: 'AI_TIMEOUT' })[status])
})

test('deadline also covers a stalled Python response body', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({
    status: 200, ok: true,
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }),
  })))
  const response = await request(app).post('/api/ai/process').send({ text: 'some slang' })
  expect(response.status).toBe(504)
  expect(response.body.code).toBe('AI_TIMEOUT')
})
