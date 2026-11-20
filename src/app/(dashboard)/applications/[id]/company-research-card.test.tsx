import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { refresh, trackJob, getActiveJob } = vi.hoisted(() => ({
  refresh: vi.fn(),
  trackJob: vi.fn(),
  getActiveJob: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
vi.mock("@/contexts/generation-jobs-context", () => ({
  useGenerationJobsContext: () => ({ getActiveJob, trackJob }),
}))

import { CompanyResearchCard } from "./company-research-card"

describe("CompanyResearchCard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    refresh.mockReset()
    trackJob.mockReset()
    getActiveJob.mockReset()
  })

  it("offers generation when there is no research and tracks the started job", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jobId: "job-1", deduped: false }), { status: 202 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    render(<CompanyResearchCard applicationId="app-1" content={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Generate company research" }))

    await waitFor(() => expect(trackJob).toHaveBeenCalledWith({ id: "job-1", applicationId: "app-1", kind: "company_research" }))
    expect(fetchMock).toHaveBeenCalledWith("/api/applications/app-1/company-research", { method: "POST" })
  })

  it("shows the limit error from a 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests. Please wait a moment before trying again." }), { status: 429 }),
    ))
    render(<CompanyResearchCard applicationId="app-1" content={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Generate company research" }))

    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument()
    expect(trackJob).not.toHaveBeenCalled()
  })

  it("shows progress instead of the button while a job runs", () => {
    getActiveJob.mockReturnValue({ id: "job-1", created_at: new Date().toISOString() })
    render(<CompanyResearchCard applicationId="app-1" content={null} />)

    expect(screen.getByText(/Generating company research/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Generate company research/ })).not.toBeInTheDocument()
  })

  it("renders markdown content with a regenerate option and expands", () => {
    render(<CompanyResearchCard applicationId="app-1" content={"## 1. AI / Product Strategy\n- Builds widgets"} />)

    expect(screen.getByRole("heading", { name: "1. AI / Product Strategy" })).toBeInTheDocument()
    expect(screen.getByText("Builds widgets")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Regenerate research" })).toBeInTheDocument()
    const toggle = screen.getByRole("button", { name: "Show full research" })
    fireEvent.click(toggle)
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true")
  })

  it("refreshes server data when the active job finishes", () => {
    getActiveJob.mockReturnValue({ id: "job-1", created_at: new Date().toISOString() })
    const { rerender } = render(<CompanyResearchCard applicationId="app-1" content={null} />)
    expect(refresh).not.toHaveBeenCalled()

    getActiveJob.mockReturnValue(undefined)
    rerender(<CompanyResearchCard applicationId="app-1" content="## Done" />)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
