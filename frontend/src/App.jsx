import BrandLogo from '../components/BrandLogo.jsx'
import GenZBuzzPage from '../pages/GenZBuzzPage.jsx'
import BuzzNavLink from '../components/BuzzNavLink.jsx'
import { ArrowRight, Bot, Heart, Menu, Mic, Plus, Search, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import Login from '../pages/Login.jsx'
import Explore from '../pages/Explore.jsx'
import Signup from '../pages/Signup.jsx'
import Favorites from '../pages/Favorites.jsx'
import AddSlang from '../pages/AddSlang.jsx'
import VoiceAssistant from '../pages/VoiceAssistant.jsx'
import SlangCard from '../components/SlangCard.jsx'
import AuthControl from '../components/AuthControl.jsx'
import Footer from '../components/Footer.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from './context/useAuth.js'
import { addFavorite, getFavorites, removeFavorite } from './services/favoritesService.js'
import { useSpeechRecognition } from './hooks/useSpeechRecognition.js'
import { getSlang, getTrendingSlang } from './services/slangService.js'
import { extractSlangQuery } from './utils/voiceQuery.js'
import './App.css'
import './home-premium.css'
import heroLogo from './assets/slangify-logo.png'
import './hero-logo.css'

const features = [
  { icon: Search, title: 'Search Slang', text: 'Find any term in seconds.', color: 'purple', to: '/explore' },
  { icon: Heart, title: 'Save Favorites', text: 'Keep your top words close.', color: 'pink', to: '/favorites' },
  { icon: Plus, title: 'Add New Slang', text: 'Help shape the dictionary.', color: 'blue', to: '/add-slang' },
  { icon: Mic, title: 'Voice Assistant', text: 'Just ask. We get the vibe.', color: 'orange', to: '/voice-assistant' },
]

function Logo() {
  return <a className="logo" href="#home" aria-label="Slangify home"><BrandLogo /></a>
}

function App() {
  const navigate = useNavigate()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const speechRecognition = useSpeechRecognition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [homeSlang, setHomeSlang] = useState([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [favoritesUserId, setFavoritesUserId] = useState(null)
  const [favoritesLoading, setFavoritesLoading] = useState(true)
  const [favoritePending, setFavoritePending] = useState([])
  const [favoriteError, setFavoriteError] = useState('')
  const heroArtRef = useRef(null)
  const searchRequestRef = useRef(null)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  const loadTrending = useCallback(async () => {
    searchRequestRef.current?.abort()
    const controller = new AbortController()
    searchRequestRef.current = controller
    setHomeLoading(true)
    setHomeError('')
    setSearchActive(false)
    try {
      const result = await getTrendingSlang({}, { signal: controller.signal })
      if (controller.signal.aborted) return
      setHomeSlang(result.data)
    } catch {
      if (!controller.signal.aborted) setHomeError("Slangify couldn't fetch the tea right now. Try again.")
    } finally {
      if (!controller.signal.aborted) setHomeLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadTrending, 0)
    return () => {
      window.clearTimeout(timer)
      searchRequestRef.current?.abort()
    }
  }, [loadTrending])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setFavoritesLoading(true)
      setFavoriteError('')
      getFavorites({ signal: controller.signal })
        .then((result) => {
          setFavorites(result.data.map((item) => item._id))
          setFavoritesUserId(user._id)
        })
        .catch((requestError) => {
          if (requestError.code !== 'ERR_CANCELED') {
            setFavorites([])
            setFavoritesUserId(user._id)
            setFavoriteError("Couldn't load your favorites right now.")
          }
        })
        .finally(() => { if (!controller.signal.aborted) setFavoritesLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [authLoading, isAuthenticated, user])

  const handleHeroTilt = (event) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    const visual = heroArtRef.current
    if (!visual) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - .5
    const y = (event.clientY - bounds.top) / bounds.height - .5
    visual.style.setProperty('--logo-tilt-x', `${(-y * 10).toFixed(2)}deg`)
    visual.style.setProperty('--logo-tilt-y', `${(x * 10).toFixed(2)}deg`)
  }

  const resetHeroTilt = () => {
    heroArtRef.current?.style.setProperty('--logo-tilt-x', '0deg')
    heroArtRef.current?.style.setProperty('--logo-tilt-y', '0deg')
  }

  const runSearch = async (value) => {
    const search = value.trim()
    if (!search) return loadTrending()
    searchRequestRef.current?.abort()
    const controller = new AbortController()
    searchRequestRef.current = controller
    setHomeLoading(true)
    setHomeError('')
    setSearchActive(true)
    document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth' })
    try {
      const result = await getSlang({ search, sort: 'popular', limit: 6 }, { signal: controller.signal })
      if (controller.signal.aborted) return
      setHomeSlang(result.data)
    } catch {
      if (!controller.signal.aborted) setHomeError("Slangify couldn't fetch the tea right now. Try again.")
    } finally {
      if (!controller.signal.aborted) setHomeLoading(false)
    }
  }

  const handleSearch = (event) => { event.preventDefault(); if (!homeLoading) runSearch(query) }
  const choosePopular = (word) => { setQuery(word); runSearch(word) }
  const activeFavorites = favoritesUserId === user?._id ? favorites : []
  const toggleFavorite = async (slangId) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!slangId || favoritePending.includes(slangId)) return

    const wasFavorite = activeFavorites.includes(slangId)
    setFavoriteError('')
    setFavoritePending((current) => [...current, slangId])
    setFavorites((current) => wasFavorite ? current.filter((id) => id !== slangId) : [...current, slangId])
    try {
      if (wasFavorite) await removeFavorite(slangId)
      else await addFavorite(slangId)
    } catch (requestError) {
      setFavorites((current) => wasFavorite ? [...new Set([...current, slangId])] : current.filter((id) => id !== slangId))
      setFavoriteError((requestError.response?.status < 500 && requestError.response?.data?.message) || "Couldn't update that favorite. Try again.")
    } finally {
      setFavoritePending((current) => current.filter((id) => id !== slangId))
    }
  }
  const handleVoiceSearch = () => {
    if (speechRecognition.isListening) {
      speechRecognition.stopListening()
      return
    }
    speechRecognition.startListening((transcript) => {
      setQuery(transcript)
      navigate(`/explore?search=${encodeURIComponent(extractSlangQuery(transcript))}`)
    })
  }

  return (
    <Routes>
      <Route path="/" element={<main>
      <nav className="nav shell" aria-label="Primary navigation">
        <Logo />
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="primary-links">{menuOpen ? <X /> : <Menu />}</button>
        <div id="primary-links" className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a className="active" href="#home">Home</a><Link to="/explore">Explore</Link><BuzzNavLink onClick={() => setMenuOpen(false)} /><Link to="/favorites">Favorites</Link><Link to="/add-slang">Add Slang</Link><Link to="/voice-assistant">Voice AI</Link>
          <ThemeToggle /><AuthControl />
        </div>
      </nav>

      <section className="hero-section shell" id="home">
        <div className="hero-gradient-blob hero-blob-purple" aria-hidden="true" />
        <div className="hero-gradient-blob hero-blob-pink" aria-hidden="true" />
        <div className="hero-gradient-blob hero-blob-blue" aria-hidden="true" />
        <div className="hero-slang-chip chip-no-cap" aria-hidden="true">no cap <span>💯</span></div>
        <div className="hero-slang-chip chip-slay" aria-hidden="true">slay <span>✨</span></div>
        <div className="hero-slang-chip chip-rizz" aria-hidden="true">rizz <span>😎</span></div>
        <div className="hero-slang-chip chip-delulu" aria-hidden="true">delulu <span>💭</span></div>
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} fill="currentColor" /> your internet translator</div>
          <h1><span className="hero-gradient-word">Decode</span> the Internet.<br /><span>Speak Gen Z.</span></h1>
          <p>Discover the meaning of modern slang, internet culture, and trending expressions instantly.</p>
          <form className="search-box" onSubmit={handleSearch}>
            <Search size={21} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any slang..." aria-label="Search slang" />
            <button type="button" className="mic-button" onClick={handleVoiceSearch} disabled={!speechRecognition.isSupported} aria-label={speechRecognition.isListening ? 'Stop voice search' : 'Start voice search'}><Mic size={19} /></button>
            <button className="search-submit" aria-label={homeLoading ? "Searching slang" : "Search"} disabled={homeLoading}><ArrowRight size={19} /></button>
          </form>
          {speechRecognition.isListening && <span className="listening"><span /> Listening... ask about a slang word</span>}
          {!speechRecognition.isSupported && <span className="listening">Voice recognition isn't supported here. You can still type your search.</span>}
          {speechRecognition.error && <span className="listening" role="alert">{speechRecognition.error}</span>}
          <div className="popular"><span>Popular:</span><button onClick={() => choosePopular('Rizz')}>Rizz</button><button onClick={() => choosePopular('Delulu')}>Delulu</button><button onClick={() => choosePopular('Aura')}>Aura</button></div>
        </div>
        <div className="hero-art hero-logo-scene" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="float-card card-heart"><Heart size={22} fill="currentColor" /><span>main character<br />energy</span></div>
          <div className="float-card card-spark"><Sparkles size={22} /><span>it's giving</span></div>
          <div className="hero-logo-stage" onPointerMove={handleHeroTilt} onPointerLeave={resetHeroTilt} onPointerCancel={resetHeroTilt}>
            <div className="hero-logo-shadow" />
            <div className="hero-logo-tilt" ref={heroArtRef}>
              <div className="hero-logo-float">
                <img className="hero-logo-image" src={heroLogo} alt="" width="1254" height="1254" decoding="async" draggable="false" />
              </div>
            </div>
          </div>
          <div className="emoji-ball ball-one">✦</div><div className="emoji-ball ball-two">💬</div><div className="emoji-ball ball-three">✿</div>
        </div>
      </section>

      <section className="trending-section" id="trending"><div className="shell">
        <div className="section-heading"><div><span className="section-kicker">what's hot rn <span>🔥</span></span><h2>{searchActive ? 'Search results' : 'Trending slang'}</h2></div><Link to="/explore">Explore all <ArrowRight size={17} /></Link></div>
        {homeLoading && <div className="slang-grid" aria-label="Loading the latest slang">{Array.from({ length: 6 }, (_, index) => <div className="slang-card slang-skeleton" key={index}><span /><span /><span /><span /></div>)}</div>}
        {!homeLoading && homeError && <div className="api-state api-error" role="alert"><h3>Couldn't load slang right now.</h3><p>{homeError}</p><button type="button" onClick={() => searchActive ? runSearch(query) : loadTrending()}>Retry</button></div>}
        {favoriteError && <p className="favorite-feedback" role="alert">{favoriteError}</p>}
        {!homeLoading && !homeError && <div className="slang-grid">{homeSlang.map((item) => <SlangCard variant="home" slang={item} key={item._id} isFavorite={isAuthenticated && activeFavorites.includes(item._id)} isFavoritePending={isAuthenticated && (favoritesLoading || favoritePending.includes(item._id))} onToggleFavorite={toggleFavorite} />)}</div>}
        {!homeLoading && !homeError && homeSlang.length === 0 && <div className="api-state"><h3>No slang found 👀</h3><button type="button" onClick={loadTrending}>Show trending slang</button></div>}
      </div></section>

<section className="alphabet-section shell" id="explore"><div className="alphabet-copy"><span className="section-kicker">the whole dictionary</span><h2>Browse by alphabet</h2><p>From ATE to Zaddy, find the words that keep your group chat buzzing.</p></div><div className="alphabet-grid">{alphabet.map((letter) => <button type="button" onClick={() => navigate(`/explore?letter=${letter}`)} key={letter} aria-label={`Browse slang beginning with ${letter}`}>{letter}</button>)}</div></section>

      <section className="feature-section" id="favorites"><div className="shell"><div className="center-heading"><span className="section-kicker">made for the chronically online</span><h2>Everything you need to stay <em>in the know.</em></h2></div><div className="feature-grid">{features.map(({ icon: Icon, title, text, color, to }) => <Link className="feature-card" to={to} key={title} aria-label={`Open ${title}`}><div className={`feature-icon ${color}`}><Icon size={23} /></div><h3>{title}</h3><p>{text}</p><span className="feature-cta">Open feature <ArrowRight size={15} /></span></Link>)}</div></div></section>

      <section className="voice-section shell"><div className="voice-copy"><span className="section-kicker">say less, we got you</span><h2>Meet your voice<br /><em>slang dictionary.</em></h2><p>Ask out loud and get answers from the real Slangify dictionary.</p><button className="primary-button" onClick={() => navigate('/voice-assistant')}><Mic size={17} /> Try voice assistant</button></div><div className="assistant-card"><div className="assistant-top"><div className="bot-avatar"><Bot size={20} /></div><div><b>Slangify Voice</b><span><i /> connected to the dictionary</span></div></div><div className="message ai-message"><div className="mini-avatar"><Bot size={13} /></div><div><p>Ask me what a slang word means using your voice or keyboard.</p></div></div><div className="assistant-input"><span>Ask me anything...</span><button onClick={() => navigate('/voice-assistant')} aria-label="Open voice assistant"><Mic size={16} /></button></div></div></section>

      <Footer />
    </main>} />
      <Route path="/login" element={<Login />} />
      <Route path="/genz-buzz" element={<GenZBuzzPage />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/favorites" element={<Favorites />} />
      <Route path="/add-slang" element={<AddSlang />} />
      <Route path="/voice-assistant" element={<VoiceAssistant />} />
    </Routes>
  )
}

export default App
