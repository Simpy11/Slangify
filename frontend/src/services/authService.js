import api from './api.js'

export async function register(data) {
  const response = await api.post('/auth/register', data)
  return response.data
}

export async function login(data) {
  const response = await api.post('/auth/login', data)
  return response.data
}

export async function getCurrentUser(token) {
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}
