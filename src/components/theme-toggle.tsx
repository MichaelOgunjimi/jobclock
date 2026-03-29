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
        size="icon-sm"
        disabled
        aria-label="Toggle theme"
      >
        <Moon className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
