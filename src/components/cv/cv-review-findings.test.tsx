import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
