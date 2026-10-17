import BrandLogo from '../components/BrandLogo.jsx'
import BuzzNavLink from '../components/BuzzNavLink.jsx'
import { Bot, Menu, Mic, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthControl from '../components/AuthControl.jsx'
import Footer from '../components/Footer.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition.js'
import { useSpeechSynthesis } from '../src/hooks/useSpeechSynthesis.js'
import { queryAssistant } from '../src/services/aiService.js'
import { getSpeakableText } from '../src/utils/speakableResponse.js'
import { getAssistantError } from '../src/utils/assistantError.js'
import './VoiceAssistant.css'
import './VoiceAssistantResults.css'
import './VoiceAssistantAI.css'

const suggestions = ['What does rizz mean?', 'What is delulu?', 'Explain ate', 'Tell me the meaning of no cap']

function VoiceAssistant() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [processing, setProcessing] = useState(false)
  const [activeSpeechIndex, setActiveSpeechIndex] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const processingRef = useRef(false)
  const requestRef = useRef(null)
  const mountedRef = useRef(true)
  const speechRecognition = useSpeechRecognition()
  const speechSynthesis = useSpeechSynthesis()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current?.abort()
    }
  }, [])

  const processAssistantQuery = async (rawQuestion, fromVoice = false) => {
    const userQuestion = rawQuestion.trim()
    if (!userQuestion || processingRef.current) return

    processingRef.current = true
    const controller = new AbortController()
    requestRef.current = controller
    setQuestion('')
    setMessages((current) => [...current, { role: 'user', text: userQuestion }])
    setProcessing(true)
    speechRecognition.stopListening()
    speechSynthesis.stopSpeaking()
    setActiveSpeechIndex(null)

    try {
      const result = await queryAssistant(userQuestion, { signal: controller.signal })
      if (!mountedRef.current || controller.signal.aborted) return
      const speech = getSpeakableText(result)
      const plainAnswer = typeof result === 'string' || typeof result?.data === 'string'
      if (result?.success === false || !speech || (!plainAnswer && result.source === 'ai' && (
        typeof result.data.explanation !== 'string' || !Array.isArray(result.data.detectedSlang)
        || result.data.detectedSlang.some((item) => !item || typeof item.term !== 'string' || typeof item.meaning !== 'string')
      ))) {
        setMessages((current) => [...current, {
          role: 'ai', kind: 'error', text: 'No usable answer was returned. Please try another question.',
        }])
        return
      }
      if (plainAnswer) {
        setMessages((current) => [...current, { role: 'ai', text: speech, speech }])
      } else if (result.source === 'assistant') {
        setMessages((current) => [...current, { role: 'ai', text: result.data.message, speech }])
      } else if (result.source === 'dictionary') {
        const slang = result.data
        setMessages((current) => [...current, {
          role: 'ai', kind: 'result', slang,
          text: `${slang.word} means ${slang.meaning}`,
          speech,
        }])
      } else {
        const ai = result.data
        setMessages((current) => [...current, {
          role: 'ai', kind: 'ai-result', ai, text: ai.translation,
          speech,
        }])
      }
      if (fromVoice && speech && speechSynthesis.isSupported && speechSynthesis.speak(speech)) {
        setActiveSpeechIndex(messages.length + 1)
      }
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return
      setMessages((current) => [...current, {
        role: 'ai',
        kind: 'error',
        text: getAssistantError(error),
      }])
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      processingRef.current = false
      if (mountedRef.current) setProcessing(false)
    }
  }

  const handleMicrophone = () => {
    if (speechRecognition.isListening) {
      speechRecognition.stopListening()
      return
    }
    if (processingRef.current) return
    speechSynthesis.stopSpeaking()
    setActiveSpeechIndex(null)
    speechRecognition.startListening((transcript) => {
      processAssistantQuery(transcript, true)
    })
  }

  const handleSpeech = (message, index) => {
    speechRecognition.stopListening()
    if (speechSynthesis.isSpeaking && activeSpeechIndex === index) {
      speechSynthesis.stopSpeaking()
      setActiveSpeechIndex(null)
      return
    }
    if (speechSynthesis.speak(message.speech)) setActiveSpeechIndex(index)
  }

  const status = speechRecognition.isListening
    ? 'Listening...'
    : processing
      ? 'Processing...'
      : speechSynthesis.isSpeaking
        ? 'Speaking...'
        : 'Ready to listen'
  const statusClass = speechRecognition.isListening ? 'listening' : processing ? 'thinking' : speechSynthesis.isSpeaking ? 'speaking' : 'ready'

  return <main className="voice-page">
    <nav className="nav shell explore-nav" aria-label="Primary navigation"><Link className="logo" to="/" aria-label="Slangify home"><BrandLogo /></Link><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="primary-links">{menuOpen ? <X /> : <Menu />}</button><div id="primary-links" className={`nav-links ${menuOpen ? 'open' : ''}`}><Link to="/">Home</Link><Link to="/explore">Explore</Link><BuzzNavLink onClick={() => setMenuOpen(false)} /><Link to="/favorites">Favorites</Link><Link to="/add-slang">Add Slang</Link><Link className="active" to="/voice-assistant">Voice AI</Link><ThemeToggle /><AuthControl /></div></nav>
    <header className="voice-header"><span className="voice-spark vs-one">✦</span><span className="voice-spark vs-two">✧</span><span className="voice-eyebrow"><Sparkles size={14} fill="currentColor" /> your voice slang dictionary</span><h1>Talk Slang With <span>Voice 🎙️</span></h1><p>Ask about slang out loud or type a question below.</p></header>
    <section className="voice-shell shell"><div className="voice-card"><div className="voice-glow glow-one" /><div className="voice-glow glow-two" /><div className="voice-top"><div className="voice-bot"><Bot size={27} /></div><div><b>Slangify Voice</b><span><i /> connected to the dictionary</span></div><span role="status" className={`status status-${statusClass}`}>{status}</span></div><div className="voice-stage"><span className="stage-spark ss-one">✦</span><span className="stage-spark ss-two">✧</span><button className={speechRecognition.isListening ? 'mic-orb listening' : 'mic-orb'} onClick={handleMicrophone} disabled={!speechRecognition.isSupported || processing} aria-label={speechRecognition.isListening ? 'Stop listening' : 'Start voice recognition'}><span className="mic-ring ring-one" /><span className="mic-ring ring-two" /><Mic size={40} fill="currentColor" /></button><strong>{speechRecognition.isListening ? 'Listening...' : processing ? 'Processing...' : speechSynthesis.isSpeaking ? 'Speaking...' : 'Tap to speak'}</strong><p>{speechRecognition.isListening ? 'Ask about a slang term.' : processing ? 'Finding the best answer...' : speechSynthesis.isSpeaking ? 'Reading the result aloud.' : 'Or type your question below.'}</p><div className={speechRecognition.isListening || speechSynthesis.isSpeaking ? 'waveform active' : 'waveform'}>{[...Array(9)].map((_, index) => <i key={index} style={{ animationDelay: `${index * .08}s` }} />)}</div></div>
      {!speechRecognition.isSupported && <div className="voice-notice" role="status">Voice recognition isn't supported in this browser. You can still type your question.</div>}
      {speechRecognition.error && <div className="voice-notice voice-notice-error" role="alert">{speechRecognition.error}</div>}
      <div className="conversation" role="log" aria-label="Assistant conversation" aria-live="polite">{messages.length === 0 && <div className="conversation-empty"><Bot size={16} /><span>Ask a question or choose a quick prompt below.</span></div>}{messages.map((message, index) => <div className={`chat-row ${message.role}`} key={`${message.role}-${index}`}>
        {message.role === 'ai' && <span className="chat-bot"><Bot size={14} /></span>}
        <div className={`voice-message ${message.kind ? `voice-message-${message.kind}` : ''}`}>
          {message.kind === 'result' ? <div className="voice-result"><div className="voice-result-title"><span>{message.slang.emoji}</span><div><b>{message.slang.word}</b><small>{message.slang.category}</small></div></div><p>{message.slang.meaning}</p><div className="voice-result-example"><span>IN A SENTENCE</span>{message.slang.example}</div></div> : message.kind === 'ai-result' ? <div className="voice-result voice-ai-result"><div className="voice-result-title"><span>AI</span><div><b>In everyday English</b><small>CONTEXTUAL TRANSLATION</small></div></div><p>{message.ai.translation}</p><div className="voice-result-example"><span>WHY IT MEANS THAT</span>{message.ai.explanation}</div>{message.ai.detectedSlang?.length > 0 && <div className="voice-detected-slang"><span>DETECTED SLANG</span>{message.ai.detectedSlang.map((item) => <p key={`${item.term}-${item.meaning}`}><b>{item.term}</b> — {item.meaning}</p>)}</div>}</div> : message.text}
          {message.role === 'ai' && message.speech && speechSynthesis.isSupported && <button type="button" onClick={() => handleSpeech(message, index)} aria-label={speechSynthesis.isSpeaking && activeSpeechIndex === index ? 'Stop speaking' : 'Listen to assistant response'}>
            {speechSynthesis.isSpeaking && activeSpeechIndex === index ? <><VolumeX size={13} /> Stop</> : <><Volume2 size={13} /> Listen</>}
          </button>}
        </div>
      </div>)}{processing && <div className="chat-row ai"><span className="chat-bot"><Bot size={14} /></span><div className="voice-message typing-dots"><i /><i /><i /></div></div>}</div><form className="voice-input" onSubmit={(event) => { event.preventDefault(); processAssistantQuery(question) }}><input aria-label="Your slang question" maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Or type your slang question..." disabled={processing} /><button type="button" onClick={handleMicrophone} disabled={!speechRecognition.isSupported || processing} aria-label={speechRecognition.isListening ? 'Stop listening' : 'Start voice recognition'}><Mic size={18} /></button><button type="submit" disabled={processing || !question.trim()} aria-label="Send question"><Send size={17} /></button></form></div><div className="suggestions"><span>TRY ASKING</span><div>{suggestions.map((suggestion) => <button type="button" disabled={processing} key={suggestion} onClick={() => processAssistantQuery(suggestion)}>{suggestion}</button>)}</div></div></section>
    <Footer />
  </main>
}

export default VoiceAssistant
