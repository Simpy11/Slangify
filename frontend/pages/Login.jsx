import BrandLogo from '../components/BrandLogo.jsx'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Login.css'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../src/context/useAuth.js'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [authError, setAuthError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!email.trim()) nextErrors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Password is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setAuthError('')
    try {
      await login({ email: email.trim(), password })
      navigate('/')
    } catch (error) {
      setAuthError((error.response?.status < 500 && error.response?.data?.message) || "Couldn't log you in right now. Try again.")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const updateField = (field, value) => {
    if (field === 'email') setEmail(value)
    else setPassword(value)
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    setAuthError('')
  }

  return <main className="login-page">
    <section className="login-brand-panel">
      <div className="brand-orb orb-a" /><div className="brand-orb orb-b" /><div className="brand-orb orb-c" />
      <Link className="login-logo" to="/"><BrandLogo /></Link>
      <div className="brand-content"><p className="brand-pill"><Sparkles size={14} fill="currentColor" /> your internet translator</p><h1>Welcome back,<br /><em>bestie ✨</em></h1><p>Your daily dose of internet language is waiting.</p></div>
      <div className="bubble bubble-one">no cap <b>💯</b></div><div className="bubble bubble-two">slay <b>✨</b></div><div className="bubble bubble-three">it's giving <b>💅</b></div><div className="bubble bubble-four">rizz <b>😎</b></div><div className="bubble bubble-five">delulu <b>💭</b></div>
      <div className="brand-chat"><div className="chat-avatar"><Sparkles size={15} fill="currentColor" /></div><div><span>Slangify AI</span><p>ready to catch you up ✦</p></div></div>
      <span className="brand-spark spark-one">✦</span><span className="brand-spark spark-two">✧</span><span className="brand-spark spark-three">✦</span>
    </section>
    <ThemeToggle className="auth-theme-toggle" />

    <section className="login-form-panel enhanced-login-panel"><span className="form-blob form-blob-one" /><span className="form-blob form-blob-two" /><span className="form-spark form-spark-one">✦</span><span className="form-spark form-spark-two">✧</span><span className="form-spark form-spark-three">✦</span><Link className="mobile-logo login-logo" to="/"><BrandLogo /></Link><div className="login-card enhanced-login-card"><span className="card-spark card-spark-one">✦</span><span className="card-spark card-spark-two">✧</span><div className="login-heading"><BrandLogo variant="auth" /><span className="welcome-badge">✨ welcome back</span><h2>Log in to <em>Slangify</em></h2><p>Ready to get back in the loop?</p><span className="energy-tag">currently serving: main character energy ✨</span></div><form onSubmit={handleSubmit} noValidate>
      <label className={errors.email ? 'login-field has-error' : 'login-field'}><span>Email address</span><div><Mail size={18} /><input type="email" value={email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" autoComplete="email" /></div>{errors.email && <small>{errors.email}</small>}</label>
      <label className={errors.password ? 'login-field has-error' : 'login-field'}><span>Password</span><div><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => updateField('password', event.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <small>{errors.password}</small>}</label>
      {authError && <div className="auth-form-error" role="alert">{authError}</div>}<button className="login-submit" type="submit" disabled={submitting}>{submitting ? 'Logging in...' : 'Log in'} <ArrowRight size={18} /></button>
    </form><p className="signup-copy">New to Slangify? <Link to="/signup">Sign up</Link></p></div></section>
  </main>
}

export default Login
