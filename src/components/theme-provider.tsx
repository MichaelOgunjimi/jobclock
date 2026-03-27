"use client"

import { createContext, useContext, useEffect, useState } from "react"

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light"
    return resolveTheme()
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    function handleSystemChange() {
      if (window.localStorage.getItem(STORAGE_KEY)) return
      setResolvedTheme(getSystemTheme())
    }

    const frame = window.requestAnimationFrame(() => setMounted(true))

    mediaQuery.addEventListener("change", handleSystemChange)
    return () => {
      window.cancelAnimationFrame(frame)
      mediaQuery.removeEventListener("change", handleSystemChange)
    }
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  function setTheme(theme: Theme) {
    window.localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    setResolvedTheme(theme)
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
