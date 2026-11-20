import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CvReviewFindings } from "@/components/cv/cv-review-findings"
import { parseReviewFindings } from "@/lib/ai/cv-review-schemas"

const highFinding = {
  category: "ats_hazard",
  severity: "high",
  location: { section: "experience", entryId: "e1", bulletIndex: 2 },
  message: "Uses a table that ATS parsers cannot read.",
  suggestion: "Replace the table with plain bulleted lines.",
}

const lowFinding = {
  category: "weak_verb",
  severity: "low",
  location: { section: "summary" },
  message: "Opens with a weak verb.",
  suggestion: "Lead with a strong action verb.",
}

describe("parseReviewFindings", () => {
  it("returns [] for null/undefined", () => {
    expect(parseReviewFindings(null)).toEqual([])
    expect(parseReviewFindings(undefined)).toEqual([])
  })

  it("accepts a bare array and a { findings } wrapper", () => {
    expect(parseReviewFindings([highFinding])).toHaveLength(1)
    expect(parseReviewFindings({ findings: [highFinding] })).toHaveLength(1)
  })

  it("drops structurally invalid entries", () => {
    const raw = { findings: [highFinding, { category: "weak_verb" }, "nope"] }
    expect(parseReviewFindings(raw)).toHaveLength(1)
  })
})

describe("CvReviewFindings", () => {
  it("shows a clean state when there are no findings", () => {
    render(<CvReviewFindings findings={[]} />)
    expect(screen.getByText(/no content issues found/i)).toBeInTheDocument()
  })

  it("groups findings by severity with counts and renders message + suggestion", () => {
    render(
      <CvReviewFindings
        findings={parseReviewFindings({ findings: [lowFinding, highFinding] })}
      />,
    )

    expect(screen.getByText(/uses a table that ats parsers cannot read/i)).toBeInTheDocument()
    expect(screen.getByText(/replace the table with plain bulleted lines/i)).toBeInTheDocument()
    expect(screen.getByText(/lead with a strong action verb/i)).toBeInTheDocument()

    const high = screen.getByText(/^high$/i).closest("section")
    const low = screen.getByText(/^low$/i).closest("section")
    expect(high).not.toBeNull()
    expect(low).not.toBeNull()
    // High group precedes the low group in document order.
    expect(high!.compareDocumentPosition(low!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe("CvReviewFindings actions", () => {
  const fixable = parseReviewFindings([
    {
      ...lowFinding,
      location: { section: "experience", entryId: "Dev at Acme", bulletIndex: 0 },
      original: "Responsible for the website",
      rewrite: "Built the website",
    },
  ])

  it("applies the suggested rewrite in one click", () => {
    const onApply = vi.fn()
    render(<CvReviewFindings findings={fixable} onApply={onApply} onDismiss={vi.fn()} />)

    expect(screen.getByText(/responsible for the website/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /apply suggested fix/i }))
    expect(onApply).toHaveBeenCalledWith(fixable[0], "Built the website")
  })

  it("lets the user edit the rewrite before applying it", () => {
    const onApply = vi.fn()
    render(<CvReviewFindings findings={fixable} onApply={onApply} />)

    fireEvent.click(screen.getByRole("button", { name: /edit first/i }))
    const box = screen.getByRole("textbox", { name: /edit suggested rewrite/i })
    fireEvent.change(box, { target: { value: "Rebuilt the website" } })
    fireEvent.click(screen.getByRole("button", { name: /apply edited/i }))
    expect(onApply).toHaveBeenCalledWith(fixable[0], "Rebuilt the website")
  })

  it("dismisses a finding, and offers no apply button without a rewrite", () => {
    const onDismiss = vi.fn()
    const plain = parseReviewFindings([lowFinding])
    render(<CvReviewFindings findings={plain} onApply={vi.fn()} onDismiss={onDismiss} />)

    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledWith(plain[0])
  })
})

describe("CvReviewFindings editing without a rewrite", () => {
  const metric = parseReviewFindings([
    {
      category: "missing_metric",
      severity: "medium",
      location: { section: "projects", entryId: "Tracker", bulletIndex: 2 },
      message: "No result",
      suggestion: "Say what changed",
      original: "Worked on a tracker",
    },
  ])

  it("shows the current text and lets the user edit and apply it", () => {
    const onApply = vi.fn()
    render(<CvReviewFindings findings={metric} onApply={onApply} onDismiss={vi.fn()} />)

    expect(screen.getByText(/worked on a tracker/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /edit text for missing metric/i }))
    const box = screen.getByRole("textbox", { name: /edit text for missing metric/i })
    expect(box).toHaveValue("Worked on a tracker")
    expect(screen.getByRole("button", { name: /apply edit/i })).toBeDisabled()
    fireEvent.change(box, { target: { value: "Built a tracker my team used daily" } })
    fireEvent.click(screen.getByRole("button", { name: /apply edit/i }))
    expect(onApply).toHaveBeenCalledWith(metric[0], "Built a tracker my team used daily")
  })

  it("cancels without applying", () => {
    const onApply = vi.fn()
    render(<CvReviewFindings findings={metric} onApply={onApply} />)
    fireEvent.click(screen.getByRole("button", { name: /edit text/i }))
    fireEvent.click(screen.getByRole("button", { name: /cancel editing/i }))
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(onApply).not.toHaveBeenCalled()
  })

  it("offers a jump to the skills field with the current count", () => {
    const onJump = vi.fn()
    const skills = parseReviewFindings([
      { ...lowFinding, category: "skills_section", location: { section: "skills" }, message: "Too many skills" },
    ])
    render(<CvReviewFindings findings={skills} onJump={onJump} skillsCount={31} />)

    expect(screen.getByText(/31 skills listed/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /go to skills/i }))
    expect(onJump).toHaveBeenCalledWith(skills[0])
  })
})
