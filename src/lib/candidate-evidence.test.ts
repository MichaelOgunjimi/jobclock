import { describe, expect, it } from "vitest"
import { formatConfirmedProfileEvidence } from "./candidate-evidence"

describe("formatConfirmedProfileEvidence", () => {
  it("formats confirmed facts as bounded, attributable evidence", () => {
    expect(
      formatConfirmedProfileEvidence([
        {
          category: "certification",
          label: "AWS Cloud Practitioner",
          detail: "Issued by AWS in 2026.",
        },
      ]),
    ).toBe("- [certification] AWS Cloud Practitioner: Issued by AWS in 2026.")
  })
})
