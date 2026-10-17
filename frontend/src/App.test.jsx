import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App.jsx'
import { getNews } from './services/newsService.js'
import { getSlang, getTrendingSlang } from './services/slangService.js'

vi.mock('./services/newsService.js', () => ({ getNews: vi.fn().mockResolvedValue({ success: true, data: [] }) }))

vi.mock('./services/slangService.js', () => ({ getSlang: vi.fn(), getTrendingSlang: vi.fn() }))
vi.mock('./services/favoritesService.js', () => ({ getFavorites: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('./context/useAuth.js', () => ({ useAuth: () => ({ user: null, isAuthenticated: false, loading: false }) }))
vi.mock('../components/AuthControl.jsx', () => ({ default: () => null }))
vi.mock('../components/ThemeToggle.jsx', () => ({ default: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  getTrendingSlang.mockResolvedValue({ data: [] })
  getSlang.mockResolvedValue({ data: [], total: 0, pages: 1, page: 1 })
  getNews.mockResolvedValue({ success: true, data: [] })
})

test('a late homepage search cannot replace newer results', async () => {
  Element.prototype.scrollIntoView = vi.fn()
  let finishOld
  getTrendingSlang.mockResolvedValue({ data: [] })
  getSlang.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve }))
    .mockResolvedValueOnce({ data: [{ _id: 'new', word: 'New result', meaning: 'Current meaning', category: 'Other' }] })
  render(<MemoryRouter><App /></MemoryRouter>)
  await waitFor(() => expect(document.querySelector('.search-submit')).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Rizz', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Delulu', exact: true }))
  expect(await screen.findByText('New result')).toBeInTheDocument()
  expect(getSlang.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => finishOld({ data: [{ _id: 'old', word: 'Old result' }] }))
  expect(screen.queryByText('Old result')).not.toBeInTheDocument()
  expect(screen.getByText('New result')).toBeInTheDocument()
})


test('homepage offers a separate Gen Z Buzz button between Explore and Favorites', async () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  const nav = screen.getByRole('navigation', { name: 'Primary navigation' })
  const links = within(nav).getAllByRole('link')
  const buzz = within(nav).getByRole('link', { name: 'Gen Z Buzz' })
  const index = links.indexOf(buzz)
  expect(links[index - 1]).toHaveTextContent('Explore')
  expect(links[index + 1]).toHaveTextContent('Favorites')
  expect(buzz).toHaveAttribute('href', '/genz-buzz')
  expect(document.querySelector('.buzz-section')).not.toBeInTheDocument()
  expect(getNews).not.toHaveBeenCalled()
})

test('Gen Z Buzz navigates to its dedicated page and becomes active', async () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  fireEvent.click(screen.getByRole('link', { name: 'Gen Z Buzz' }))
  expect(await screen.findByRole('heading', { level: 1, name: /Gen Z Buzz/ })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Primary navigation' })
  expect(within(nav).getByRole('link', { name: 'Gen Z Buzz' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Gen Z Buzz' })).toHaveClass('active')
  await waitFor(() => expect(getNews).toHaveBeenCalledOnce())
  expect(screen.queryByRole('textbox', { name: 'Search slang' })).not.toBeInTheDocument()
})

test('direct /genz-buzz URL loads independently and mobile menu closes on selection', async () => {
  render(<MemoryRouter initialEntries={['/genz-buzz']}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: /Gen Z Buzz/ })).toBeInTheDocument()
  const toggle = document.querySelector('.menu-toggle')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(screen.getByRole('link', { name: 'Gen Z Buzz' }))
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await screen.findByText('A quiet moment on the feed.')
})

test('Explore retains its separate dictionary page and links to Gen Z Buzz', async () => {
  render(<MemoryRouter initialEntries={['/explore']}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: /Explore Slang/ })).toBeInTheDocument()
  expect(document.querySelector('.buzz-section')).not.toBeInTheDocument()
  expect(getNews).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: 'Gen Z Buzz' }))
  expect(await screen.findByRole('heading', { level: 1, name: /Gen Z Buzz/ })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Search slang' })).not.toBeInTheDocument()
})
