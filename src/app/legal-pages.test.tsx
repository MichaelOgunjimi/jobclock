import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page"
import TermsPage, { metadata as termsMetadata } from "./terms/page"
import ContactPage, { metadata as contactMetadata } from "./contact/page"
import CookiePolicyPage, { metadata as cookieMetadata } from "./cookies/page"
import { SUPPORT_EMAIL } from "@/lib/site"

describe("public legal pages", () => {
  it("publishes a general privacy policy with contact and data rights", () => {
    render(<PrivacyPage />)

    expect(screen.getByRole("heading", { level: 1, name: "JobClock privacy policy" })).toBeInTheDocument()
    expect(screen.getByText(/Supabase for authentication/i)).toBeInTheDocument()
    expect(screen.getByText(/UK Information Commissioner/i)).toBeInTheDocument()
    expect(screen.getAllByText(SUPPORT_EMAIL).length).toBeGreaterThan(0)
    expect(privacyMetadata.alternates).toMatchObject({ canonical: "/privacy" })
  })

  it("publishes terms covering user content and provider keys", () => {
    render(<TermsPage />)

    expect(screen.getByRole("heading", { level: 1, name: "JobClock terms of service" })).toBeInTheDocument()
    expect(screen.getByText(/You retain ownership/i)).toBeInTheDocument()
    expect(screen.getByText(/laws of England and Wales/i)).toBeInTheDocument()
    expect(termsMetadata.alternates).toMatchObject({ canonical: "/terms" })
  })

  it("publishes the actual cookie and local-storage usage", () => {
    render(<CookiePolicyPage />)

    expect(screen.getByRole("heading", { level: 1, name: "JobClock cookie policy" })).toBeInTheDocument()
    expect(screen.getByText(/job-assistant-theme/)).toBeInTheDocument()
    expect(screen.getByText(/does not use cookies/i)).toBeInTheDocument()
    expect(cookieMetadata.alternates).toMatchObject({ canonical: "/cookies" })
  })

  it("publishes a static contact page with the support address, response time and policy links", () => {
    render(<ContactPage />)

    expect(screen.getByRole("heading", { level: 1, name: "Contact JobClock" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: SUPPORT_EMAIL })[0]).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`)
    expect(screen.getByText(/within 2 working days/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "terms of service" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy")
    expect(contactMetadata.alternates).toMatchObject({ canonical: "/contact" })
  })
})
