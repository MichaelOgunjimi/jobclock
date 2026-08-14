import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DashboardTopbar } from "./dashboard-topbar"

const navigationMock = vi.hoisted(() => ({ pathname: "/dashboard" }))
const generationMock = vi.hoisted(() => ({
  getApplicationLabel: vi.fn(),
  getCvLabel: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
}))
vi.mock("@/contexts/generation-jobs-context", () => ({
  useGenerationJobsContext: () => ({
    recentJobs: [],
    unseenJobs: [],
    unseenCount: 0,
    getApplicationLabel: generationMock.getApplicationLabel,
    getCvLabel: generationMock.getCvLabel,
  }),
}))
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }))

const userProfile = { email: "user@example.com", fullName: "Test User", avatarUrl: null }

describe("DashboardTopbar breadcrumbs", () => {
  beforeEach(() => {
    navigationMock.pathname = "/dashboard"
    generationMock.getApplicationLabel.mockReset()
    generationMock.getCvLabel.mockReset()
  })

  it("shows the application role and company instead of its UUID", () => {
    navigationMock.pathname = "/applications/8f71c2d4-9bd7-4a8f-93e7-a8a7db07be13"
    generationMock.getApplicationLabel.mockReturnValue({
      role: "Software Engineer",
      company: "Acme",
    })

    render(<DashboardTopbar onOpenMobileSidebar={vi.fn()} userProfile={userProfile} />)

    expect(screen.getAllByText("Software Engineer at Acme").length).toBeGreaterThan(0)
    expect(screen.queryByText("8f71c2d4-9bd7-4a8f-93e7-a8a7db07be13")).not.toBeInTheDocument()
  })

  it("shows the saved CV name instead of its UUID", () => {
    navigationMock.pathname = "/profile/6ae1eaf7-57cb-437e-a25a-522d668a9e42"
    generationMock.getCvLabel.mockReturnValue("Primary Software CV")

    render(<DashboardTopbar onOpenMobileSidebar={vi.fn()} userProfile={userProfile} />)

    expect(screen.getAllByText("Primary Software CV").length).toBeGreaterThan(0)
    expect(screen.queryByText("6ae1eaf7-57cb-437e-a25a-522d668a9e42")).not.toBeInTheDocument()
  })

  it("shortens the UUID while its record label is loading", () => {
    navigationMock.pathname = "/applications/8f71c2d4-9bd7-4a8f-93e7-a8a7db07be13"
    generationMock.getApplicationLabel.mockReturnValue(null)

    render(<DashboardTopbar onOpenMobileSidebar={vi.fn()} userProfile={userProfile} />)

    expect(screen.getAllByText("8f71c2d4…").length).toBeGreaterThan(0)
  })
})
