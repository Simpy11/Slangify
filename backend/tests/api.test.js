import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import Slang from '../models/Slang.js'
import User from '../models/User.js'

const app = createApp('http://localhost:5173', 'http://python.internal:8000')
const validSlang = {
  word: 'rizz',
  meaning: 'Charm or charisma',
  example: 'They have effortless rizz.',
  category: 'Gen Z',
  tags: ['charm'],
}
let mongo
let sequence = 0

async function register(overrides = {}) {
  sequence += 1
  const data = {
    name: 'Test User',
    username: `tester${sequence}`,
    email: `tester${sequence}@example.test`,
    password: 'password123',
    ...overrides,
  }
  const response = await request(app).post('/api/auth/register').send(data)
  return { response, data, token: response.body.token, user: response.body.user }
}

function authenticated(method, path, token) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`)
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-only-secret-that-is-never-used-outside-tests'
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 30000 } })
  await mongoose.connect(mongo.getUri())
}, 30000)

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Slang.deleteMany({})])
})

afterEach(() => vi.unstubAllGlobals())

afterAll(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
})

describe('authentication API', () => {
  test('registers a valid user and returns a usable JWT', async () => {
    const { response, token } = await register()
    expect(response.status).toBe(201)
    expect(response.body.user).not.toHaveProperty('password')

    const me = await authenticated('get', '/api/auth/me', token)
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe(response.body.user.email)
  })

  test.each([
    [{ username: '' }, 400],
    [{ email: 'invalid-email' }, 400],
    [{ password: 'short' }, 400],
  ])('rejects invalid registration input', async (override, status) => {
    const { response } = await register(override)
    expect(response.status).toBe(status)
  })

  test('rejects duplicate email and duplicate username', async () => {
    const first = await register()
    const duplicateEmail = await register({ email: first.data.email })
    const duplicateUsername = await register({ username: first.data.username })
    expect(duplicateEmail.response.status).toBe(409)
    expect(duplicateUsername.response.status).toBe(409)
  })

  test('logs in valid credentials and rejects incorrect, unknown, and missing credentials', async () => {
    const registered = await register()
    const valid = await request(app).post('/api/auth/login').send({ email: registered.data.email, password: registered.data.password })
    const incorrect = await request(app).post('/api/auth/login').send({ email: registered.data.email, password: 'wrong-password' })
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.test', password: 'password123' })
    const missing = await request(app).post('/api/auth/login').send({})
    expect(valid.status).toBe(200)
    expect(valid.body.token).toBeTruthy()
    expect(incorrect.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(missing.status).toBe(400)
  })

  test('rejects missing, invalid, and expired JWTs', async () => {
    const missing = await request(app).get('/api/auth/me')
    const invalid = await authenticated('get', '/api/auth/me', 'not-a-token')
    const jwt = await import('jsonwebtoken')
    const expiredToken = jwt.default.sign({ userId: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET, { expiresIn: -1 })
    const expired = await authenticated('get', '/api/auth/me', expiredToken)
    expect(missing.status).toBe(401)
    expect(invalid.status).toBe(401)
    expect(expired.status).toBe(401)
  })
})

describe('slang CRUD and ownership', () => {
  test('keeps reads public and protects every mutation', async () => {
    const list = await request(app).get('/api/slang')
    const create = await request(app).post('/api/slang').send(validSlang)
    const id = new mongoose.Types.ObjectId()
    const update = await request(app).put(`/api/slang/${id}`).send({ meaning: 'Changed' })
    const remove = await request(app).delete(`/api/slang/${id}`)
    expect(list.status).toBe(200)
    expect(create.status).toBe(401)
    expect(update.status).toBe(401)
    expect(remove.status).toBe(401)
  })

  test('creates slang for the authenticated owner and ignores forged ownership', async () => {
    const owner = await register()
    const forgedId = new mongoose.Types.ObjectId().toString()
    const response = await authenticated('post', '/api/slang', owner.token).send({ ...validSlang, createdBy: forgedId })
    expect(response.status).toBe(201)
    expect(response.body.data.createdBy).toBe(owner.user._id)
  })

  test.each([
    [{ ...validSlang, word: '   ' }, 400],
    [{ ...validSlang, meaning: '' }, 400],
    [{ ...validSlang, category: 'Not real' }, 400],
  ])('rejects invalid slang creation', async (payload, status) => {
    const owner = await register()
    const response = await authenticated('post', '/api/slang', owner.token).send(payload)
    expect(response.status).toBe(status)
  })

  test('handles duplicate slang according to the unique-word rule', async () => {
    const owner = await register()
    expect((await authenticated('post', '/api/slang', owner.token).send(validSlang)).status).toBe(201)
    expect((await authenticated('post', '/api/slang', owner.token).send(validSlang)).status).toBe(409)
  })

  test('gets a slang entry by ID and distinguishes invalid and missing IDs', async () => {
    const slang = await Slang.create(validSlang)
    expect((await request(app).get(`/api/slang/${slang._id}`)).status).toBe(200)
    expect((await request(app).get('/api/slang/not-an-id')).status).toBe(400)
    expect((await request(app).get(`/api/slang/${new mongoose.Types.ObjectId()}`)).status).toBe(404)
  })

  test('allows only the owner to update and delete', async () => {
    const owner = await register()
    const stranger = await register()
    const created = await authenticated('post', '/api/slang', owner.token).send(validSlang)
    const id = created.body.data._id
    expect((await authenticated('put', `/api/slang/${id}`, stranger.token).send({ meaning: 'Stolen' })).status).toBe(403)
    expect((await authenticated('delete', `/api/slang/${id}`, stranger.token)).status).toBe(403)
    const updated = await authenticated('put', `/api/slang/${id}`, owner.token).send({ meaning: 'Updated meaning', createdBy: stranger.user._id })
    expect(updated.status).toBe(200)
    expect(updated.body.data.meaning).toBe('Updated meaning')
    expect(updated.body.data.createdBy).toBe(owner.user._id)
    expect((await authenticated('delete', `/api/slang/${id}`, owner.token)).status).toBe(200)
  })

  test('handles invalid and nonexistent update/delete IDs', async () => {
    const owner = await register()
    expect((await authenticated('put', '/api/slang/bad-id', owner.token).send({ meaning: 'x' })).status).toBe(400)
    expect((await authenticated('delete', '/api/slang/bad-id', owner.token)).status).toBe(400)
    const missing = new mongoose.Types.ObjectId()
    expect((await authenticated('put', `/api/slang/${missing}`, owner.token).send({ meaning: 'x' })).status).toBe(404)
    expect((await authenticated('delete', `/api/slang/${missing}`, owner.token)).status).toBe(404)
  })
})

describe('favorites API', () => {
  test('protects get, add, and remove operations', async () => {
    const id = new mongoose.Types.ObjectId()
    expect((await request(app).get('/api/favorites')).status).toBe(401)
    expect((await request(app).post(`/api/favorites/${id}`)).status).toBe(401)
    expect((await request(app).delete(`/api/favorites/${id}`)).status).toBe(401)
  })

  test('persists, deduplicates, isolates, and removes favorites', async () => {
    const userA = await register()
    const userB = await register()
    const slang = await Slang.create(validSlang)
    expect((await authenticated('post', `/api/favorites/${slang._id}`, userA.token)).status).toBe(200)
    expect((await authenticated('post', `/api/favorites/${slang._id}`, userA.token)).status).toBe(200)
    const favoritesA = await authenticated('get', '/api/favorites', userA.token)
    const favoritesB = await authenticated('get', '/api/favorites', userB.token)
    expect(favoritesA.body.data).toHaveLength(1)
    expect(favoritesA.body.data[0].word).toBe('rizz')
    expect(favoritesB.body.data).toHaveLength(0)
    expect((await authenticated('delete', `/api/favorites/${slang._id}`, userA.token)).status).toBe(200)
    expect((await authenticated('get', '/api/favorites', userA.token)).body.data).toHaveLength(0)
  })

  test('handles invalid and nonexistent slang IDs', async () => {
    const user = await register()
    expect((await authenticated('post', '/api/favorites/bad-id', user.token)).status).toBe(400)
    expect((await authenticated('post', `/api/favorites/${new mongoose.Types.ObjectId()}`, user.token)).status).toBe(404)
    expect((await authenticated('delete', `/api/favorites/${new mongoose.Types.ObjectId()}`, user.token)).status).toBe(404)
  })

  test('does not crash when a favorited slang document has been deleted', async () => {
    const user = await register()
    const slang = await Slang.create(validSlang)
    await authenticated('post', `/api/favorites/${slang._id}`, user.token)
    await Slang.deleteOne({ _id: slang._id })
    const response = await authenticated('get', '/api/favorites', user.token)
    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(0)
  })
})

describe('search, filters, sorting, and pagination', () => {
  beforeEach(async () => {
    await Slang.insertMany([
      { word: 'alpha', meaning: 'First term', example: 'Alpha example', category: 'Gaming', popularity: 2 },
      { word: 'delulu', meaning: 'Playfully delusional', example: 'Delulu example', category: 'Social Media', popularity: 9, isTrending: true, tags: ['dream'] },
      { word: 'drip', meaning: 'Stylish clothing', example: 'Drip example', category: 'Lifestyle', popularity: 5 },
      { word: 'rizz', meaning: 'Charm or charisma', example: 'Rizz example', category: 'Gen Z', popularity: 12, isTrending: true },
      { word: 'ratio', meaning: 'A reply gets more engagement', example: 'Ratio example', category: 'Social Media', popularity: 7 },
    ])
  })

  test.each(['rizz', 'riz', 'RIZZ', '  RiZz  '])('supports exact, partial, and case-insensitive word search: %s', async (search) => {
    const response = await request(app).get('/api/slang').query({ search })
    expect(response.status).toBe(200)
    expect(response.body.data.some((item) => item.word === 'rizz')).toBe(true)
  })

  test.each([
    ['a', ['alpha', 'ratio']],
    ['delulu', ['delulu']],
    ['DELULU', ['delulu']],
    ['charisma', []],
    ['dream', []],
    ['', ['alpha', 'delulu', 'drip', 'ratio', 'rizz']],
    ['   ', ['alpha', 'delulu', 'drip', 'ratio', 'rizz']],
  ])('matches only words for search %j', async (search, words) => {
    const response = await request(app).get('/api/slang').query({ search, sort: 'alphabetical' })
    expect(response.status).toBe(200)
    expect(response.body.data.map((item) => item.word)).toEqual(words)
    expect(response.body.total).toBe(words.length)
  })

  test('ANDs word search with letter, category and trending and paginates matching results', async () => {
    const matching = await request(app).get('/api/slang').query({ search: 'IZZ', letter: 'R', category: 'Gen Z', trending: true, sort: 'alphabetical' })
    expect(matching.body.data.map((item) => item.word)).toEqual(['rizz'])
    for (const filters of [{ letter: 'D' }, { category: 'Gaming' }, { trending: false }]) {
      const response = await request(app).get('/api/slang').query({ search: 'rizz', ...filters })
      expect(response.body.data).toEqual([])
      expect(response.body.total).toBe(0)
    }
    const response = await request(app).get('/api/slang').query({ search: 'a', sort: 'alphabetical', page: 2, limit: 1 })
    expect(response.body.data.map((item) => item.word)).toEqual(['ratio'])
    expect(response.body.total).toBe(2)
    expect(response.body.pages).toBe(2)
  })

  test('returns empty unknown searches and safely escapes regex characters', async () => {
    const unknown = await request(app).get('/api/slang').query({ search: 'unknown-value' })
    const regex = await request(app).get('/api/slang').query({ search: '.*' })
    expect(unknown.body.data).toHaveLength(0)
    expect(regex.status).toBe(200)
    expect(regex.body.data).toHaveLength(0)
  })

  test.each([
    ['A', ['alpha']],
    ['D', ['delulu', 'drip']],
    ['R', ['rizz', 'ratio']],
    ['Z', []],
  ])('filters letter %s', async (letter, words) => {
    const response = await request(app).get('/api/slang').query({ letter, sort: 'alphabetical' })
    expect(response.body.data.map((item) => item.word)).toEqual(words.sort())
  })

  test('validates categories and supports no-result categories', async () => {
    const valid = await request(app).get('/api/slang').query({ category: 'Gaming' })
    const empty = await request(app).get('/api/slang').query({ category: 'Meme' })
    const invalid = await request(app).get('/api/slang').query({ category: 'Unknown' })
    expect(valid.body.data.map((item) => item.word)).toEqual(['alpha'])
    expect(empty.body.data).toHaveLength(0)
    expect(invalid.status).toBe(400)
  })

  test('supports every UI sort mode', async () => {
    const popular = await request(app).get('/api/slang').query({ sort: 'popular' })
    const alphabetical = await request(app).get('/api/slang').query({ sort: 'alphabetical' })
    const newest = await request(app).get('/api/slang').query({ sort: 'newest' })
    expect(popular.body.data[0].word).toBe('rizz')
    expect(alphabetical.body.data.map((item) => item.word)).toEqual(['alpha', 'delulu', 'drip', 'ratio', 'rizz'])
    expect(newest.status).toBe(200)
    expect((await request(app).get('/api/slang').query({ sort: 'invalid' })).status).toBe(400)
  })

  test('paginates, validates page values, and caps limit at 50', async () => {
    const first = await request(app).get('/api/slang').query({ page: 1, limit: 2 })
    const second = await request(app).get('/api/slang').query({ page: 2, limit: 2 })
    const capped = await request(app).get('/api/slang').query({ limit: 500 })
    expect(first.body.data).toHaveLength(2)
    expect(first.body.pages).toBe(3)
    expect(second.body.page).toBe(2)
    expect(capped.body.data).toHaveLength(5)
    expect((await request(app).get('/api/slang').query({ page: 0 })).status).toBe(400)
    expect((await request(app).get('/api/slang').query({ page: 'abc' })).status).toBe(400)
  })

  test('combines search/category and letter/category and sort/pagination', async () => {
    const searchCategory = await request(app).get('/api/slang').query({ search: 'delu', category: 'Social Media' })
    const letterCategory = await request(app).get('/api/slang').query({ letter: 'R', category: 'Social Media' })
    const sortedPage = await request(app).get('/api/slang').query({ sort: 'alphabetical', page: 2, limit: 2 })
    expect(searchCategory.body.data.map((item) => item.word)).toEqual(['delulu'])
    expect(letterCategory.body.data.map((item) => item.word)).toEqual(['ratio'])
    expect(sortedPage.body.data.map((item) => item.word)).toEqual(['drip', 'ratio'])
  })
})

describe('unified assistant routing', () => {
  beforeEach(async () => {
    await Slang.insertMany([
      { word: 'rizz', meaning: 'Charm or charisma', example: 'Rizz example', category: 'Gen Z' },
      { word: 'cooked', meaning: 'Doomed or in trouble', example: 'I am cooked', category: 'Gen Z' },
      { word: 'no cap', meaning: 'No lie', example: 'No cap', category: 'Gen Z' },
      { word: 'delulu', meaning: 'Playfully delusional', example: 'Delulu example', category: 'Social Media' },
    ])
  })

  test.each(['rizz', 'What does rizz mean?', 'What is delulu?', 'Explain rizz', "I'm cooked", 'I am cooked', 'What does I am cooked mean?', 'no cap', 'What does no cap mean?', 'I\u2019m cooked'])(
    'returns an exact dictionary result without calling AI for %s',
    async (text) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const response = await request(app).post('/api/assistant/query').send({ text })
      expect(response.status).toBe(200)
      expect(response.body.source).toBe('dictionary')
      expect(['rizz', 'delulu', 'cooked', 'no cap']).toContain(response.body.data.word)
      expect(fetchMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    },
  )

  test.each([
    'Bro really left me on read 💀',
    'Bro has no rizz and got cooked 💀',
    'That outfit ate and left no crumbs',
    'Bro has no rizz',
    'Tere Bin Nahi Gujara Hai Sajani Ka Sahara Hai',
    '\u0907\u0938\u0915\u093e \u0915\u094d\u092f\u093e \u092e\u0924\u0932\u092c \u0939\u0948?',
  ])('routes contextual text to one AI request: %s', async (text) => {
    const aiData = {
      success: true,
      source: 'ai',
      original: text,
      translation: 'A clear everyday-English translation.',
      explanation: 'A concise contextual explanation.',
      detectedSlang: [{ term: 'example', meaning: 'A contextual meaning' }],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(aiData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await request(app).post('/api/assistant/query').send({ text })
    expect(response.status).toBe(200)
    expect(response.body.source).toBe('ai')
    expect(response.body.data.translation).toBeTruthy()
    expect(response.body.data.explanation).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  test.each(['Hello', 'hello hello', '\u0928\u092e\u0938\u094d\u0924\u0947', 'namaste'])('greets %s without Gemini or MongoDB', async (text) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await request(app).post('/api/assistant/query').send({ text })
    expect(response.status).toBe(200)
    expect(response.body.source).toBe('assistant')
    expect(response.body.data.message).toMatch(/Hello/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test.each([['AI_NOT_CONFIGURED', 503], ['AI_AUTH_ERROR', 503], ['AI_QUOTA_EXCEEDED', 429], ['AI_MODEL_UNAVAILABLE', 503], ['AI_TIMEOUT', 504], ['AI_INVALID_RESPONSE', 502]])('preserves safe error code %s', async (code, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code, message: 'private-provider-details' }), { status })))
    const response = await request(app).post('/api/assistant/query').send({ text: 'Bro has no rizz' })
    expect(response.status).toBe(status)
    expect(response.body.code).toBe(code)
    expect(response.body.message).not.toContain('private-provider-details')
  })

  test('uses AI as a fallback for an unknown simple term', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, source: 'ai', original: 'unknownterm',
      translation: 'The meaning is uncertain.', explanation: 'This term may require more context.', detectedSlang: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await request(app).post('/api/assistant/query').send({ text: 'unknownterm' })
    expect(response.body.source).toBe('ai')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  test('keeps dictionary answers available when FastAPI is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const dictionary = await request(app).post('/api/assistant/query').send({ text: 'What does rizz mean?' })
    const contextual = await request(app).post('/api/assistant/query').send({ text: 'Bro really left me on read' })
    expect(dictionary.status).toBe(200)
    expect(dictionary.body.source).toBe('dictionary')
    expect(contextual.status).toBe(503)
    expect(contextual.body.code).toBe('AI_SERVICE_UNAVAILABLE')
    vi.unstubAllGlobals()
  })

  test.each([{}, { text: '' }, { text: '   ' }, { text: 'x'.repeat(2001) }])('rejects invalid assistant input', async (payload) => {
    const response = await request(app).post('/api/assistant/query').send(payload)
    expect(response.status).toBe(400)
  })
})
