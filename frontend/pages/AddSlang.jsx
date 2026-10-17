import BrandLogo from '../components/BrandLogo.jsx'
import BuzzNavLink from '../components/BuzzNavLink.jsx'
import { CheckCircle2, Menu, Plus, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthControl from '../components/AuthControl.jsx'
import Footer from '../components/Footer.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../src/context/useAuth.js'
import { createSlang } from '../src/services/slangService.js'
import './AddSlang.css'

const categories = ['Social Media', 'Meme', 'Gaming', 'Lifestyle', 'Gen Z', 'Other']
const emptyForm = { word: '', meaning: '', example: '', category: '', emoji: '', tags: '' }

function AddSlang() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [createdWord, setCreatedWord] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [submitError, setSubmitError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitted(false)
    setSubmitError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current || authLoading) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    const next = {}
    const word = form.word.trim()
    const meaning = form.meaning.trim()
    const example = form.example.trim()
    const emoji = form.emoji.trim()
    const tags = form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)

    if (!word) next.word = 'Slang word is required.'
    else if (word.length > 50) next.word = 'Use 50 characters or fewer.'
    if (!meaning) next.meaning = 'Meaning is required.'
    else if (meaning.length > 500) next.meaning = 'Use 500 characters or fewer.'
    if (!example) next.example = 'Example sentence is required.'
    else if (example.length > 500) next.example = 'Use 500 characters or fewer.'
    if (!categories.includes(form.category)) next.category = 'Pick a valid category.'
    if (emoji.length > 16) next.emoji = 'Use 16 characters or fewer.'
    if (tags.length > 10) next.tags = 'Add no more than 10 tags.'
    else if (tags.some((tag) => tag.length > 30)) next.tags = 'Each tag must be 30 characters or fewer.'

    setErrors(next)
    if (Object.keys(next).length) return

    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    setSubmitted(false)
    try {
      await createSlang({ word, meaning, example, emoji: emoji || undefined, category: form.category, tags })
      setCreatedWord(word)
      setForm(emptyForm)
      setSubmitted(true)
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login')
        return
      }
      const message = error.response?.status < 500 && error.response?.data?.message
      setSubmitError(error.response?.status === 409 ? 'That slang is already in the dictionary.' : message || "Couldn't submit that slang right now. Try again.")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const preview = {
    word: form.word || 'Your slang',
    meaning: form.meaning || 'Drop a clear, catchy meaning that makes the vibe easy to understand.',
    example: form.example || 'This is where your slang shines in a sentence.',
    category: form.category || 'Category',
    emoji: form.emoji || '✨',
  }

  if (!authLoading && !isAuthenticated) return <Navigate to="/login" replace />

  return <main className="add-page">
    <nav className="nav shell explore-nav" aria-label="Primary navigation"><Link className="logo" to="/" aria-label="Slangify home"><BrandLogo /></Link><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="primary-links">{menuOpen ? <X /> : <Menu />}</button><div id="primary-links" className={`nav-links ${menuOpen ? 'open' : ''}`}><Link to="/">Home</Link><Link to="/explore">Explore</Link><BuzzNavLink onClick={() => setMenuOpen(false)} /><Link to="/favorites">Favorites</Link><Link className="active" to="/add-slang">Add Slang</Link><Link to="/voice-assistant">Voice AI</Link><ThemeToggle /><AuthControl /></div></nav>
    <header className="add-header"><span className="header-spark hs-one">✦</span><span className="header-spark hs-two">✧</span><span className="add-badge">community powered ⚡</span><h1>Drop Some New <span>Slang ✨</span></h1><p>Know a word we're missing? Add it to the Slangify dictionary.</p></header>
    <section className="add-layout shell"><form className="add-card" onSubmit={handleSubmit} noValidate><div className="add-card-title"><span><Plus size={18} /></span><div><h2>Tell us the tea</h2><p>Every iconic word starts somewhere.</p></div></div><div className="form-grid"><label className={errors.word ? 'add-field has-error' : 'add-field'}><span>Slang word <b>*</b></span><input value={form.word} onChange={(event) => updateField('word', event.target.value)} placeholder="e.g. Rizz" maxLength="50" />{errors.word && <small>{errors.word}</small>}</label><label className={errors.emoji ? 'add-field has-error emoji-field' : 'add-field emoji-field'}><span>Emoji <i>optional</i></span><input value={form.emoji} onChange={(event) => updateField('emoji', event.target.value)} placeholder="✨" maxLength="16" />{errors.emoji && <small>{errors.emoji}</small>}</label></div><label className={errors.meaning ? 'add-field has-error' : 'add-field'}><span>Meaning <b>*</b></span><textarea value={form.meaning} onChange={(event) => updateField('meaning', event.target.value)} placeholder="What does it mean?" rows="3" maxLength="500" />{errors.meaning && <small>{errors.meaning}</small>}</label><label className={errors.example ? 'add-field has-error' : 'add-field'}><span>Example sentence <b>*</b></span><textarea value={form.example} onChange={(event) => updateField('example', event.target.value)} placeholder="Use it in a sentence..." rows="3" maxLength="500" />{errors.example && <small>{errors.example}</small>}</label><div className="form-grid"><label className={errors.category ? 'add-field has-error' : 'add-field'}><span>Category <b>*</b></span><select value={form.category} onChange={(event) => updateField('category', event.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>{errors.category && <small>{errors.category}</small>}</label><label className={errors.tags ? 'add-field has-error' : 'add-field'}><span>Tags <i>optional</i></span><input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="TikTok, viral, relationship" />{errors.tags && <small>{errors.tags}</small>}</label></div><button className="add-submit" type="submit" disabled={submitting || authLoading}>{submitting ? 'Submitting...' : 'Add to Slangify'} <Sparkles size={17} fill="currentColor" /></button>{submitError && <div className="submit-error" role="alert">{submitError}</div>}{submitted && <div className="submit-success"><CheckCircle2 size={18} /><span>Slang added successfully!</span><Link to={`/explore?search=${encodeURIComponent(createdWord)}`}>View in Explore</Link></div>}</form>
    <aside className="preview-wrap"><span className="preview-label"><Sparkles size={13} fill="currentColor" /> live preview</span><div className="preview-card"><div className="preview-top"><span className="preview-emoji">{preview.emoji}</span><span className="preview-heart">♥</span></div><div className="preview-word"><h3>{preview.word}</h3><span>{preview.category}</span></div><p className="preview-meaning">{preview.meaning}</p><div className="preview-example"><span>IN A SENTENCE</span><p>“{preview.example}”</p></div>{form.tags && <div className="preview-tags">{form.tags.split(',').slice(0, 3).map((tag) => tag.trim() && <span key={tag}>#{tag.trim()}</span>)}</div>}</div><p className="preview-note">Your community contribution will appear just like this.</p></aside></section>
    <Footer />
  </main>
}

export default AddSlang
