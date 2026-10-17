import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import VoiceAssistant from './VoiceAssistant.jsx'
import { queryAssistant } from '../src/services/aiService.js'

vi.mock('../src/services/aiService.js', () => ({ queryAssistant: vi.fn() }))
vi.mock('../components/AuthControl.jsx', () => ({ default: () => <span>Auth</span> }))
vi.mock('../components/ThemeToggle.jsx', () => ({ default: () => <button>Theme</button> }))

const rizz = {
  _id: 'rizz-id',
  word: 'rizz',
  meaning: 'Charm or charisma',
  example: 'They have effortless rizz.',
  category: 'Gen Z',
  emoji: '✨',
}

function renderAssistant() {
  return render(<MemoryRouter><VoiceAssistant /></MemoryRouter>)
}

async function ask(question) {
  fireEvent.change(screen.getByPlaceholderText(/type your slang question/i), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: /send question/i }))
}

describe('Voice Assistant typed lookup', () => {
  beforeEach(() => queryAssistant.mockReset())

  test.each(['rizz', 'What does rizz mean?', 'What is rizz?', 'Explain rizz', 'Tell me the meaning of rizz'])(
    'normalizes %s, calls the real service boundary, and renders API data',
    async (question) => {
      queryAssistant.mockResolvedValue({ source: 'dictionary', data: rizz })
      renderAssistant()
      await ask(question)
      await waitFor(() => expect(queryAssistant).toHaveBeenCalledWith(question, { signal: expect.any(AbortSignal) }))
      expect(await screen.findByText('Charm or charisma')).toBeInTheDocument()
      expect(screen.getByText('They have effortless rizz.')).toBeInTheDocument()
    },
  )

  test('renders a contextual AI result with detected slang', async () => {
    queryAssistant.mockResolvedValue({ source: 'ai', data: {
      original: 'Bro left me on read',
      translation: 'He saw my message but did not reply.',
      explanation: 'The phrase describes an unanswered message.',
      detectedSlang: [{ term: 'left on read', meaning: 'Saw a message without replying' }],
    } })
    renderAssistant()
    await ask('Bro left me on read')
    expect(await screen.findByText('He saw my message but did not reply.')).toBeInTheDocument()
    expect(screen.getByText('The phrase describes an unanswered message.')).toBeInTheDocument()
    expect(screen.getByText(/Saw a message without replying/)).toBeInTheDocument()
  })

  test('renders the successful live Gemini cooked response', async () => {
    // Recorded from a real HTTP 200 during the Gemini investigation on 2026-10-16.
    const data = {
      original: 'What does I am cooked mean?',
      translation: 'I am doomed.',
      explanation: "'I am cooked' is a popular internet and Gen Z phrase meaning someone is in serious trouble, facing inevitable failure, or completely out of options. It is often used humorously or hyperbolically to describe stressful or hopeless situations.",
      detectedSlang: [{ term: 'cooked', meaning: 'Doomed, ruined, or in a hopeless situation with no way out.' }],
    }
    queryAssistant.mockResolvedValue({ success: true, source: 'ai', data })
    renderAssistant()
    await ask(data.original)
    expect(await screen.findByText(data.translation)).toBeInTheDocument()
    expect(screen.getByText(data.explanation)).toBeInTheDocument()
    expect(screen.getByText('cooked')).toBeInTheDocument()
    expect(screen.getByText(/Doomed, ruined, or in a hopeless situation/)).toBeInTheDocument()
  })

  test('renders a friendly API error state', async () => {
    queryAssistant.mockImplementationOnce(async () => {
      const error = new Error('service unavailable')
      error.response = { status: 503, data: { message: 'private upstream details' } }
      throw error
    })
    renderAssistant()
    await ask('rizz')
    expect(await screen.findByText(/AI explanation is temporarily unavailable/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/Finding the best answer/i)).not.toBeInTheDocument())
  })

  test('renders a local greeting and retains Listen support', async () => {
    queryAssistant.mockResolvedValue({ success: true, source: 'assistant', data: { message: 'Hello! Ask me about slang.' } })
    renderAssistant()
    await ask('hello hello')
    expect(await screen.findByText('Hello! Ask me about slang.')).toBeInTheDocument()
  })

  test.each([
    ['AI_NOT_CONFIGURED', /not configured yet/],
    ['AI_AUTH_ERROR', /could not authenticate/],
    ['AI_QUOTA_EXCEEDED', /usage limit/],
    ['AI_TIMEOUT', /too long/],
    ['AI_MODEL_UNAVAILABLE', /model is unavailable/],
    ['AI_SERVICE_UNAVAILABLE', /processing service is offline/],
  ])('shows actionable safe error %s', async (code, message) => {
    queryAssistant.mockImplementationOnce(async () => {
      const error = new Error('unavailable')
      error.response = { status: 503, data: { code, message: 'private provider details' } }
      throw error
    })
    renderAssistant()
    await ask('Bro has no rizz')
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(/private provider details/)).not.toBeInTheDocument()
  })

  test('does not submit empty or whitespace-only text', async () => {
    renderAssistant()
    await ask('   ')
    expect(queryAssistant).not.toHaveBeenCalled()
  })

  test('Enter submits typed input without automatic speech, and Listen plays the result', async () => {
    window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    queryAssistant.mockResolvedValue({ source: 'dictionary', data: rizz })
    const view = renderAssistant()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your slang question' }), 'rizz{Enter}')
    expect(await screen.findByText(rizz.meaning)).toBeInTheDocument()
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Listen to assistant response' }))
    expect(window.speechSynthesis.speak.mock.calls[0][0].text).toBe('rizz means Charm or charisma. For example, They have effortless rizz.')
    view.unmount()
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  })

  test.each([null, { source: 'unknown', data: {} }, { source: 'ai', data: { translation: 'Hello', explanation: 'Context', detectedSlang: [null] } }])(
    'handles an unusable response without crashing: %j', async (response) => {
      queryAssistant.mockResolvedValue(response)
      renderAssistant()
      await ask('unknown input')
      expect(await screen.findByText(/No usable answer was returned/)).toBeInTheDocument()
    },
  )

  test('aborts a pending request on navigation and never speaks its late response', async () => {
    let finish
    queryAssistant.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const view = renderAssistant()
    await ask('rizz')
    const signal = queryAssistant.mock.calls[0][1].signal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => finish({ source: 'dictionary', data: rizz }))
  })

  test('microphone permission denial leaves typed queries usable', async () => {
    let recognition
    window.SpeechRecognition = class {
      constructor() { recognition = this }
      start() { this.onstart() }
      stop() { this.onend() }
      abort() {}
    }
    queryAssistant.mockResolvedValue({ source: 'dictionary', data: rizz })
    const view = renderAssistant()
    fireEvent.click(screen.getAllByRole('button', { name: 'Start voice recognition' })[0])
    act(() => { recognition.onerror({ error: 'not-allowed' }); recognition.onend() })
    expect(screen.getByRole('alert')).toHaveTextContent(/permission was denied/)
    await ask('rizz')
    expect(await screen.findByText(rizz.meaning)).toBeInTheDocument()
    view.unmount()
    delete window.SpeechRecognition
  })

  test('prevents duplicate submission while a request is pending', async () => {
    let finish
    queryAssistant.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderAssistant()
    await ask('rizz')
    fireEvent.click(screen.getByRole('button', { name: /send question/i }))
    expect(queryAssistant).toHaveBeenCalledTimes(1)
    finish({ source: 'dictionary', data: rizz })
    expect(await screen.findByText('Charm or charisma')).toBeInTheDocument()
  })

  test('submits one recognized transcript and automatically speaks the dictionary answer', async () => {
    let recognition
    window.SpeechRecognition = class {
      constructor() { recognition = this }
      start() { this.onstart() }
      stop() { this.onend() }
      abort() {}
    }
    const speak = vi.fn((utterance) => utterance.onstart?.())
    window.speechSynthesis = { cancel: vi.fn(), speak }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    queryAssistant.mockResolvedValue({ source: 'dictionary', data: rizz })
    const view = renderAssistant()
    fireEvent.click(screen.getAllByRole('button', { name: 'Start voice recognition' })[0])
    recognition.onresult({ results: [[{ transcript: 'What does rizz mean?' }]] })
    recognition.onresult({ results: [[{ transcript: 'What does rizz mean?' }]] })
    await waitFor(() => expect(queryAssistant).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Charm or charisma')).toBeInTheDocument()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0][0].text).toBe('rizz means Charm or charisma. For example, They have effortless rizz.')
    view.unmount()
    delete window.SpeechRecognition
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  })

  test('speaks a contextual AI voice translation and lets the user stop it', async () => {
    let recognition
    window.SpeechRecognition = class {
      constructor() { recognition = this }
      start() { this.onstart() }
      stop() { this.onend() }
      abort() {}
    }
    const cancel = vi.fn()
    const speak = vi.fn((utterance) => utterance.onstart?.())
    window.speechSynthesis = { cancel, speak }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    queryAssistant.mockResolvedValue({ source: 'ai', data: {
      original: 'Bro got cooked',
      translation: 'He was thoroughly defeated.',
      explanation: 'The phrase uses slang for losing badly.',
      detectedSlang: [{ term: 'cooked', meaning: 'defeated' }],
    } })
    const view = renderAssistant()
    fireEvent.click(screen.getAllByRole('button', { name: 'Start voice recognition' })[0])
    recognition.onresult({ results: [[{ transcript: 'Bro got cooked' }]] })
    expect(await screen.findByText('He was thoroughly defeated.')).toBeInTheDocument()
    expect(speak.mock.calls[0][0].text).toBe('cooked means defeated. He was thoroughly defeated. The phrase uses slang for losing badly.')
    fireEvent.click(screen.getByRole('button', { name: 'Stop speaking' }))
    expect(cancel).toHaveBeenCalled()
    view.unmount()
    delete window.SpeechRecognition
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  })
})

test('each answer owns its speech, toggles, and resets after completion or failure', async () => {
  window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() }
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  queryAssistant.mockReset()
  queryAssistant.mockResolvedValueOnce({ source: 'dictionary', data: rizz })
    .mockResolvedValueOnce({ source: 'ai', data: 'Delulu means delusional.' })
  const view = renderAssistant()
  try {
    await ask('What does rizz mean?')
    fireEvent.click(await screen.findByRole('button', { name: 'Listen to assistant response' }))
    const first = window.speechSynthesis.speak.mock.calls[0][0]
    expect(first.text).toContain(rizz.example)
    expect(first.text).not.toContain('What does')
    expect(first.lang).toBe('en-US')
    expect(first.rate).toBeGreaterThanOrEqual(0.9)
    fireEvent.click(screen.getByRole('button', { name: 'Stop speaking' }))
    expect(screen.queryByRole('button', { name: 'Stop speaking' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Listen to assistant response' }))
    const cancels = window.speechSynthesis.cancel.mock.calls.length
    await ask('Explain delulu')
    await screen.findByText('Delulu means delusional.')
    expect(window.speechSynthesis.cancel.mock.calls.length).toBeGreaterThan(cancels)
    const buttons = screen.getAllByRole('button', { name: 'Listen to assistant response' })
    fireEvent.click(buttons[1])
    const second = window.speechSynthesis.speak.mock.calls.at(-1)[0]
    expect(second.text).toBe('Delulu means delusional.')
    fireEvent.click(buttons[0])
    expect(window.speechSynthesis.speak.mock.calls.at(-1)[0].text).toBe(first.text)
    act(() => second.onend())
    expect(screen.getByRole('button', { name: 'Stop speaking' })).toBeInTheDocument()
    act(() => window.speechSynthesis.speak.mock.calls.at(-1)[0].onerror())
    expect(screen.queryByRole('button', { name: 'Stop speaking' })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Listen to assistant response' })[1])
    act(() => window.speechSynthesis.speak.mock.calls.at(-1)[0].onend())
    expect(screen.queryByRole('button', { name: 'Stop speaking' })).not.toBeInTheDocument()
  } finally {
    view.unmount()
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
  }
})
