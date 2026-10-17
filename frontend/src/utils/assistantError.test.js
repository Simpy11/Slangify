import { expect, test } from 'vitest'
import { getAssistantError } from './assistantError.js'

test('a quota HTTP status wins over a generic Axios timeout code', () => {
  expect(getAssistantError({ code: 'ECONNABORTED', response: { status: 429 } })).toMatch(/usage limit/)
})

test('a provider quota code is preserved through an upstream gateway', () => {
  expect(getAssistantError({ response: { status: 504, data: { code: 'AI_QUOTA_EXCEEDED' } } })).toMatch(/usage limit/)
})

test('an actual browser deadline is reported as a timeout', () => {
  expect(getAssistantError({ code: 'ETIMEDOUT' })).toMatch(/too long/)
})
