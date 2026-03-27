"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { mounted, resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled
        aria-label="Toggle theme"
      >
        <Moon className="h-4 w-4" />
        <span className="hidden sm:inline">Theme</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </Button>
  )
}
