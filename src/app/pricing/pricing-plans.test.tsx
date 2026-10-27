import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PricingPlans } from "./pricing-plans"

describe("PricingPlans", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns signed-out users to pricing after authentication", () => {
    render(<PricingPlans signedIn={false} isPro={false} monthlyCredits={300} />)

    expect(screen.getByRole("link", { name: "Sign in to upgrade" })).toHaveAttribute("href", "/auth?next=/pricing")
  })

  it("sends only the selected server-owned cadence to checkout", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "disabled" }) })
    vi.stubGlobal("fetch", fetchMock)
    render(<PricingPlans signedIn isPro={false} monthlyCredits={300} />)

    fireEvent.click(screen.getByRole("button", { name: /annual/i }))
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ cadence: "annual" }),
    })))
  })
})
