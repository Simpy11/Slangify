import api from './api.js'

export async function getSlang(params = {}, config = {}) {
  const response = await api.get('/slang', { ...config, params })
  return response.data
}

export function getTrendingSlang(params = {}, config = {}) {
  return getSlang({ trending: true, sort: 'popular', limit: 6, ...params }, config)
}

export async function createSlang(data) {
  const response = await api.post('/slang', data)
  return response.data
}
