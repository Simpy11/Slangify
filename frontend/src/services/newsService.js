import api from './api.js'

export async function getNews(config = {}) {
  const response = await api.get('/news', config)
  return response.data
}
