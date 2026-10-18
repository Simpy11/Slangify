import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import PronunciationButton from './PronunciationButton.jsx'

let utterances
beforeEach(() => {
  utterances = []
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  window.speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn((utterance) => { utterances.push(utterance); utterance.onstart() }),
    getVoices: () => [{ lang: 'en-US', name: 'English' }],
  }
})
afterEach(() => {
  delete window.speechSynthesis
  delete window.SpeechSynthesisUtterance
})

test.each(['Rizz', 'Delulu', 'No Cap', 'Sus', 'Bussin', 'Main Character'])('pronounces %s in English', (word) => {
  render(<PronunciationButton word={word} />)
  fireEvent.click(screen.getByRole('button'))
  expect(utterances[0].text).toBe(word)
  expect(utterances[0].lang).toBe('en-US')
  expect(utterances[0].voice.lang).toBe('en-US')
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  act(() => utterances[0].onend())
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})

test('switches ownership, ignores stale events, and preserves another card playback on unmount', () => {
  const first = render(<PronunciationButton word="Rizz" />)
  const second = render(<PronunciationButton word="No Cap" />)
  fireEvent.click(screen.getByRole('button', { name: 'Listen to pronunciation of Rizz' }))
  fireEvent.click(screen.getByRole('button', { name: 'Listen to pronunciation of No Cap' }))
  expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2)
  act(() => { utterances[0].onend(); utterances[0].onstart() })
  expect(screen.getByRole('button', { name: 'Listen to pronunciation of Rizz' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Stop pronunciation of No Cap' })).toHaveAttribute('aria-pressed', 'true')
  first.unmount()
  expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2)
  second.unmount()
  expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(3)
})

test('supports keyboard playback and stopping without activating the card', async () => {
  const navigate = vi.fn()
  render(<div onClick={navigate}><PronunciationButton word="Sus" /></div>)
  const user = userEvent.setup()
  await user.tab()
  await user.keyboard('{Enter}')
  expect(utterances).toHaveLength(1)
  await user.keyboard(' ')
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  expect(navigate).not.toHaveBeenCalled()
})

test('handles unsupported browsers and synchronous playback failures', () => {
  delete window.speechSynthesis
  const view = render(<PronunciationButton word="Delulu" />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(screen.getByRole('button'))
  view.unmount()
  window.speechSynthesis = { cancel: vi.fn(), speak: () => { throw new Error('unavailable') } }
  render(<PronunciationButton word="Delulu" />)
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('status')).toHaveTextContent('Pronunciation could not start')
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})

test('clears speaking state after a speech error', () => {
  render(<PronunciationButton word="Bussin" />)
  fireEvent.click(screen.getByRole('button'))
  act(() => utterances[0].onerror({ error: 'synthesis-failed' }))
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})
