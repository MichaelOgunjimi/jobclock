import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CvData } from "@/lib/supabase/database.types"
import type { CvReviewFinding } from "@/lib/ai/cv-review-schemas"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("../actions", () => ({
  saveCvData: vi.fn().mockResolvedValue({ success: true }),
  renameCv: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock("@/components/cv/editor/cv-editor-form", () => ({
  CvEditorForm: ({ value, footer }: { value: CvData; footer: React.ReactNode }) => (
    <div>
      <section id="cv-section-skills"><input aria-label="skill" /></section>
      <p data-testid="bullet">{value.experience?.[0].highlights?.[0]}</p>
      {footer}
    </div>
  ),
}))

import { toast } from "sonner"
import { saveCvData } from "../actions"
import { CvEditor } from "./cv-editor"

const cv = {
  experience: [{ company: "Acme", title: "Dev", description: "", highlights: ["Responsible for the website"] }],
  education: [],
  skills: [],
} as CvData

const location = { section: "experience" as const, entryId: "Dev at Acme", bulletIndex: 0 }
const fixable: CvReviewFinding = {
  category: "weak_verb", severity: "high", location,
  message: "Weak opener", suggestion: "Lead with a verb",
  original: "Responsible for the website", rewrite: "Built the website",
}
const skills: CvReviewFinding = {
  category: "skills_section", severity: "low", location: { section: "skills" },
  message: "Too few skills", suggestion: "Add more",
}

const renderEditor = (findings = [fixable, skills]) =>
  render(<CvEditor cvId="cv-1" cvName="My CV" initialData={cv} initialFindings={findings} recheckCredits={2} />)

describe("CvEditor review flow", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows where the user stands and that a re-check uses AI", () => {
    renderEditor()
    expect(screen.getByRole("status")).toHaveTextContent("2 open findings, 1 high")
    expect(screen.getByText(/uses ai · 2 credits/i)).toBeInTheDocument()
  })

  it("applies a fix to the CV and counts the finding as addressed", () => {
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: /apply suggested fix/i }))

    expect(screen.getByTestId("bullet")).toHaveTextContent("Built the website")
    expect(screen.getByRole("status")).toHaveTextContent("1 open finding")
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 addressed")
    expect(screen.queryByText("Weak opener")).toBeNull()
  })

  it("dismisses a finding without calling AI", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: /dismiss too few skills|dismiss skills section finding/i }))
    expect(screen.getByRole("status")).toHaveTextContent("1 open finding")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("saves, re-reviews on request, and reports what was resolved", async () => {
    const fresh: CvReviewFinding = { ...skills, category: "generic_filler", location: { section: "summary" }, message: "Filler in summary" }
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ findings: [skills, fresh] }), { status: 200 }),
    )
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: /apply suggested fix/i }))
    fireEvent.click(screen.getByRole("button", { name: /re-check/i }))

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Last check: 1 resolved, 1 new"))
    expect(saveCvData).toHaveBeenCalledTimes(1)
    expect(vi.mocked(saveCvData).mock.calls[0][1].experience?.[0].highlights).toEqual(["Built the website"])
    expect(fetchMock).toHaveBeenCalledWith("/api/cv/cv-1/review", { method: "POST" })
    expect(screen.getByText("Filler in summary")).toBeInTheDocument()
  })

  it("shows only a count on the first check, with no resolved/new split", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ findings: [skills, skills] }), { status: 200 }),
    )
    renderEditor([])
    fireEvent.click(screen.getByRole("button", { name: /re-check/i }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Last check: 1 finding"))
    expect(screen.getByRole("status")).not.toHaveTextContent("resolved")
  })

  it("merges duplicate findings, edits a bullet in place, and jumps to skills", () => {
    const metric: CvReviewFinding = { ...fixable, category: "missing_metric", rewrite: undefined }
    renderEditor([metric, { ...metric, message: "Second report" }, skills])
    expect(screen.getByRole("status")).toHaveTextContent("2 open findings")

    fireEvent.click(screen.getByRole("button", { name: /edit text for missing metric/i }))
    fireEvent.change(screen.getByRole("textbox", { name: /edit text/i }), { target: { value: "Shipped the website" } })
    fireEvent.click(screen.getByRole("button", { name: /apply edit/i }))
    expect(screen.getByTestId("bullet")).toHaveTextContent("Shipped the website")

    fireEvent.click(screen.getByRole("button", { name: /go to skills/i }))
    expect(screen.getByLabelText("skill")).toHaveFocus()
  })

  it("surfaces a failed re-check and keeps the current findings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Out of credits" }), { status: 402 }),
    )
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: /re-check/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Out of credits"))
    expect(screen.getByRole("status")).toHaveTextContent("2 open findings")
  })
})
