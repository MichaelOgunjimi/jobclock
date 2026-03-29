"use client"

import { createContext, useContext, useEffect, useSyncExternalStore } from "react"

type Theme = "light" | "dark"

type ThemeContextValue = {
  mounted: boolean
  resolvedTheme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "job-assistant-theme"

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme() {
  if (typeof window === "undefined") {
    return "light"
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme
  }

  return getSystemTheme()
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.dataset.theme = theme
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: Theme
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const resolvedTheme = useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleThemeChange = () => onStoreChange()

      mediaQuery.addEventListener("change", handleThemeChange)
      window.addEventListener("storage", handleThemeChange)
      window.addEventListener("job-assistant-theme-change", handleThemeChange)

      return () => {
        mediaQuery.removeEventListener("change", handleThemeChange)
        window.removeEventListener("storage", handleThemeChange)
        window.removeEventListener("job-assistant-theme-change", handleThemeChange)
      }
    },
    () => resolveTheme(),
    () => initialTheme
  )

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  function setTheme(theme: Theme) {
    window.localStorage.setItem(STORAGE_KEY, theme)
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`
    applyTheme(theme)
    window.dispatchEvent(new Event("job-assistant-theme-change"))
  }

  return (
    <ThemeContext.Provider value={{ mounted, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
