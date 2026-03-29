import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"

function renderWithTheme() {
  return render(
    <ThemeProvider initialTheme="light">
      <ThemeToggle />
    </ThemeProvider>
  )
}

describe("ThemeToggle", () => {
  it("persists the selected theme to the document, localStorage, and cookies", async () => {
    renderWithTheme()

    const toggle = await screen.findByRole("button", { name: "Switch to dark mode" })
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark")
    })

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("job-assistant-theme")).toBe("dark")
    expect(document.cookie).toContain("job-assistant-theme=dark")
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument()
  })
})
