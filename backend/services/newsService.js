import Parser from 'rss-parser'
import { decode } from 'he'
import { createHash } from 'node:crypto'

export const NEWS_FEEDS = [
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', topic: 'Technology & AI' },
  { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', topic: 'Technology & AI' },
  { name: 'BBC Entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', topic: 'Entertainment' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/games/rss', topic: 'Gaming' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/music/rss', topic: 'Music' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/lifeandstyle/rss', topic: 'Culture & lifestyle' },
]
const MAX_AGE_MS = 72 * 60 * 60 * 1000
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000
const parser = new Parser({ customFields: { item: [
  ['media:content', 'mediaContent', { keepArray: true }],
  ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
  ['published', 'published'],
] } })

function plainText(value) {
  return decode(String(value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export function safeUrl(value) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|at_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key)
    }
    return url.href
  } catch { return null }
}

function imageFrom(item) {
  const media = [...(item.mediaContent || []), ...(item.mediaThumbnail || [])]
    .filter((entry) => entry?.$?.url).sort((a, b) => Number(b.$.width || 0) - Number(a.$.width || 0))
  for (const entry of media) {
    const url = safeUrl(entry.$.url)
    if (url && (!entry.$.medium || entry.$.medium === 'image')) return url
  }
  if (item.enclosure?.type?.startsWith('image/')) return safeUrl(item.enclosure.url)
  const html = item['content:encoded'] || item.content || item.summary || ''
  const match = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)
  return match ? safeUrl(decode(match[1])) : null
}

function relevance(text, topic) {
  // Curated topic feeds plus explicit signals, not generated or inferred news.
  if (/\b(?:obituar(?:y|ies)|death toll|murder|porn(?:ography)?|incest|stock market|earnings report|classical music|opera|folk legend|president|white house|trump|elections?)\b/i.test(text)) return 0
  let score = 0
  if (/\b(?:gen[ -]?z|generation z|young people|youth|teens?|tiktok|memes?|viral|influencers?|creators?|internet culture)\b/i.test(text)) score += 5
  if (/\b(?:social media|instagram|snapchat|youtube|twitch|discord|reddit|streamers?|fandom|trends?)\b/i.test(text)) score += 3
  if (/\b(?:AI|artificial intelligence|chatgpt|gaming|games?|nintendo|playstation|xbox|roblox|minecraft|fortnite|smartphones?|iphone|android)\b/i.test(text)) score += 2
  if (/\b(?:music|albums?|pop|concerts?|festivals?|celebrit(?:y|ies)|netflix|spotify|streaming|fashion|streetwear|dating|wellness|lifestyle)\b/i.test(text)) score += 2
  if (topic === 'Gaming') score += 2
  return score
}

export function normalizeArticle(item, feed, now = Date.now()) {
  const title = plainText(item.title)
  const summary = plainText(item.contentSnippet || item.summary || item.description || item.content || item['content:encoded'])
    .replace(/(?:Continue reading|Read the full story).*$/i, '').trim()
  // Never use Atom's updated date as an invented publication timestamp.
  const published = item.pubDate || item.published || item.isoDate
  const timestamp = Date.parse(published)
  const url = safeUrl(item.link)
  const score = relevance(`${title} ${summary} ${(item.categories || []).map((c) => typeof c === 'string' ? c : c?._ || '').join(' ')}`, feed.topic)
  if (!url || !title || !summary || !Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_AGE_MS || !score) return null
  const topic = /\b(?:games?|gaming|steam|nintendo|playstation|xbox)\b/i.test(`${title} ${summary}`) ? 'Gaming'
    : /\b(?:tiktok|memes?|viral|social media|instagram|influencers?)\b/i.test(`${title} ${summary}`) ? 'Internet culture'
      : feed.topic
  return {
    id: createHash('sha256').update(url).digest('hex').slice(0, 20),
    title: title.slice(0, 240), summary: summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}\u2026` : summary,
    url, image: imageFrom(item), source: feed.name, publishedAt: new Date(timestamp).toISOString(), topic,
    relevance: score,
  }
}

export function selectArticles(articles, now = Date.now()) {
  const ranked = articles.filter((item) => now - Date.parse(item.publishedAt) <= MAX_AGE_MS && Date.parse(item.publishedAt) <= now + 5 * 60 * 1000)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.relevance - a.relevance)
  const urls = new Set(), titles = new Set(), selected = []
  for (const item of ranked) {
    const titleKey = item.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    if (urls.has(item.url) || titles.has(titleKey)) continue
    urls.add(item.url); titles.add(titleKey)
    const { relevance: _score, ...article } = item
    selected.push(article)
    if (selected.length === 5) break
  }
  return selected
}

export function createNewsService({ fetchImpl = (...args) => fetch(...args), now = Date.now, feeds = NEWS_FEEDS,
  cacheMinutes = process.env.NEWS_CACHE_MINUTES || 45 } = {}) {
  const minutes = Number(cacheMinutes)
  const ttl = Math.min(60, Math.max(30, Number.isFinite(minutes) ? minutes : 45)) * 60000
  let cache = null, inFlight = null, nextAttempt = 0

  async function fetchFeed(feed) {
    const response = await fetchImpl(feed.url, { headers: { 'User-Agent': 'Slangify/1.0 (Gen Z Buzz RSS reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const xml = await response.text()
    if (xml.length > 2_000_000) throw new Error('Feed too large')
    const parsed = await parser.parseString(xml)
    const isAtom = /<(?:[\w.-]+:)?feed(?:\s|>)/i.test(xml)
    return (parsed.items || []).slice(0, 100).map((item) => {
      // rss-parser otherwise substitutes Atom updated for a missing published date.
      if (isAtom) item = { ...item, pubDate: item.published, isoDate: undefined }
      return normalizeArticle(item, feed, now())
    }).filter(Boolean)
  }

  async function update() {
    const results = await Promise.allSettled(feeds.map(fetchFeed))
    const successful = results.filter((result) => result.status === 'fulfilled')
    const failures = results.length - successful.length
    results.forEach((result, index) => {
      if (result.status === 'rejected') console.warn(`News feed unavailable: ${feeds[index].name}`)
    })
    if (!successful.length) {
      nextAttempt = now() + FAILURE_COOLDOWN_MS
      if (cache) { cache.stale = true; return }
      throw Object.assign(new Error('News sources are temporarily unavailable. Please try again shortly.'), { status: 503 })
    }
    cache = { articles: successful.flatMap((result) => result.value), fetchedAt: now(), stale: false, partial: failures > 0 }
    nextAttempt = now() + ttl
  }

  return {
    async getNews() {
      if (now() >= nextAttempt) {
        if (!inFlight) inFlight = update().finally(() => { inFlight = null })
        await inFlight
      } else if (inFlight) await inFlight
      if (!cache) throw Object.assign(new Error('News sources are temporarily unavailable. Please try again shortly.'), { status: 503 })
      return { success: true, data: selectArticles(cache.articles, now()), updatedAt: new Date(cache.fetchedAt).toISOString(),
        nextRefreshAt: new Date(nextAttempt).toISOString(), stale: cache.stale, partial: cache.partial }
    },
  }
}
