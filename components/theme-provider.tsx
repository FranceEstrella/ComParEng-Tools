'use client'

import * as React from 'react'

type Theme = "light" | "dark"

type ThemeProviderProps = React.PropsWithChildren<{
  attribute?: string
  defaultTheme?: Theme
  enableSystem?: boolean
  nonce?: string
}>

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: Theme
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)
const THEME_STORAGE_KEY = "compareng.theme"

export function ThemeProvider({ children, defaultTheme = "light" }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      const nextTheme = stored === "dark" || stored === "light" ? stored : defaultTheme
      setThemeState(nextTheme)
    } catch {
      setThemeState(defaultTheme)
    }
  }, [defaultTheme])

  React.useEffect(() => {
    if (typeof document === "undefined") return

    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage failures and keep the in-memory theme state.
    }
  }, [theme])

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedTheme: theme }),
    [setTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    return {
      theme: "light" as Theme,
      setTheme: () => {},
      resolvedTheme: "light" as Theme,
    }
  }

  return context
}
