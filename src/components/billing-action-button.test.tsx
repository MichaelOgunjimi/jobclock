import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BillingActionButton } from "./billing-action-button"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

describe("BillingActionButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    refresh.mockClear()
  })

  it("refreshes the page data after resuming instead of reloading the whole page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resumed: true }) }))
    render(<BillingActionButton action="resume">Resume subscription</BillingActionButton>)

    fireEvent.click(screen.getByRole("button", { name: "Resume subscription" }))

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("button", { name: "Resume subscription" })).toBeEnabled()
  })
})
