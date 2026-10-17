import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './useTheme.js'

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem('slangify-theme')
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('slangify-theme', theme)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
