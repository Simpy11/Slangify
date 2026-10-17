import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../src/theme/useTheme.js'

function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return <button className={`theme-toggle ${className}`.trim()} type="button" onClick={toggleTheme} aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
}

export default ThemeToggle
