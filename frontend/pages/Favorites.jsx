import BrandLogo from '../components/BrandLogo.jsx'
import BuzzNavLink from '../components/BuzzNavLink.jsx'
import { ArrowRight, BookHeart, Heart, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthControl from '../components/AuthControl.jsx'
import Footer from '../components/Footer.jsx'
import SlangCard from '../components/SlangCard.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../src/context/useAuth.js'
import { getFavorites, removeFavorite as removeFavoriteRequest } from '../src/services/favoritesService.js'
import './Explore.css'
import './Favorites.css'

const skeletons = Array.from({ length: 6 }, (_, index) => index)

function Favorites() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removeError, setRemoveError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [removing, setRemoving] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      getFavorites({ signal: controller.signal })
        .then((result) => setFavorites(result.data))
        .catch((requestError) => {
          if (requestError.code !== 'ERR_CANCELED') {
            setError((requestError.response?.status < 500 && requestError.response?.data?.message) || "Couldn't load your favorites right now.")
          }
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [authLoading, isAuthenticated, navigate, retryKey])

  const removeFavorite = async (slangId) => {
    if (!slangId || removing.includes(slangId)) return
    const removed = favorites.find((item) => item._id === slangId)
    setRemoving((current) => [...current, slangId])
    setFavorites((current) => current.filter((item) => item._id !== slangId))
    setRemoveError('')

    try {
      await removeFavoriteRequest(slangId)
    } catch (requestError) {
      if (removed) {
        setFavorites((current) => current.some((item) => item._id === slangId) ? current : [...current, removed])
      }
      setRemoveError(requestError.response?.status === 401
        ? 'Your session has expired. Log in again to update favorites.'
        : "Couldn't remove that favorite. Try again.")
    } finally {
      setRemoving((current) => current.filter((id) => id !== slangId))
    }
  }

  return <main className="favorites-page">
    <nav className="nav shell explore-nav" aria-label="Primary navigation">
      <Link className="logo" to="/" aria-label="Slangify home"><BrandLogo /></Link>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="primary-links">{menuOpen ? <X /> : <Menu />}</button>
      <div id="primary-links" className={`nav-links ${menuOpen ? 'open' : ''}`}><Link to="/">Home</Link><Link to="/explore">Explore</Link><BuzzNavLink onClick={() => setMenuOpen(false)} /><Link className="active" to="/favorites">Favorites</Link><Link to="/add-slang">Add Slang</Link><Link to="/voice-assistant">Voice AI</Link><ThemeToggle /><AuthControl /></div>
    </nav>
    <section className="favorites-hero"><div className="favorites-blob blob-left" /><div className="favorites-blob blob-right" /><div className="shell"><span className="explore-eyebrow"><Heart size={14} fill="currentColor" /> your saved collection</span><h1>Your Favorite <span>Slang</span> <b>❤️</b></h1><p>Keep all your favorite internet words in one place.</p></div></section>
    <section className="favorites-content shell">
      {removeError && <p className="favorite-feedback" role="alert">{removeError}</p>}
      {(authLoading || loading) && <div className="explore-grid favorites-grid" aria-label="Loading favorites">{skeletons.map((index) => <div className="explore-slang-card slang-skeleton" key={index}><span /><span /><span /><span /></div>)}</div>}
      {!authLoading && !loading && error && <div className="api-state api-error" role="alert"><h3>Couldn't load favorites.</h3><p>{error}</p><button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div>}
      {!authLoading && !loading && !error && favorites.length > 0 && <><div className="favorites-summary"><div><span className="section-kicker">saved for later</span><h2>Your vibe vault</h2></div><span>{favorites.length} {favorites.length === 1 ? 'word' : 'words'} saved</span></div><div className="explore-grid favorites-grid">{favorites.map((slang) => <SlangCard key={slang._id} slang={slang} isFavorite isFavoritePending={removing.includes(slang._id)} onToggleFavorite={removeFavorite} />)}</div></>}
      {!authLoading && !loading && !error && favorites.length === 0 && <div className="favorites-empty"><div className="empty-art"><div className="heart-orbit"><Heart fill="currentColor" size={44} /></div><BookHeart size={66} /><span>✦</span><i>✧</i></div><h2>No favorites yet <span>👀</span></h2><p>No favorites yet. Explore slang and tap the heart to save some.</p><Link to="/explore">Explore Slang <ArrowRight size={17} /></Link></div>}
    </section>
    <Footer />
  </main>
}

export default Favorites
