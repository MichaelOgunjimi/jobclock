import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DashboardShell } from "./dashboard-shell"

vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <aside>Sidebar</aside>,
}))

vi.mock("@/components/dashboard-topbar", () => ({
  DashboardTopbar: () => <header>Topbar</header>,
}))

const userProfile = {
  email: "person@example.com",
  fullName: "Example Person",
  avatarUrl: null,
}

describe("DashboardShell", () => {
  it("renders streamed banners before the dashboard content", () => {
    render(
      <DashboardShell
        banners={<div>Account notice</div>}
        userProfile={userProfile}
      >
        <div>Dashboard content</div>
      </DashboardShell>
    )

    expect(screen.getByText("Account notice")).toBeInTheDocument()
    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
  })

  it("renders dashboard content without a banner", () => {
    render(
      <DashboardShell userProfile={userProfile}>
        <div>Dashboard content</div>
      </DashboardShell>
    )

    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
  })
})
