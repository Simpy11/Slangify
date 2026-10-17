import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import GenZBuzz from './GenZBuzz.jsx'
import { getNews } from '../src/services/newsService.js'

vi.mock('../src/services/newsService.js', () => ({ getNews: vi.fn() }))
const articles = Array.from({ length: 5 }, (_, index) => ({ id: `fixture-${index}`, title: `Publisher headline ${index}`, summary: `Publisher summary ${index}`, source: 'Test publisher', topic: 'Gaming', publishedAt: '2026-10-16T10:00:00.000Z', url: `https://publisher.example/article/${index}`, image: `https://publisher.example/image/${index}.jpg` }))
const result = { success: true, data: articles, updatedAt: '2026-10-16T11:00:00.000Z', nextRefreshAt: '2026-10-16T11:45:00.000Z' }
beforeEach(() => { getNews.mockReset() })
afterEach(() => { document.documentElement.removeAttribute('data-theme'); vi.useRealTimers() })

describe('Gen Z Buzz', () => {
  test('shows exactly five loading skeletons while fetching', async () => {
    getNews.mockReturnValue(new Promise(() => {}))
    render(<GenZBuzz />)
    expect(screen.getByLabelText('Loading news').children).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Refresh News' })).toBeDisabled()
  })
  test.each(['light', 'dark'])('renders publisher data and safe original links in %s theme', async (theme) => {
    document.documentElement.dataset.theme = theme
    getNews.mockResolvedValue(result)
    render(<GenZBuzz />)
    expect(await screen.findByText(articles[0].title)).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(5)
    expect(screen.getAllByRole('time')).toHaveLength(5)
    const link = screen.getByRole('link', { name: `Read more: ${articles[0].title}` })
    expect(link).toHaveAttribute('href', articles[0].url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(articles[0].summary)).toBeInTheDocument()
    expect(document.querySelector('.buzz-image img')).toHaveAttribute('src', articles[0].image)
  })
  test('refresh uses the same endpoint without cache-bypassing options', async () => {
    getNews.mockResolvedValue(result)
    render(<GenZBuzz />)
    await screen.findByText(articles[0].title)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh News' }))
    await waitFor(() => expect(getNews).toHaveBeenCalledTimes(2))
    expect(Object.keys(getNews.mock.calls[1][0])).toEqual(['signal'])
  })
  test('renders a genuine empty state', async () => {
    getNews.mockResolvedValue({ success: true, data: [] })
    render(<GenZBuzz />)
    expect(await screen.findByText('A quiet moment on the feed.')).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
  test('handles failure and allows retry', async () => {
    getNews.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result)
    render(<GenZBuzz />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The buzz will be back.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(articles[0].title)).toBeInTheDocument()
  })
  test('keeps existing results visible if refresh fails', async () => {
    getNews.mockResolvedValueOnce(result).mockRejectedValue(new Error('offline'))
    render(<GenZBuzz />)
    await screen.findByText(articles[0].title)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh News' }))
    await screen.findByRole('alert')
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })
  test('shows an honest missing image state instead of a fabricated image', async () => {
    getNews.mockResolvedValue(result)
    render(<GenZBuzz />)
    await screen.findByText(articles[0].title)
    fireEvent.error(document.querySelector('.buzz-image img'))
    expect(screen.getByText('Image unavailable')).toBeInTheDocument()
  })
  test('aborts requests on unmount', async () => {
    getNews.mockReturnValue(new Promise(() => {}))
    const view = render(<GenZBuzz />)
    await waitFor(() => expect(getNews).toHaveBeenCalledOnce())
    const signal = getNews.mock.calls[0][0].signal
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
  test('automatically checks for updates after 45 minutes', async () => {
    vi.useFakeTimers()
    getNews.mockResolvedValue(result)
    const view = render(<GenZBuzz />)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(getNews).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(45 * 60 * 1000))
    expect(getNews).toHaveBeenCalledTimes(2)
    view.unmount()
  })
})
