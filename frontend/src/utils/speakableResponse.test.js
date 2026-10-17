import { describe, expect, test } from 'vitest'
import { getSpeakableText } from './speakableResponse.js'

describe('getSpeakableText', () => {
  test.each([null, {}, { source: 'ai', data: { translation: 42 } }, { source: 'dictionary', data: { word: {}, meaning: 'meaning' } }])(
    'does not speak malformed responses: %j', (result) => expect(getSpeakableText(result)).toBe(''),
  )
  test('uses real dictionary word and meaning without metadata', () => {
    expect(getSpeakableText({ source: 'dictionary', data: { word: 'rizz', meaning: 'charisma', category: 'Gen Z' } })).toBe('rizz means charisma')
  })

  test('includes the AI translation and contextual explanation', () => {
    expect(getSpeakableText({ source: 'ai', data: { translation: 'He did not reply.', explanation: 'Ignored a message.' } })).toBe('He did not reply. Ignored a message.')
  })
})

test('reads a single answer string directly', () => {
  expect(getSpeakableText({ source: 'ai', data: 'Delulu means delusional.' })).toBe('Delulu means delusional.')
})

test('combines the answer fields without reading the original question', () => {
  const speech = getSpeakableText({ source: 'ai', data: {
    original: 'What does rizz mean?',
    explanation: 'It describes confidence when attracting partners.',
    detectedSlang: [{ term: 'rizz', meaning: 'romantic charm or charisma' }],
    example: 'He has great rizz.',
  } })
  expect(speech).toBe('rizz means romantic charm or charisma. It describes confidence when attracting partners. For example, He has great rizz.')
})
