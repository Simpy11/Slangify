import { describe, expect, test, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { createNewsService, normalizeArticle, selectArticles } from '../services/newsService.js'

const NOW = Date.parse('2026-10-16T12:00:00Z')
const feed = { name: 'Test publisher', url: 'https://publisher.example/rss', topic: 'Gaming' }
const item = (index = 0, extra = {}) => ({ title: `Gaming fixture ${index}`, link: `https://publisher.example/news/${index}`, pubDate: new Date(NOW - index * 3600000).toUTCString(), content: 'A gaming article summary from a publisher.', ...extra })
const xml = (items = [item()]) => `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Test feed</title><link>https://publisher.example</link><description>Fixtures</description>${items.map((i) => `<item><title>${i.title}</title><link>${i.link.replaceAll('&', '&amp;')}</link><description><![CDATA[${i.content}]]></description><pubDate>${i.pubDate}</pubDate><media:thumbnail url="https://publisher.example/image.jpg" width="700" /></item>`).join('')}</channel></rss>`
const mockFetch = () => vi.fn().mockImplementation(async () => new Response(xml(Array.from({ length: 8 }, (_, index) => item(index)))))

describe('Gen Z Buzz relevance and validity', () => {
  test('uses publisher fields and strips HTML, entities and tracking', () => {
    const article = normalizeArticle(item(0, { title: '<b>Gaming &amp; AI</b>', link: 'https://publisher.example/article?utm_source=rss#section', content: '<p>Publisher &amp; gaming summary</p><script>bad()</script>' }), feed, NOW)
    expect(article.title).toBe('Gaming & AI')
    expect(article.summary).toBe('Publisher & gaming summary')
    expect(article.url).toBe('https://publisher.example/article')
    expect(article.publishedAt).toBe(new Date(NOW).toISOString())
    expect(article.image).toBeNull()
  })
  test.each([
    { pubDate: undefined }, { pubDate: 'not a date' },
    { pubDate: new Date(NOW - 73 * 3600000).toISOString() },
    { pubDate: new Date(NOW + 3600000).toISOString() },
    { link: 'javascript:alert(1)' }, { title: '' }, { content: '' },
  ])('rejects invalid or outdated article %j', (extra) => {
    expect(normalizeArticle(item(0, extra), feed, NOW)).toBeNull()
  })
  test('rejects unrelated and political stories even when they mention AI', () => {
    expect(normalizeArticle(item(0, { title: 'President posts AI photo at White House' }), feed, NOW)).toBeNull()
    expect(normalizeArticle(item(0, { title: 'Local bridge reopens', content: 'Traffic returns to normal' }), { ...feed, topic: 'Technology & AI' }, NOW)).toBeNull()
  })
  test('deduplicates titles and canonical URLs and returns exactly five', () => {
    const articles = Array.from({ length: 8 }, (_, i) => normalizeArticle(item(i), feed, NOW))
    const duplicate = { ...articles[0], url: 'https://other.example/syndication' }
    expect(selectArticles([duplicate, ...articles, articles[1]], NOW)).toHaveLength(5)
    expect(new Set(selectArticles([duplicate, ...articles], NOW).map((a) => a.title)).size).toBe(5)
  })
  test('ranks recent and strongly relevant stories above older stories', () => {
    const articles = [normalizeArticle(item(40), feed, NOW), normalizeArticle(item(1, { title: 'Gen Z viral gaming trend' }), feed, NOW)]
    expect(selectArticles(articles, NOW)[0].title).toBe('Gen Z viral gaming trend')
  })
})

describe('Gen Z Buzz backend cache and endpoint', () => {
  test('GET /api/news parses RSS images and returns five valid articles', async () => {
    const service = createNewsService({ fetchImpl: mockFetch(), now: () => NOW, feeds: [feed] })
    const app = createApp('http://localhost:5173', '', { newsService: service })
    const response = await request(app).get('/api/news')
    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(5)
    expect(response.body.data[0].image).toBe('https://publisher.example/image.jpg')
    expect(response.body.updatedAt).toBe(new Date(NOW).toISOString())
    expect(response.body.data[0]).not.toHaveProperty('relevance')
  })
  test('concurrent calls, refresh parameters and repeated clicks cannot bypass cache', async () => {
    const fetchImpl = mockFetch()
    const service = createNewsService({ fetchImpl, now: () => NOW, feeds: [feed] })
    const app = createApp('http://localhost:5173', '', { newsService: service })
    await Promise.all([request(app).get('/api/news'), request(app).get('/api/news?refresh=true'), request(app).get('/api/news?force=1')])
    await request(app).get('/api/news')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  test('refreshes automatically on the next read after 45 minutes', async () => {
    let clock = NOW
    const fetchImpl = mockFetch()
    const service = createNewsService({ fetchImpl, now: () => clock, feeds: [feed] })
    await service.getNews()
    clock += 44 * 60000
    await service.getNews()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    clock += 2 * 60000
    await service.getNews()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
  test('partial source failure still returns available stories', async () => {
    const fetchImpl = mockFetch().mockRejectedValueOnce(new Error('offline'))
    const service = createNewsService({ fetchImpl, now: () => NOW, feeds: [feed, { ...feed, name: 'Second' }] })
    const result = await service.getNews()
    expect(result.partial).toBe(true)
    expect(result.data).toHaveLength(5)
  })
  test('keeps recent cached articles during outage, but never serves outdated articles', async () => {
    let clock = NOW
    const fetchImpl = mockFetch()
    const service = createNewsService({ fetchImpl, now: () => clock, feeds: [feed] })
    await service.getNews()
    fetchImpl.mockRejectedValue(new Error('offline'))
    clock += 46 * 60000
    expect((await service.getNews()).stale).toBe(true)
    clock += 73 * 3600000
    expect((await service.getNews()).data).toEqual([])
  })
  test('all-source outage is controlled, sanitized and cooled down for 5 minutes', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('private upstream details'))
    const service = createNewsService({ fetchImpl, now: () => NOW, feeds: [feed] })
    const app = createApp('http://localhost:5173', '', { newsService: service })
    for (let i = 0; i < 2; i++) {
      const response = await request(app).get('/api/news')
      expect(response.status).toBe(503)
      expect(response.body.code).toBe('NEWS_UNAVAILABLE')
      expect(response.headers['retry-after']).toBe('300')
      expect(JSON.stringify(response.body)).not.toContain('private')
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  test('returns a genuine empty state without padding with fabricated articles', async () => {
    const service = createNewsService({ fetchImpl: async () => new Response(xml([])), now: () => NOW, feeds: [feed] })
    expect((await service.getNews()).data).toEqual([])
  })
  test('parses Atom original publication, summary and embedded publisher image', async () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry><title>Gaming &amp; AI</title><id>article1</id><link href="https://publisher.example/atom"/><published>2026-10-16T10:00:00Z</published><updated>2026-10-16T11:00:00Z</updated><summary type="html">Gaming summary</summary><content type="html">&lt;img src="https://publisher.example/photo.jpg" /&gt;Gaming summary</content></entry></feed>`
    const service = createNewsService({ fetchImpl: async () => new Response(atom), now: () => NOW, feeds: [feed] })
    const result = await service.getNews()
    expect(result.data[0].publishedAt).toBe('2026-10-16T10:00:00.000Z')
    expect(result.data[0].image).toBe('https://publisher.example/photo.jpg')
  })
})


test('eligible stories are newest first even when an older article has stronger relevance', () => {
  const newest = { ...normalizeArticle(item(0), feed, NOW), relevance: 2 }
  const older = { ...normalizeArticle(item(1), feed, NOW), relevance: 12 }
  expect(selectArticles([older, newest], NOW).map((article) => article.id)).toEqual([newest.id, older.id])
})
