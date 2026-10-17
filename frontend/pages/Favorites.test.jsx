import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import Favorites from './Favorites.jsx'
import { getFavorites, removeFavorite } from '../src/services/favoritesService.js'

vi.mock('../src/services/favoritesService.js', () => ({ getFavorites: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }))
vi.mock('../components/AuthControl.jsx', () => ({ default: () => null }))
vi.mock('../components/ThemeToggle.jsx', () => ({ default: () => null }))

test('a failed removal restores the card and keeps the collection usable', async () => {
  getFavorites.mockResolvedValue({ data: [{ _id: 'one', word: 'rizz', meaning: 'Charm', example: 'Example', category: 'Gen Z' }] })
  removeFavorite.mockRejectedValue({ response: { status: 500, data: { message: 'private database detail' } } })
  render(<MemoryRouter><Favorites /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Remove rizz from favorites' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't remove that favorite")
  expect(screen.getByText('rizz')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove rizz from favorites' })).toBeEnabled()
  expect(screen.queryByText('private database detail')).not.toBeInTheDocument()
})
