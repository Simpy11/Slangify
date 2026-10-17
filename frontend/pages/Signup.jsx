import BrandLogo from '../components/BrandLogo.jsx'
import { ArrowRight, AtSign, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Login.css'
import './Signup.css'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../src/context/useAuth.js'

function Signup() {
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [authError, setAuthError] = useState('')
  const { signup } = useAuth()
  const navigate = useNavigate()

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    setAuthError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Full name is required.'
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!form.username.trim()) nextErrors.username = 'Username is required.'
    if (!form.password) nextErrors.password = 'Password is required.'
    else if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.'
    else if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setAuthError('')
    try {
      await signup({ name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password })
      navigate('/')
    } catch (error) {
      setAuthError((error.response?.status < 500 && error.response?.data?.message) || "Couldn't create your account right now. Try again.")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const passwordField = (field, label, placeholder, visible, toggleVisible) => <label className={errors[field] ? 'login-field has-error' : 'login-field'}><span>{label}</span><div><LockKeyhole size={18} /><input type={visible ? 'text' : 'password'} value={form[field]} onChange={(event) => updateField(field, event.target.value)} placeholder={placeholder} autoComplete="new-password" minLength="8" /><button type="button" onClick={toggleVisible} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors[field] && <small>{errors[field]}</small>}</label>

  return <main className="login-page signup-page">
    <ThemeToggle className="auth-theme-toggle" />
    <section className="login-brand-panel">
      <div className="brand-orb orb-a" /><div className="brand-orb orb-b" /><div className="brand-orb orb-c" />
      <Link className="login-logo" to="/"><BrandLogo /></Link>
      <div className="brand-content"><p className="brand-pill"><Sparkles size={14} fill="currentColor" /> join the conversation</p><h1>Start speaking<br /><em>the internet ✨</em></h1><p>Make sense of every vibe, trend, and group chat in one place.</p></div>
      <div className="bubble bubble-one">no cap <b>💯</b></div><div className="bubble bubble-two">slay <b>✨</b></div><div className="bubble bubble-three">it's giving <b>💅</b></div><div className="bubble bubble-four">rizz <b>😎</b></div><div className="bubble bubble-five">delulu <b>💭</b></div>
      <div className="brand-chat"><div className="chat-avatar"><Sparkles size={15} fill="currentColor" /></div><div><span>Slangify AI</span><p>your new online bestie ✦</p></div></div><span className="brand-spark spark-one">✦</span><span className="brand-spark spark-two">✧</span><span className="brand-spark spark-three">✦</span>
    </section>
    <section className="login-form-panel"><Link className="mobile-logo login-logo" to="/"><BrandLogo /></Link><div className="login-card signup-card"><div className="login-heading"><BrandLogo variant="auth" /><h2>Create your account</h2><p>Join the Slangify inner circle.</p></div><form onSubmit={handleSubmit} noValidate>
      <div className="signup-row"><label className={errors.name ? 'login-field has-error' : 'login-field'}><span>Full name</span><div><UserRound size={18} /><input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Your full name" autoComplete="name" /></div>{errors.name && <small>{errors.name}</small>}</label><label className={errors.username ? 'login-field has-error' : 'login-field'}><span>Username</span><div><AtSign size={18} /><input value={form.username} onChange={(event) => updateField('username', event.target.value)} placeholder="yourhandle" autoComplete="username" /></div>{errors.username && <small>{errors.username}</small>}</label></div>
      <label className={errors.email ? 'login-field has-error' : 'login-field'}><span>Email address</span><div><Mail size={18} /><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" autoComplete="email" /></div>{errors.email && <small>{errors.email}</small>}</label>
      {passwordField('password', 'Password', 'At least 8 characters', showPassword, () => setShowPassword(!showPassword))}{passwordField('confirmPassword', 'Confirm password', 'Type it one more time', showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
      {authError && <div className="auth-form-error" role="alert">{authError}</div>}<button className="login-submit" type="submit" disabled={submitting}>{submitting ? 'Creating account...' : 'Create account'} <ArrowRight size={18} /></button>
    </form><p className="signup-copy">Already have an account? <Link to="/login">Log in</Link></p></div></section>
  </main>
}

export default Signup
