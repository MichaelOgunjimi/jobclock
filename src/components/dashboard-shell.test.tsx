import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DashboardShell } from "./dashboard-shell"

vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <aside>Sidebar</aside>,
}))

vi.mock("@/components/dashboard-topbar", () => ({
  DashboardTopbar: () => <header>Topbar</header>,
}))

vi.mock("@/components/extension-availability-banner", () => ({
  ExtensionAvailabilityBanner: () => <div>Extension promotion</div>,
}))

const userProfile = {
  email: "person@example.com",
  fullName: "Example Person",
  avatarUrl: null,
}

describe("DashboardShell", () => {
  it("shows the extension promotion before setup", () => {
    render(
      <DashboardShell showExtensionBanner userProfile={userProfile}>
        <div>Dashboard content</div>
      </DashboardShell>
    )

    expect(screen.getByText("Extension promotion")).toBeInTheDocument()
  })

  it("hides the extension promotion after setup or use", () => {
    render(
      <DashboardShell showExtensionBanner={false} userProfile={userProfile}>
        <div>Dashboard content</div>
      </DashboardShell>
    )

    expect(screen.queryByText("Extension promotion")).not.toBeInTheDocument()
    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
  })
})
