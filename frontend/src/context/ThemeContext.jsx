import { createContext, useState, useEffect, useCallback } from 'react'

export const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const migrationKey = 'sf-theme-v'
    const currentVersion = '2' // bump this to force-reset all users to dark
    if (localStorage.getItem(migrationKey) !== currentVersion) {
      localStorage.setItem(migrationKey, currentVersion)
      localStorage.setItem('sf-theme', 'dark')
      return 'dark'
    }
    const stored = localStorage.getItem('sf-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
    }
    localStorage.setItem('sf-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
