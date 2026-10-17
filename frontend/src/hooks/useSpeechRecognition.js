import { useCallback, useEffect, useRef, useState } from 'react'

const errorMessages = {
  'not-allowed': 'Microphone permission was denied. You can still type your question.',
  'service-not-allowed': 'Voice recognition is blocked in this browser. You can still type your question.',
  'audio-capture': 'No microphone was found. Check your microphone and try again.',
  'no-speech': 'No speech was detected. Please try again.',
  network: 'Voice recognition had a network problem. Please try again.',
}

export function useSpeechRecognition() {
  const recognitionRef = useRef(null)
  const resultHandlerRef = useRef(null)
  const resultDeliveredRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')
  const isSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  const stopListening = useCallback(() => {
    // A stopped session must not submit a late result over a typed query.
    resultHandlerRef.current = null
    recognitionRef.current?.stop()
  }, [])

  const startListening = useCallback((onResult) => {
    if (!isSupported || recognitionRef.current) {
      if (!isSupported) setError("Voice recognition isn't supported in this browser. You can still type your question.")
      return false
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    resultHandlerRef.current = onResult
    resultDeliveredRef.current = false

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return
      setError('')
      setIsListening(true)
    }
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return
      const result = event.results?.[event.resultIndex ?? 0]
      if (result?.isFinal === false) return
      const transcript = result?.[0]?.transcript?.trim()
      if (transcript && !resultDeliveredRef.current) {
        resultDeliveredRef.current = true
        resultHandlerRef.current?.(transcript)
      }
    }
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return
      resultHandlerRef.current = null
      if (event.error !== 'aborted') {
        setError(errorMessages[event.error] || 'Voice recognition failed. Please try again or type your question.')
      }
    }
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return
      recognitionRef.current = null
      resultHandlerRef.current = null
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setError('')
    setIsListening(true)
    try {
      recognition.start()
      return true
    } catch {
      recognitionRef.current = null
      resultHandlerRef.current = null
      setIsListening(false)
      setError('Voice recognition could not start. Please try again.')
      return false
    }
  }, [isSupported])

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    resultHandlerRef.current = null
    recognition?.abort()
  }, [])

  return { isSupported, isListening, error, startListening, stopListening }
}
