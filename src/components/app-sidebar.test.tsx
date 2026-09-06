import React from "react"
import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AppSidebar } from "@/components/app-sidebar"

const userProfile = {
  email: "person@example.com",
  fullName: "Example Person",
  avatarUrl: null,
}

vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...props }: React.ComponentProps<"a">) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
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
      <AppSidebar
        isMobileOpen={false}
        onMobileOpenChange={() => {}}
        userProfile={userProfile}
      />
    )

    const container = document.createElement("div")
    container.innerHTML = serverHtml

    const serverDesktopAside = container.querySelector('aside[aria-label="Primary navigation"]')
    expect(serverDesktopAside?.className).toContain("w-[280px]")

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      hydrateRoot(
        container,
        <AppSidebar
          isMobileOpen={false}
          onMobileOpenChange={() => {}}
          userProfile={userProfile}
        />
      )
    })

    await waitFor(() => {
      const hydratedDesktopAside = container.querySelector('aside[aria-label="Primary navigation"]')
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

describe("AppSidebar mobile navigation", () => {
  it("keeps navigation in one sheet while moving to and from a contextual panel", async () => {
    const onMobileOpenChange = vi.fn()

    render(
      <AppSidebar
        isMobileOpen
        onMobileOpenChange={onMobileOpenChange}
        userProfile={userProfile}
      />
    )

    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    expect(within(sheet).getByText("Example Person")).toBeInTheDocument()
    expect(within(sheet).getByText("person@example.com")).toBeInTheDocument()
    expect(within(sheet).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    fireEvent.click(within(sheet).getByRole("button", { name: "Sign out" }))

    const backButton = within(sheet).getByRole("button", { name: "Back" })
    await waitFor(() => expect(backButton).toHaveFocus())
    expect(screen.getAllByRole("dialog")).toHaveLength(1)

    fireEvent.click(backButton)

    const dashboardLink = within(sheet).getByRole("link", { name: "Dashboard" })
    expect(dashboardLink).toHaveAttribute(
      "aria-current",
      "page"
    )
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Sign out" })).toHaveFocus())
  })

  it("closes the sheet when a destination is selected", async () => {
    const onMobileOpenChange = vi.fn()

    render(
      <AppSidebar
        isMobileOpen
        onMobileOpenChange={onMobileOpenChange}
        userProfile={userProfile}
      />
    )

    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    fireEvent.click(within(sheet).getByRole("link", { name: "Job Search" }))

    expect(onMobileOpenChange).toHaveBeenCalledWith(false)
  })
})
