import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

window.matchMedia ||= () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
})

window.scrollTo ||= () => {}
