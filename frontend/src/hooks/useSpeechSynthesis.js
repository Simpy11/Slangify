import { useCallback, useEffect, useRef, useState } from 'react'

// Speech synthesis is browser-global, so all consumers share one playback owner.
let activePlayback = null

function cancelActivePlayback() {
  const previous = activePlayback
  activePlayback = null
  previous?.finish()
  window.speechSynthesis.cancel()
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const playbackRef = useRef(null)
  const isSupported = typeof window !== 'undefined'
    && typeof window.speechSynthesis?.speak === 'function'
    && typeof window.SpeechSynthesisUtterance === 'function'

  const stopSpeaking = useCallback(() => {
    if (!isSupported || activePlayback !== playbackRef.current) return
    cancelActivePlayback()
  }, [isSupported])

  const speak = useCallback((text) => {
    if (!isSupported || !text?.trim()) return false
    try {
      cancelActivePlayback()
      const utterance = new window.SpeechSynthesisUtterance(text.trim())
      const playback = {
        utterance,
        finish: () => {
          if (playbackRef.current !== playback) return
          playbackRef.current = null
          setIsSpeaking(false)
        },
      }
      playbackRef.current = playback
      activePlayback = playback
      utterance.lang = 'en-US'
      utterance.rate = 1
      const voices = window.speechSynthesis.getVoices?.() || []
      const voice = voices.find((item) => item.lang.toLowerCase() === 'en-us')
        || voices.find((item) => /^en\b/i.test(item.lang))
      if (voice) utterance.voice = voice
      utterance.onstart = () => {
        if (activePlayback === playback) setIsSpeaking(true)
      }
      utterance.onend = utterance.onerror = () => {
        if (activePlayback !== playback) return
        activePlayback = null
        playback.finish()
      }
      setIsSpeaking(true)
      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      if (activePlayback === playbackRef.current) activePlayback = null
      playbackRef.current = null
      setIsSpeaking(false)
      return false
    }
  }, [isSupported])

  useEffect(() => () => {
    const playback = playbackRef.current
    playbackRef.current = null
    if (playback && activePlayback === playback) {
      activePlayback = null
      window.speechSynthesis.cancel()
    }
  }, [isSupported])

  return { isSupported, isSpeaking, speak, stopSpeaking }
}
