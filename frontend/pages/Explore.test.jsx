import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Explore from './Explore.jsx'
import { getSlang } from '../src/services/slangService.js'

vi.mock('../src/services/slangService.js', () => ({ getSlang: vi.fn() }))
vi.mock('../src/services/favoritesService.js', () => ({ addFavorite: vi.fn(), getFavorites: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => ({ user: null, isAuthenticated: false, loading: false }) }))
vi.mock('../components/AuthControl.jsx', () => ({ default: () => <span>Auth</span> }))
vi.mock('../components/ThemeToggle.jsx', () => ({ default: () => <button>Theme</button> }))

describe('Explore navigation state', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    getSlang.mockReset()
    getSlang.mockResolvedValue({ data: [], total: 0, pages: 0 })
  })

  test.each(['D', 'R'])('initializes the %s filter from the URL and requests it', async (letter) => {
    render(<MemoryRouter initialEntries={[`/explore?letter=${letter}`]}><Explore /></MemoryRouter>)
    await waitFor(() => expect(getSlang).toHaveBeenCalled())
    expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ letter })
    expect(screen.getByRole('button', { name: letter })).toHaveClass('selected')
  })

  test('renders empty and API error states', async () => {
    const view = render(<MemoryRouter initialEntries={['/explore']}><Explore /></MemoryRouter>)
    expect(await screen.findByText('No slang yet')).toBeInTheDocument()
    view.unmount()
    getSlang.mockRejectedValue(new Error('offline'))
    render(<MemoryRouter initialEntries={['/explore']}><Explore /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load slang/i)
  })
  test('keeps controls available while loading, empty, and after an API failure', async () => {
    const view = render(<MemoryRouter><Explore /></MemoryRouter>)
    const controls = () => {
      expect(screen.getByRole('button', { name: 'Gaming' })).toBeEnabled()
      expect(screen.getByRole('button', { name: /Trending only/ })).toBeEnabled()
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeEnabled()
    }
    controls()
    expect(await screen.findByText('No slang yet')).toBeInTheDocument()
    controls()
    expect(screen.getByText(/dictionary is empty/)).toBeInTheDocument()
    view.unmount()
    getSlang.mockRejectedValue(new Error('offline'))
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByRole('alert')
    controls()
    getSlang.mockResolvedValue({ data: [], total: 0, pages: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No slang yet')).toBeInTheDocument()
  })

  test('applies category, trending, sort, search and alphabet filters and clears them', async () => {
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByText('No slang yet')
    fireEvent.click(screen.getByRole('button', { name: 'Gaming' }))
    fireEvent.click(screen.getByRole('button', { name: /Trending only/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'newest' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Search slang' }), { target: { value: 'rizz' } })
    fireEvent.click(screen.getByRole('button', { name: 'R' }))
    await waitFor(() => expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ category: 'Gaming', trending: true, sort: 'newest', search: 'rizz', letter: 'R', page: 1 }))
    expect(await screen.findByText('No matching slang found')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ category: undefined, trending: undefined, sort: 'popular', search: undefined, letter: undefined, page: 1 }))
    expect(await screen.findByText('No slang yet')).toBeInTheDocument()
  })

  test('search resets page two and clearing the input restores unfiltered results', async () => {
    const item = { _id: 'rizz', word: 'Rizz', meaning: 'Charm', category: 'Gen Z' }
    getSlang.mockImplementation(async ({ search }) => search
      ? { data: [], total: 0, pages: 0 }
      : { data: [item], total: 13, pages: 2 })
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByRole('heading', { level: 3, name: 'Rizz' })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(getSlang.mock.calls.at(-1)[0].page).toBe(2))
    const input = screen.getByRole('textbox', { name: 'Search slang' })
    fireEvent.change(input, { target: { value: 'unknown' } })
    expect(screen.queryByRole('heading', { level: 3, name: 'Rizz' })).not.toBeInTheDocument()
    await screen.findByText('No matching slang found')
    expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ search: 'unknown', page: 1 })
    fireEvent.change(input, { target: { value: '' } })
    await screen.findByRole('heading', { level: 3, name: 'Rizz' })
    expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ search: undefined, page: 1 })
  })

  test.each(['success', 'error'])('ignores an older search resolving with %s after a newer one', async (outcome) => {
    let resolveOld, rejectOld
    getSlang.mockImplementation(({ search }) => {
      if (search === 'a') return new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject })
      if (search === 'rizz') return Promise.resolve({ data: [{ _id: 'rizz', word: 'Rizz', meaning: 'Charm', category: 'Gen Z' }], total: 1, pages: 1 })
      return Promise.resolve({ data: [], total: 0, pages: 0 })
    })
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByText('No slang yet')
    const input = screen.getByRole('textbox', { name: 'Search slang' })
    fireEvent.change(input, { target: { value: 'a' } })
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'))
    const oldSignal = getSlang.mock.calls.at(-1)[1].signal
    fireEvent.change(input, { target: { value: 'rizz' } })
    await screen.findByRole('heading', { level: 3, name: 'Rizz' })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => {
      if (outcome === 'success') resolveOld({ data: [{ _id: 'alpha', word: 'Alpha' }], total: 1, pages: 1 })
      else rejectOld(new Error('late failure'))
    })
    expect(screen.getByRole('heading', { level: 3, name: 'Rizz' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Alpha' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test.each([
    ['a', 'No Cap'], ['b', 'Bussin'], ['s', 'Bussin'], ['ri', 'Rizz'],
    ['Delulu', 'Delulu'], ['dELuLu', 'Delulu'], ['No Cap', 'No Cap'],
  ])('requests server search for %s and renders %s', async (search, word) => {
    getSlang.mockImplementation(async (params) => params.search
      ? { data: [{ _id: 'match', word, meaning: 'Meaning', category: 'Gen Z' }], total: 1, pages: 1 }
      : { data: [], total: 0, pages: 0 })
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByText('No slang yet')
    fireEvent.change(screen.getByRole('textbox', { name: 'Search slang' }), { target: { value: search } })
    expect(screen.queryByText('No matching slang found')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 3, name: word })).toBeInTheDocument()
    expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ search, page: 1, limit: 12 })
  })

  test('debounces rapid typing for exactly 300ms and hides old empty states during filter changes', async () => {
    vi.useFakeTimers()
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(getSlang).toHaveBeenCalledTimes(1)
    const input = screen.getByRole('textbox', { name: 'Search slang' })
    fireEvent.change(input, { target: { value: 'r' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.change(input, { target: { value: 'ri' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(getSlang).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('No matching slang found')).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(getSlang).toHaveBeenCalledTimes(2)
    expect(getSlang.mock.calls.at(-1)[0].search).toBe('ri')
    expect(screen.getByText('No matching slang found')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Gaming' }))
    expect(screen.queryByText('No matching slang found')).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(getSlang.mock.calls.at(-1)[0]).toMatchObject({ search: 'ri', category: 'Gaming', page: 1 })
  })

  test('reselecting the active filter keeps the results available', async () => {
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByText('No slang yet')
    fireEvent.click(screen.getByRole('button', { name: 'All', exact: true }))
    expect(screen.getByText('No slang yet')).toBeInTheDocument()
    expect(getSlang).toHaveBeenCalledTimes(1)
  })

  test('ignores old results arriving while the new search is still debouncing', async () => {
    vi.useFakeTimers()
    let finishOld
    getSlang.mockImplementation(({ search }) => search === 'a'
      ? new Promise(resolve => { finishOld = resolve })
      : Promise.resolve({ data: [], total: 0, pages: 0 }))
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    const input = screen.getByRole('textbox', { name: 'Search slang' })
    fireEvent.change(input, { target: { value: 'a' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    fireEvent.change(input, { target: { value: 'ri' } })
    await act(async () => finishOld({ data: [{ _id: 'old', word: 'Alpha' }], total: 1, pages: 1 }))
    expect(screen.queryByRole('heading', { level: 3, name: 'Alpha' })).not.toBeInTheDocument()
    expect(screen.queryByText('No matching slang found')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Loading slang')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(screen.getByText('No matching slang found')).toBeInTheDocument()
  })

  test('scrolls once after each new page renders, never on initial load or filters', async () => {
    getSlang.mockImplementation(async ({ page }) => ({ data: [{ _id: `page-${page}`, word: `Word ${page}`, meaning: 'Meaning', category: 'Other' }], total: 25, pages: 3 }))
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByRole('heading', { level: 3, name: 'Word 1' })
    const scroll = Element.prototype.scrollIntoView
    expect(scroll).not.toHaveBeenCalled()
    for (const [button, page] of [['Next', 2], ['Next', 3], ['Previous', 2], ['Previous', 1]]) {
      const count = scroll.mock.calls.length
      fireEvent.click(screen.getByRole('button', { name: button }))
      expect(scroll).toHaveBeenCalledTimes(count)
      expect(document.querySelector('.explore-discovery')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: button })).toBeDisabled()
      await screen.findByRole('heading', { level: 3, name: `Word ${page}` })
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(count + 1))
      expect(scroll.mock.instances.at(-1)).toHaveClass('popular-heading')
      expect(scroll.mock.calls.at(-1)[0]).toEqual({ behavior: 'smooth', block: 'start' })
    }
    fireEvent.click(screen.getByRole('heading', { level: 3, name: 'Word 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gaming' }))
    await waitFor(() => expect(getSlang.mock.calls.at(-1)[0].category).toBe('Gaming'))
    expect(scroll).toHaveBeenCalledTimes(4)
  }, 10000)

  test('a canceled pagination response cannot scroll after a search', async () => {
    let finishPage
    getSlang.mockImplementation(({ page, search }) => {
      if (page === 2) return new Promise(resolve => { finishPage = resolve })
      return Promise.resolve({ data: [{ _id: 'one', word: search || 'First', category: 'Other' }], total: 13, pages: 2 })
    })
    render(<MemoryRouter><Explore /></MemoryRouter>)
    await screen.findByRole('heading', { level: 3, name: 'First' })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(finishPage).toBeTypeOf('function'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search slang' }), { target: { value: 'Rizz' } })
    await screen.findByRole('heading', { level: 3, name: 'Rizz' })
    await act(async () => finishPage({ data: [{ _id: 'late', word: 'Late' }], total: 13, pages: 2 }))
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { level: 3, name: 'Late' })).not.toBeInTheDocument()
  })

})
