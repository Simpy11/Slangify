import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useSpeechRecognition } from './useSpeechRecognition.js'
import { useSpeechSynthesis } from './useSpeechSynthesis.js'

afterEach(() => {
  cleanup()
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
  delete window.speechSynthesis
  delete window.SpeechSynthesisUtterance
})

describe('useSpeechRecognition', () => {
  test('ignores interim, stopped, and unmounted session results', () => {
    let instance
    window.SpeechRecognition = class {
      constructor() { instance = this }
      start() {}
      stop() {}
      abort() {}
    }
    const onResult = vi.fn()
    const { result, unmount } = renderHook(() => useSpeechRecognition())
    act(() => result.current.startListening(onResult))
    expect(result.current.isListening).toBe(true)
    act(() => expect(result.current.startListening(onResult)).toBe(false))
    const interim = Object.assign([{ transcript: 'unfinished' }], { isFinal: false })
    act(() => instance.onresult({ results: [interim] }))
    expect(onResult).not.toHaveBeenCalled()
    act(() => result.current.stopListening())
    act(() => instance.onresult({ results: [[{ transcript: 'late result' }]] }))
    unmount()
    instance.onresult({ results: [[{ transcript: 'after navigation' }]] })
    expect(onResult).not.toHaveBeenCalled()
  })

  test('gracefully reports an unsupported browser', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.startListening(vi.fn()))
    expect(result.current.isSupported).toBe(false)
    expect(result.current.error).toMatch(/isn't supported/i)
  })

  test('configures recognition and returns a transcript', () => {
    let instance
    class Recognition {
      constructor() { instance = this }
      start() { this.onstart() }
      stop() { this.onend() }
      abort() {}
    }
    window.SpeechRecognition = Recognition
    const onResult = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.startListening(onResult))
    expect(instance.lang).toBe('en-US')
    expect(instance.continuous).toBe(false)
    expect(result.current.isListening).toBe(true)
    act(() => instance.onresult({ results: [[{ transcript: 'What is rizz?' }]] }))
    expect(onResult).toHaveBeenCalledWith('What is rizz?')
  })

  test('turns permission errors into a friendly message', () => {
    let instance
    window.SpeechRecognition = class {
      constructor() { instance = this }
      start() { this.onstart() }
      abort() {}
    }
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.startListening(vi.fn()))
    act(() => instance.onerror({ error: 'not-allowed' }))
    expect(result.current.error).toMatch(/permission was denied/i)
  })
})

describe('useSpeechSynthesis', () => {
  test('late events from cancelled speech cannot change the current speaking state', () => {
    const utterances = []
    window.speechSynthesis = { cancel: vi.fn(), speak: (value) => utterances.push(value) }
    window.SpeechSynthesisUtterance = class {}
    const { result, unmount } = renderHook(() => useSpeechSynthesis())
    act(() => result.current.speak('First response'))
    act(() => result.current.speak('Second response'))
    act(() => utterances[0].onend())
    expect(result.current.isSpeaking).toBe(true)
    act(() => result.current.stopSpeaking())
    act(() => utterances[1].onstart())
    expect(result.current.isSpeaking).toBe(false)
    unmount()
    utterances[1].onend()
  })

  test('cancels prior speech and tracks speaking state', () => {
    let utterance
    const cancel = vi.fn()
    const speak = vi.fn((value) => { utterance = value; value.onstart() })
    window.speechSynthesis = { cancel, speak }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    const { result } = renderHook(() => useSpeechSynthesis())
    act(() => result.current.speak('Rizz means charisma.'))
    expect(cancel).toHaveBeenCalled()
    expect(speak).toHaveBeenCalled()
    expect(utterance.text).toBe('Rizz means charisma.')
    expect(result.current.isSpeaking).toBe(true)
    act(() => result.current.stopSpeaking())
    expect(result.current.isSpeaking).toBe(false)
  })
})
