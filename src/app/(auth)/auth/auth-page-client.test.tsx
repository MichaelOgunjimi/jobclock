import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true, SUPABASE_SETUP_MESSAGE: "setup" }))
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }))

import { AuthPageClient } from "./auth-page-client"

const reply = (data: object) => ({ json: async () => data })

async function reachCodeStep() {
  render(<AuthPageClient />)
  fireEvent.click(screen.getByRole("button", { name: "Create account" }))
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } })
  fireEvent.click(screen.getByRole("button", { name: /Create Account/ }))
  await screen.findByLabelText("Confirmation code")
}

describe("signup code step", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValueOnce(reply({ ok: true, needsCode: true, message: "Enter the 6-digit code we sent to your email." }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows a numeric one-time-code input after signup and keeps only pasted digits", async () => {
    await reachCodeStep()
    const input = screen.getByLabelText("Confirmation code") as HTMLInputElement

    expect(input).toHaveAttribute("inputmode", "numeric")
    expect(input).toHaveAttribute("autocomplete", "one-time-code")
    fireEvent.change(input, { target: { value: "123 456 789" } })
    expect(input.value).toBe("123456")
  })

  it("posts the code to /auth/verify-code and follows the redirect", async () => {
    await reachCodeStep()
    fetchMock.mockResolvedValueOnce(reply({ ok: true, redirect: "/dashboard" }))
    fireEvent.change(screen.getByLabelText("Confirmation code"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: /Confirm Email/ }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe("/auth/verify-code")
    expect((init.body as FormData).get("code")).toBe("123456")
  })

  it("shows the wrong-code error and stays on the step", async () => {
    await reachCodeStep()
    fetchMock.mockResolvedValueOnce(reply({ ok: false, message: "That code is wrong or has expired." }))
    fireEvent.change(screen.getByLabelText("Confirmation code"), { target: { value: "000000" } })
    fireEvent.click(screen.getByRole("button", { name: /Confirm Email/ }))

    expect(await screen.findByText(/wrong or has expired/)).toBeInTheDocument()
    expect(screen.getByLabelText("Confirmation code")).toBeInTheDocument()
  })

  it("disables resend for 60 seconds, then sends a new code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await reachCodeStep()
    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled()

    // The countdown re-arms a one-second timer after each render, so step it second by second.
    for (let second = 0; second < 60; second++) await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const resend = screen.getByRole("button", { name: "Resend code" })
    expect(resend).toBeEnabled()

    fetchMock.mockResolvedValueOnce(reply({ ok: true, message: "sent" }))
    fireEvent.click(resend)
    await waitFor(() => expect((fetchMock.mock.calls[1][1].body as FormData).get("intent")).toBe("resend_code"))
    expect(await screen.findByRole("button", { name: "Resend code in 60s" })).toBeDisabled()
  })
})
