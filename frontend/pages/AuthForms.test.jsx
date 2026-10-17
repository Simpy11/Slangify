import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import Login from './Login.jsx'
import Signup from './Signup.jsx'

const auth = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn() }))
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => auth }))
vi.mock('../components/ThemeToggle.jsx', () => ({ default: () => null }))

test('login blocks repeated submission and hides internal server errors', async () => {
  let reject
  auth.login.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
  render(<MemoryRouter><Login /></MemoryRouter>)
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.test' } })
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'test-password' } })
  const form = screen.getByRole('button', { name: /^Log in/ }).closest('form')
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(auth.login).toHaveBeenCalledTimes(1)
  reject({ response: { status: 500, data: { message: 'private server detail' } } })
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't log you in")
  expect(screen.queryByText('private server detail')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: /^Log in/ })).toBeEnabled())
})

test('signup submits without an unsupported terms or OAuth control', async () => {
  auth.signup.mockResolvedValue({})
  render(<MemoryRouter><Signup /></MemoryRouter>)
  for (const [placeholder, value] of [
    ['Your full name', 'Test User'], ['yourhandle', 'tester'], ['you@example.com', 'user@example.test'],
    ['At least 8 characters', 'test-password'], ['Type it one more time', 'test-password'],
  ]) fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() => expect(auth.signup).toHaveBeenCalledWith({ name: 'Test User', username: 'tester', email: 'user@example.test', password: 'test-password' }))
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByText(/Google/)).not.toBeInTheDocument()
})
