import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import AddSlang from './AddSlang.jsx'
import { createSlang } from '../src/services/slangService.js'

const authState = { isAuthenticated: true, loading: false }
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => authState }))
vi.mock('../src/services/slangService.js', () => ({ createSlang: vi.fn() }))
vi.mock('../components/AuthControl.jsx', () => ({ default: () => <span>Auth</span> }))
vi.mock('../components/ThemeToggle.jsx', () => ({ default: () => <button>Theme</button> }))

function renderPage() {
  return render(<MemoryRouter initialEntries={['/add-slang']}><Routes>
    <Route path="/add-slang" element={<AddSlang />} />
    <Route path="/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter>)
}

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText('e.g. Rizz'), { target: { value: 'New vibe' } })
  fireEvent.change(screen.getByPlaceholderText('What does it mean?'), { target: { value: 'A new meaning' } })
  fireEvent.change(screen.getByPlaceholderText('Use it in a sentence...'), { target: { value: 'That is a new vibe.' } })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Gen Z' } })
}

describe('Add Slang', () => {
  beforeEach(() => {
    authState.isAuthenticated = true
    authState.loading = false
    createSlang.mockReset()
  })

  test('redirects logged-out users to login', async () => {
    authState.isAuthenticated = false
    renderPage()
    expect(await screen.findByText('Login destination')).toBeInTheDocument()
  })

  test('shows validation errors without calling the API', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Add to Slangify/i }))
    expect(screen.getByText('Slang word is required.')).toBeInTheDocument()
    expect(screen.getByText('Meaning is required.')).toBeInTheDocument()
    expect(createSlang).not.toHaveBeenCalled()
  })

  test('submits valid normalized data and shows success', async () => {
    createSlang.mockResolvedValue({ data: { _id: 'new-id' } })
    renderPage()
    fillValidForm()
    fireEvent.change(screen.getByPlaceholderText(/TikTok, viral/i), { target: { value: 'fresh, social' } })
    fireEvent.click(screen.getByRole('button', { name: /Add to Slangify/i }))
    await waitFor(() => expect(createSlang).toHaveBeenCalledWith(expect.objectContaining({
      word: 'New vibe', category: 'Gen Z', tags: ['fresh', 'social'],
    })))
    expect(await screen.findByText('Slang added successfully!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View in Explore' })).toHaveAttribute('href', '/explore?search=New%20vibe')
  })

  test('shows a duplicate API error', async () => {
    createSlang.mockRejectedValue({ response: { status: 409 } })
    renderPage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /Add to Slangify/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/already in the dictionary/i)
  })
})
