import { describe, expect, it } from "vitest"
import {
  extractedProfileDocumentSchema,
  matchesProfileDocumentSignature,
  profileDocumentTypeSchema,
} from "./profile-documents"

describe("profile document validation", () => {
  it("accepts supported document types", () => {
    expect(profileDocumentTypeSchema.parse("transcript")).toBe("transcript")
    expect(profileDocumentTypeSchema.safeParse("passport").success).toBe(false)
  })

  it("normalises optional metadata while preserving reviewable facts", () => {
    expect(
      extractedProfileDocumentSchema.parse({
        name: "  AWS Cloud Practitioner  ",
        issuer: " ",
        issuedAt: "2026-10-18",
        facts: [
          {
            category: "certification",
            label: " AWS Cloud Practitioner ",
            detail: " Awarded by AWS. ",
          },
        ],
      }),
    ).toEqual({
      name: "AWS Cloud Practitioner",
      issuer: null,
      issuedAt: "2026-10-18",
      expiresAt: null,
      credentialId: null,
      credentialUrl: null,
      facts: [
        {
          category: "certification",
          label: "AWS Cloud Practitioner",
          detail: "Awarded by AWS.",
        },
      ],
    })
  })

  it("rejects invalid dates and empty evidence", () => {
    expect(
      extractedProfileDocumentSchema.safeParse({
        name: "Transcript",
        issuedAt: "October 2026",
        facts: [],
      }).success,
    ).toBe(false)
  })

  it("checks the uploaded bytes instead of trusting the browser MIME type", () => {
    expect(
      matchesProfileDocumentSignature(new TextEncoder().encode("%PDF-1.7"), "application/pdf"),
    ).toBe(true)
    expect(
      matchesProfileDocumentSignature(new TextEncoder().encode("not a pdf"), "application/pdf"),
    ).toBe(false)
  })
})
