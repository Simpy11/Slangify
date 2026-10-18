import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import { useSpeechSynthesis } from '../src/hooks/useSpeechSynthesis.js'
import './PronunciationButton.css'

export default function PronunciationButton({ word }) {
  const { isSupported, isSpeaking, speak, stopSpeaking } = useSpeechSynthesis()
  const [error, setError] = useState('')
  const unavailable = !isSupported || !word?.trim()
  const tooltip = unavailable ? 'Pronunciation is unavailable in this browser.' : 'Listen to pronunciation.'

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (unavailable) return
    setError('')
    if (isSpeaking) stopSpeaking()
    else if (!speak(word)) setError('Pronunciation could not start. Please try again.')
  }

  return <span className="pronunciation-control">
    <button type="button"
      className={`pronunciation-button${isSpeaking ? ' is-speaking' : ''}`}
      onClick={handleClick}
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={unavailable ? `Pronunciation unavailable for ${word}` : `${isSpeaking ? 'Stop' : 'Listen to'} pronunciation of ${word}`}
      aria-pressed={isSpeaking}
      aria-disabled={unavailable}
      title={tooltip}>
      <Volume2 size={17} aria-hidden="true" />
    </button>
    <span className="pronunciation-tooltip" aria-hidden="true">{tooltip}</span>
    <span className="pronunciation-status" role="status">{error || (isSpeaking ? `Pronouncing ${word}` : '')}</span>
  </span>
}
