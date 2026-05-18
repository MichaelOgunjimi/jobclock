import React from "react"
import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AppSidebar } from "@/components/app-sidebar"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => false,
  SUPABASE_SETUP_MESSAGE: "Supabase is not configured",
}))

describe("AppSidebar hydration", () => {
  it("hydrates without mismatch when persisted state is collapsed", async () => {
    localStorage.setItem("sidebar-collapsed", "true")

    const serverHtml = renderToString(
      <AppSidebar isMobileOpen={false} onMobileOpenChange={() => {}} />
    )

    const container = document.createElement("div")
    container.innerHTML = serverHtml

    const serverDesktopAside = container.querySelectorAll("aside")[1]
    expect(serverDesktopAside?.className).toContain("w-[280px]")

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      hydrateRoot(container, <AppSidebar isMobileOpen={false} onMobileOpenChange={() => {}} />)
    })

    await waitFor(() => {
      const hydratedDesktopAside = container.querySelectorAll("aside")[1]
      expect(hydratedDesktopAside?.className).toContain("w-[88px]")
    })

    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).toLowerCase().includes("hydration")
      )
    ).toBe(false)

    consoleErrorSpy.mockRestore()
  })
})
