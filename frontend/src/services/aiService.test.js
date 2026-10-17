import { beforeEach, describe, expect, test, vi } from 'vitest'
import api from './api.js'
import { getAiHealth, processWithAI, queryAssistant } from './aiService.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('AI proxy service', () => {
  beforeEach(() => vi.clearAllMocks())

  test('checks health through Express', async () => {
    api.get.mockResolvedValue({ data: { success: true } })
    await expect(getAiHealth()).resolves.toEqual({ success: true })
    expect(api.get).toHaveBeenCalledWith('/ai/health', {})
  })

  test('sends processing text through Express rather than FastAPI', async () => {
    api.post.mockResolvedValue({ data: { success: true, input: 'rizz' } })
    await expect(processWithAI('rizz')).resolves.toEqual({ success: true, input: 'rizz' })
    expect(api.post).toHaveBeenCalledWith('/ai/process', { text: 'rizz' }, { timeout: 60000 })
  })

  test('sends assistant queries through the unified Express endpoint', async () => {
    api.post.mockResolvedValue({ data: { success: true, source: 'ai' } })
    await expect(queryAssistant('Bro got cooked')).resolves.toEqual({ success: true, source: 'ai' })
    expect(api.post).toHaveBeenCalledWith('/assistant/query', { text: 'Bro got cooked' }, { timeout: 60000 })
  })
})
