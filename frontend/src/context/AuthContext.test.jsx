import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from './AuthContext.jsx'
import { useAuth } from './useAuth.js'
import { getCurrentUser, login, setAuthToken } from '../services/authService.js'

vi.mock('../services/authService.js', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  setAuthToken: vi.fn(),
}))

function Harness() {
  const auth = useAuth()
  return <div>
    <span>{auth.loading ? 'loading' : auth.isAuthenticated ? auth.user.email : 'logged-out'}</span>
    <button onClick={() => auth.login({ email: 'user@example.test', password: 'password123' })}>Login</button>
    <button onClick={auth.logout}>Logout</button>
  </div>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ user: { _id: '1', email: 'user@example.test' } })
  })

  test('logs in, stores the session, and logs out', async () => {
    login.mockResolvedValue({ token: 'test-token', user: { _id: '1', email: 'user@example.test' } })
    render(<AuthProvider><Harness /></AuthProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByText('user@example.test')).toBeInTheDocument()
    expect(localStorage.getItem('slangify_token')).toBe('test-token')
    expect(setAuthToken).toHaveBeenCalledWith('test-token')
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByText('logged-out')).toBeInTheDocument()
    expect(localStorage.getItem('slangify_token')).toBeNull()
    expect(setAuthToken).toHaveBeenLastCalledWith(null)
  })

  test('restores a valid session', async () => {
    localStorage.setItem('slangify_token', 'restored-token')
    getCurrentUser.mockResolvedValue({ user: { _id: '1', email: 'restored@example.test' } })
    render(<AuthProvider><Harness /></AuthProvider>)
    expect(await screen.findByText('restored@example.test')).toBeInTheDocument()
    expect(getCurrentUser).toHaveBeenCalledWith('restored-token')
  })

  test('clears an invalid stored session', async () => {
    localStorage.setItem('slangify_token', 'invalid-token')
    getCurrentUser.mockRejectedValue(new Error('unauthorized'))
    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('logged-out')).toBeInTheDocument())
    expect(localStorage.getItem('slangify_token')).toBeNull()
  })
})
