import api from './api.js'

export async function getFavorites(config = {}) {
  const response = await api.get('/favorites', config)
  return response.data
}

export async function addFavorite(slangId) {
  const response = await api.post(`/favorites/${slangId}`)
  return response.data
}

export async function removeFavorite(slangId) {
  const response = await api.delete(`/favorites/${slangId}`)
  return response.data
}
