import PronunciationButton from '../components/PronunciationButton.jsx'
import BrandLogo from '../components/BrandLogo.jsx'
import BuzzNavLink from '../components/BuzzNavLink.jsx'
import { ArrowRight, Menu, Plus, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SlangCard from '../components/SlangCard.jsx'
import AuthControl from '../components/AuthControl.jsx'
import Footer from '../components/Footer.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../src/context/useAuth.js'
import { addFavorite, getFavorites, removeFavorite } from '../src/services/favoritesService.js'
import { getSlang } from '../src/services/slangService.js'
import './Explore.css'

const categories = ['All', 'Social Media', 'Meme', 'Gaming', 'Lifestyle', 'Gen Z', 'Other']
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const skeletons = Array.from({ length: 6 }, (_, index) => index)

function Explore() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('search') || '')
  const [category, setCategory] = useState('All')
  const [letter, setLetter] = useState(() => {
    const requestedLetter = searchParams.get('letter')?.toUpperCase()
    return requestedLetter && alphabet.includes(requestedLetter) ? requestedLetter : 'All'
  })
  const [sort, setSort] = useState('popular')
  const [trendingOnly, setTrendingOnly] = useState(() => searchParams.get('trending') === 'true')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [slang, setSlang] = useState([])
  const [loading, setLoading] = useState(true)
  const [paginating, setPaginating] = useState(false)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [favorites, setFavorites] = useState([])
  const [favoritesUserId, setFavoritesUserId] = useState(null)
  const [favoritesLoading, setFavoritesLoading] = useState(true)
  const [favoritePending, setFavoritePending] = useState([])
  const [favoriteError, setFavoriteError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const resultsRef = useRef(null)
  const paginationTargetRef = useRef(null)
  const requestControllerRef = useRef(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedLetter = searchParams.get('letter')?.toUpperCase()
      paginationTargetRef.current = null
      setPaginating(false)
      setQuery(searchParams.get('search') || '')
      setLetter(requestedLetter && alphabet.includes(requestedLetter) ? requestedLetter : 'All')
      setTrendingOnly(searchParams.get('trending') === 'true')
      setCategory('All')
      setPage(1)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [searchParams])

  useEffect(() => {
    const controller = new AbortController()
    requestControllerRef.current = controller
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const result = await getSlang({ search: query.trim() || undefined, category: category === 'All' ? undefined : category, letter: letter === 'All' ? undefined : letter, trending: trendingOnly || undefined, sort, page, limit: 12 }, { signal: controller.signal })
        if (controller.signal.aborted) return
        setSlang(result.data)
        setTotal(result.total)
        setPages(Math.max(result.pages, 1))
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.code !== 'ERR_CANCELED') {
          setError("Slangify couldn't fetch the tea right now. Try again.")
          setSlang([])
          setTotal(0)
          setPages(1)
        }
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setPaginating(false) }
      }
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, category, letter, sort, trendingOnly, page, retryKey])

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

  useEffect(() => {
    if (loading || paginationTargetRef.current !== page) return
    if (error) {
      paginationTargetRef.current = null
      return
    }
    // Wait until the committed cards and discovery area have their final layout.
    const frame = window.requestAnimationFrame(() => {
      if (paginationTargetRef.current !== page) return
      paginationTargetRef.current = null
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading, error, slang, page, query, category, letter, sort, trendingOnly])

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
      setFavorites((current) => wasFavorite
        ? [...new Set([...current, slangId])]
        : current.filter((id) => id !== slangId))
      setFavoriteError((requestError.response?.status < 500 && requestError.response?.data?.message) || "Couldn't update that favorite. Try again.")
    } finally {
      setFavoritePending((current) => current.filter((id) => id !== slangId))
    }
  }
  const changePage = (nextPage) => {
    if (loading || nextPage === page || nextPage < 1 || nextPage > pages) return
    paginationTargetRef.current = nextPage
    setPaginating(true)
    setLoading(true)
    setPage(nextPage)
  }
  const changeFilter = (setter, value) => {
    const filters = [[setQuery, query], [setCategory, category], [setLetter, letter], [setSort, sort], [setTrendingOnly, trendingOnly]]
    if (filters.some(([filterSetter, current]) => filterSetter === setter && current === value)) return
    // Invalidate in-flight results immediately, including during the debounce window.
    requestControllerRef.current?.abort()
    paginationTargetRef.current = null
    setLoading(true)
    setPaginating(false)
    setter(value)
    setPage(1)
  }
  const clearFilters = () => {
    requestControllerRef.current?.abort()
    paginationTargetRef.current = null
    setLoading(true)
    setPaginating(false)
    setQuery('')
    setCategory('All')
    setLetter('All')
    setSort('popular')
    setTrendingOnly(false)
    setPage(1)
  }
  const hasActiveFilters = Boolean(query.trim() || category !== 'All' || letter !== 'All' || trendingOnly)
  const featured = slang[0]
  const showResults = !loading || paginating

  return <main className="explore-page">
    <nav className="nav shell explore-nav" aria-label="Primary navigation">
      <Link className="logo" to="/" aria-label="Slangify home"><BrandLogo /></Link>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="primary-links">{menuOpen ? <X /> : <Menu />}</button>
      <div id="primary-links" className={`nav-links ${menuOpen ? 'open' : ''}`}><Link to="/">Home</Link><Link className="active" to="/explore">Explore</Link><BuzzNavLink onClick={() => setMenuOpen(false)} /><Link to="/favorites">Favorites</Link><Link to="/add-slang">Add Slang</Link><Link to="/voice-assistant">Voice AI</Link><ThemeToggle /><AuthControl /></div>
    </nav>

    <section className="explore-hero"><div className="shell"><span className="explore-eyebrow"><Sparkles size={14} fill="currentColor" /> the internet, decoded</span><h1>Explore <span>Slang</span></h1><p>Find the latest words, phrases, and internet expressions.</p><label className="explore-search"><Search size={20} /><input value={query} onChange={(event) => changeFilter(setQuery, event.target.value)} placeholder="Search slang..." aria-label="Search slang" /></label></div></section>

    <section className="explore-content shell"><Link className="explore-add-link" to="/add-slang"><Plus size={15} /> Add new slang</Link>
      <div className="filter-group"><span>FILTER BY VIBE</span><div className="category-filters">{categories.map((item) => <button className={category === item ? 'selected' : ''} onClick={() => changeFilter(setCategory, item)} key={item} aria-pressed={category === item}>{item}</button>)}</div></div>
      <div className="explore-toolbar"><button type="button" className={trendingOnly ? 'trending-toggle selected' : 'trending-toggle'} aria-pressed={trendingOnly} onClick={() => changeFilter(setTrendingOnly, !trendingOnly)}>🔥 Trending only</button><label>Sort by <select value={sort} onChange={(event) => changeFilter(setSort, event.target.value)}><option value="popular">Popular</option><option value="newest">Newest</option><option value="alphabetical">Alphabetical</option></select></label></div>
      {showResults && !error && featured && <div className="explore-discovery">
        <article className="word-of-day"><span className="wod-orb">{featured.emoji}</span><div><span>TOP OF THE VIBE</span><div className="slang-word-heading"><h2>{featured.word}</h2><PronunciationButton word={featured.word} /></div><p>{featured.meaning}</p></div><button type="button" onClick={() => changeFilter(setQuery, featured.word)}>Find the vibe <ArrowRight size={15} /></button></article>
        <div className="trending-rail"><span>FROM THE DICTIONARY</span><div>{slang.slice(0, 5).map((item, index) => <button key={item._id || item.word} onClick={() => changeFilter(setQuery, item.word)}><i>{index + 1}</i><b>{item.emoji}</b><span>{item.word}<small>{item.category}</small></span></button>)}</div></div>
      </div>}
      <div className="popular-heading" ref={resultsRef}><div><span className="section-kicker">hot right now <span>🔥</span></span><h2>{hasActiveFilters ? 'Your results' : 'Trending & popular'}</h2></div><span className="result-count">{total} words found</span></div>
      {loading && !showResults && <div className="explore-grid" aria-label="Loading slang">{skeletons.map((item) => <div className="explore-slang-card slang-skeleton" key={item}><span /><span /><span /><span /></div>)}</div>}
      {!loading && error && <div className="api-state api-error" role="alert"><h3>Couldn't load slang right now.</h3><p>{error}</p><button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div>}
      {favoriteError && <p className="favorite-feedback" role="alert">{favoriteError}</p>}
      {showResults && !error && <div className="explore-grid" aria-busy={loading}>{slang.map((item) => <SlangCard key={item._id} slang={item} isFavorite={isAuthenticated && activeFavorites.includes(item._id)} isFavoritePending={isAuthenticated && (favoritesLoading || favoritePending.includes(item._id))} onToggleFavorite={toggleFavorite} />)}</div>}
      {!loading && !error && total === 0 && slang.length === 0 && <div className="empty-state"><span>👀</span><h3>{hasActiveFilters ? 'No matching slang found' : 'No slang yet'}</h3><p>{hasActiveFilters ? 'Try another word, category, or letter.' : 'The dictionary is empty. Add the first slang word to get things started.'}</p>{hasActiveFilters ? <button type="button" onClick={clearFilters}>Clear filters</button> : <Link className="empty-add-link" to="/add-slang">Add new slang</Link>}</div>}
      {showResults && !error && total > 0 && <nav className="pagination" aria-label="Slang pages"><button type="button" disabled={loading || page === 1} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={loading || page >= pages} onClick={() => changePage(page + 1)}>Next</button></nav>}
    </section>

    <section className="az-section"><div className="shell"><div className="az-heading"><div><span className="section-kicker">old school browsing</span><h2>Find a word by letter</h2></div><button className={letter === 'All' ? 'all-letter selected' : 'all-letter'} onClick={() => changeFilter(setLetter, 'All')}>View all</button></div><div className="az-grid">{alphabet.map((item) => <button className={letter === item ? 'selected' : ''} aria-pressed={letter === item} onClick={() => changeFilter(setLetter, item)} key={item}>{item}</button>)}</div></div></section>

    <Footer />
  </main>
}

export default Explore
