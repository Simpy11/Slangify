import { describe, expect, test } from 'vitest'
import { extractSlangQuery } from './voiceQuery.js'

describe('extractSlangQuery', () => {
  test.each([
    ['rizz', 'rizz'],
    ['What does rizz mean?', 'rizz'],
    ['What is rizz?', 'rizz'],
    ['Explain rizz', 'rizz'],
    ['Tell me the meaning of rizz', 'rizz'],
    ['Define no cap.', 'no cap'],
    ['an uncertain conversational query', 'an uncertain conversational query'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(extractSlangQuery(input)).toBe(expected)
  })
})
