import { ArrowUpRight, ImageOff, Radio, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getNews } from '../src/services/newsService.js'
import './GenZBuzz.css'

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

function ArticleImage({ article }) {
  const [failed, setFailed] = useState(false)
  return <div className="buzz-image">
    {article.image && !failed ? <img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <div className="buzz-no-image"><ImageOff size={30} /><span>Image unavailable</span></div>}
    <span className="buzz-topic">{article.topic}</span>
  </div>
}

export default function GenZBuzz() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)
  const requestRef = useRef(null)
  const load = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    try {
      const result = await getNews({ signal: controller.signal })
      if (controller.signal.aborted) return
      if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid news response')
      setArticles(result.data.slice(0, 5))
      setMeta(result)
    } catch {
      if (!controller.signal.aborted) setError("Couldn't catch the latest buzz. Please try again in a little while.")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(load, 0)
    const interval = window.setInterval(load, 45 * 60 * 1000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval); requestRef.current?.abort() }
  }, [load])

  return <section className="buzz-section" id="genz-buzz" aria-labelledby="buzz-heading">
    <div className="shell">
      <div className="buzz-heading">
        <div><span className="section-kicker"><Radio size={15} /> culture moves fast</span><h1 id="buzz-heading">Gen Z <em>Buzz</em><span className="buzz-live">THE LATEST</span></h1><p>Your scroll, upgraded. Fresh stories from across the internet.</p></div>
        <button type="button" className="buzz-refresh" onClick={load} disabled={loading} aria-label="Refresh News"><RefreshCw size={16} className={loading ? 'buzz-spin' : ''} />{loading ? 'Checking...' : 'Refresh News'}</button>
      </div>
      <div className="buzz-status" role="status" aria-live="polite">
        {meta?.updatedAt && <span>Last checked {formatDate(meta.updatedAt)} | Updates every 45 minutes</span>}
        {meta?.stale && <span>Sources are taking a break. Showing recent cached stories.</span>}
        {!meta?.stale && meta?.partial && <span>Some publishers are unavailable. Showing stories from available sources.</span>}
        {loading && articles.length > 0 && <span>Checking for updates...</span>}
      </div>
      {error && <div className="buzz-state buzz-error" role="alert"><h3>The buzz will be back.</h3><p>{error}</p><button type="button" onClick={load} disabled={loading}>Try again</button></div>}
      {loading && !articles.length && <div className="buzz-grid" aria-label="Loading news" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div className="buzz-card buzz-skeleton" key={index} aria-hidden="true"><div /><span /><span /><span /></div>)}</div>}
      {!loading && !error && !articles.length && <div className="buzz-state"><Radio size={30} /><h3>A quiet moment on the feed.</h3><p>No recent stories matched the buzz. Check back soon for fresh headlines.</p></div>}
      {articles.length > 0 && <div className="buzz-grid" aria-busy={loading}>{articles.map((article) => <article className="buzz-card" key={article.id}>
        <ArticleImage article={article} />
        <div className="buzz-card-body"><div className="buzz-byline"><span>{article.source}</span><time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time></div>
          <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3><p>{article.summary}</p>
          <a className="buzz-read" href={article.url} target="_blank" rel="noopener noreferrer" aria-label={`Read more: ${article.title}`}>Read More <ArrowUpRight size={16} /></a>
        </div>
      </article>)}</div>}
      <p className="buzz-footnote">Real headlines. Original reporting. Stories link directly to their publishers.</p>
    </div>
  </section>
}
