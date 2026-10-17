import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, login as loginRequest, register, setAuthToken } from '../services/authService.js'
import { AuthContext } from './useAuth.js'

const TOKEN_KEY = 'slangify_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!token) {
      setAuthToken(null)
      return
    }
    let active = true
    setAuthToken(token)
    getCurrentUser(token)
      .then((result) => { if (active) setUser(result.user) })
      .catch(() => {
        if (!active) return
        localStorage.removeItem(TOKEN_KEY)
        setAuthToken(null)
        setToken(null)
        setUser(null)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const saveSession = useCallback((result) => {
    localStorage.setItem(TOKEN_KEY, result.token)
    setAuthToken(result.token)
    setToken(result.token)
    setUser(result.user)
    setLoading(false)
    return result.user
  }, [])

  const login = useCallback(async (credentials) => saveSession(await loginRequest(credentials)), [saveSession])
  const signup = useCallback(async (data) => saveSession(await register(data)), [saveSession])
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setAuthToken(null)
    setToken(null)
    setUser(null)
    setLoading(false)
  }, [])

  const value = useMemo(() => ({ user, token, isAuthenticated: Boolean(user && token), loading, login, signup, logout }), [user, token, loading, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
