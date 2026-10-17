import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
if (!configuredApiUrl) {
  throw new Error('Missing VITE_API_URL. Configure the public Slangify API base URL, including /api.')
}
if (!configuredApiUrl.startsWith('/')) {
  try {
    const parsedApiUrl = new URL(configuredApiUrl)
    if (!['http:', 'https:'].includes(parsedApiUrl.protocol)) throw new Error()
  } catch {
    throw new Error('VITE_API_URL must be an absolute http(s) URL or a root-relative path such as /api.')
  }
}

const api = axios.create({
  timeout: 25000,
  baseURL: configuredApiUrl.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
