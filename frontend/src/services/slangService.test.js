import { afterEach, expect, test, vi } from 'vitest'
import api from './api.js'
import { getSlang } from './slangService.js'

afterEach(() => vi.restoreAllMocks())

test.each(['a', 'ri', 'Delulu', 'dELuLu', 'No Cap'])(
  'sends search %s to the configured slang API with filters and cancellation', async (search) => {
    const controller = new AbortController()
    const params = { search, category: 'Gen Z', trending: true, sort: 'alphabetical', page: 1, limit: 12 }
    const result = { data: [], total: 0, pages: 0 }
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: result })
    expect(await getSlang(params, { signal: controller.signal })).toEqual(result)
    expect(get).toHaveBeenCalledWith('/slang', { params, signal: controller.signal })
    expect(new URL(api.getUri({ url: '/slang', params })).pathname).toBe('/api/slang')
    expect(new URL(api.getUri({ url: '/slang', params })).searchParams.get('search')).toBe(search)
  },
)
