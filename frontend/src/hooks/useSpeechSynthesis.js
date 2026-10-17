import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef(null)
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  const stopSpeaking = useCallback(() => {
    if (!isSupported) return
    utteranceRef.current = null
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [isSupported])

  const speak = useCallback((text) => {
    if (!isSupported || !text?.trim()) return false
    utteranceRef.current = null
    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance
    utterance.lang = 'en-US'
    utterance.rate = 1
    utterance.onstart = () => {
      if (utteranceRef.current === utterance) setIsSpeaking(true)
    }
    utterance.onend = utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return
      utteranceRef.current = null
      setIsSpeaking(false)
    }
    try {
      setIsSpeaking(true)
      window.speechSynthesis.speak(utterance)
    } catch {
      utteranceRef.current = null
      setIsSpeaking(false)
      return false
    }
    return true
  }, [isSupported])

  useEffect(() => () => {
    utteranceRef.current = null
    if (isSupported) window.speechSynthesis.cancel()
  }, [isSupported])

  return { isSupported, isSpeaking, speak, stopSpeaking }
}
