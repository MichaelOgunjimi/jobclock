import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ExtensionPrivacyPage, {
  metadata as privacyMetadata,
} from "./privacy/page"
import ExtensionSupportPage, {
  metadata as supportMetadata,
} from "./support/page"

describe("public extension pages", () => {
  it("explains extension data access, storage, transfer, and user control", () => {
    render(<ExtensionPrivacyPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "JobClock extension privacy",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/only when you open the extension/i)
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/active page URL and title/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(/stored locally in Chrome/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /sent over HTTPS only to jobclock\.michaelogunjimi\.com/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/user-configured AI provider/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/only after you select Save to JobClock/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/not sold or used for advertising/i)
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Revoke Token/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/delete saved applications/i)).toBeInTheDocument()
  })

  it("documents the permissions used by the extension", () => {
    render(<ExtensionPrivacyPage />)

    expect(screen.getByText("activeTab")).toBeInTheDocument()
    expect(screen.getByText("scripting")).toBeInTheDocument()
    expect(screen.getByText("storage")).toBeInTheDocument()
    expect(
      screen.getByText(/access to jobclock\.michaelogunjimi\.com/i)
    ).toBeInTheDocument()
  })

  it("documents setup, supported pages, same-URL restoration, and recovery", () => {
    render(<ExtensionSupportPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "JobClock extension support",
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/Generate Token/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Connect JobClock/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/LinkedIn/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/same tab and exact URL/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Re-extract/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Try again/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Recent applications/i).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/Revoke Token/i).length).toBeGreaterThan(0)
  })

  it("provides public navigation, privacy, and contact routes", () => {
    render(<ExtensionSupportPage />)

    expect(screen.getByTestId("extension-logo-light")).toHaveAttribute(
      "src",
      expect.stringContaining("logo-mark-light-white.svg")
    )
    expect(screen.getByTestId("extension-logo-dark")).toHaveAttribute(
      "src",
      expect.stringContaining("logo-mark-light.svg")
    )
    expect(screen.getByRole("link", { name: /JobClock home/i })).toHaveAttribute(
      "href",
      "/"
    )
    expect(
      screen.getByRole("link", { name: /Open JobClock/i })
    ).toHaveAttribute("href", "/auth")
    expect(screen.getByRole("link", { name: /^Privacy$/i })).toHaveAttribute(
      "href",
      "/extension/privacy"
    )
    expect(screen.getByRole("link", { name: /^Support$/i })).toHaveAttribute(
      "href",
      "/extension/support"
    )
    expect(
      screen.getByRole("link", { name: /email JobClock support/i })
    ).toHaveAttribute("href", "mailto:michael_ogunjimi@yahoo.com")
  })

  it("exports descriptive static metadata", () => {
    expect(privacyMetadata).toMatchObject({
      title: "Extension Privacy",
      description:
        "How the JobClock Chrome extension accesses, uses, stores, and transfers data.",
    })
    expect(supportMetadata).toMatchObject({
      title: "Extension Support",
      description:
        "Set up the JobClock Chrome extension and resolve connection, extraction, and saving issues.",
    })
  })
})
