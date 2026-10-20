import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Job } from "@/lib/jobs/types"
import { JobsFeed } from "./jobs-feed"
import { ignoreJob, saveJob } from "./actions"
import { toast } from "sonner"

vi.mock("./actions", () => ({
  ignoreJob: vi.fn(),
  saveJob: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

const job: Job = {
  id: "job-1",
  title: "Principal Frontend Platform Engineer",
  company: "Northstar Infrastructure Partners",
  location: "London and the South East, United Kingdom",
  description: "Build and maintain the frontend platform used by product teams.",
  salaryMin: 70000,
  salaryMax: 90000,
  salaryCurrency: "GBP",
  postedAt: "2026-10-18T09:00:00.000Z",
  url: "https://example.com/jobs/frontend-platform",
  source: "adzuna",
  isEasyApply: false,
}

const defaultProps = {
  initialQuery: "",
  initialLocation: "",
  initialSalary: "",
  initialExperienceLevels: [],
  enabledSources: ["adzuna", "tracked"],
  initialSavedUrls: [],
}

describe("JobsFeed", () => {
  beforeEach(() => {
    vi.mocked(saveJob).mockResolvedValue({ success: true })
    vi.mocked(ignoreJob).mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens mobile filters, searches, and saves a result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [job] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<JobsFeed {...defaultProps} />)

    const filters = screen.getByRole("button", { name: /filters and search/i })
    expect(filters).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(filters)
    expect(filters).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Adzuna" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.change(screen.getByLabelText("Keywords"), {
      target: { value: "software engineer" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Search roles" }))

    expect(filters).toHaveAttribute("aria-expanded", "false")
    expect(await screen.findByText(job.title)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("q=software+engineer"))

    fireEvent.click(screen.getByRole("button", { name: "Save to pipeline" }))

    await waitFor(() => {
      expect(saveJob).toHaveBeenCalledWith(job)
      expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled()
    })
  })

  it("shows a retryable error when the search service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "upstream unavailable" }),
    }))

    render(<JobsFeed {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: "Search roles" }))

    expect(await screen.findByText("Couldn't load roles")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled()
    expect(toast.error).toHaveBeenCalledWith("Failed to fetch jobs")
  })

  it("restores a hidden result when saving that preference fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [job] }),
    }))
    vi.mocked(ignoreJob).mockResolvedValue({ error: "write failed" })

    render(<JobsFeed {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: "Search roles" }))
    expect(await screen.findByText(job.title)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Hide" }))

    await waitFor(() => {
      expect(ignoreJob).toHaveBeenCalledWith(job.url)
      expect(screen.getByText(job.title)).toBeInTheDocument()
      expect(toast.error).toHaveBeenCalledWith("Could not hide this role")
    })
  })
})
