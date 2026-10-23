import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { UpgradeDialog } from "./upgrade-dialog"

describe("UpgradeDialog", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("opens in place with the monthly price and credit allowance", async () => {
    render(<UpgradeDialog>Upgrade to Pro</UpgradeDialog>)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("£12")).toBeInTheDocument()
    expect(screen.getByText(/300 JobClock AI credits every month/)).toBeInTheDocument()
  })

  it("starts checkout for the chosen cadence and returns to the current page if cancelled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "disabled" }) })
    vi.stubGlobal("fetch", fetchMock)
    render(<UpgradeDialog>Upgrade to Pro</UpgradeDialog>)

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }))
    fireEvent.click(await screen.findByRole("button", { name: /annual/i }))
    expect(screen.getByText("£120")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue to secure checkout" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ cadence: "annual", returnPath: `${window.location.pathname}${window.location.search}` }),
    })))
  })
})
