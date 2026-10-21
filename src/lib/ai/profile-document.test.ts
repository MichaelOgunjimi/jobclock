import { describe, expect, it } from "vitest"
import { parseProfileDocumentExtraction } from "./profile-document"

describe("parseProfileDocumentExtraction", () => {
  it("accepts fenced JSON and validates extracted evidence", () => {
    const result = parseProfileDocumentExtraction(`\`\`\`json
      {
        "name": "MSc transcript",
        "issuer": "Example University",
        "issuedAt": null,
        "expiresAt": null,
        "credentialId": null,
        "credentialUrl": null,
        "facts": [
          {
            "category": "education",
            "label": "MSc Artificial Intelligence",
            "detail": "Awarded with Distinction by Example University."
          }
        ]
      }
    \`\`\``)

    expect(result.facts[0]).toEqual({
      category: "education",
      label: "MSc Artificial Intelligence",
      detail: "Awarded with Distinction by Example University.",
    })
  })

  it("rejects unsupported fact categories", () => {
    expect(() =>
      parseProfileDocumentExtraction(
        JSON.stringify({
          name: "Certificate",
          facts: [{ category: "personality", label: "Great", detail: "Great" }],
        }),
      ),
    ).toThrow("Document extraction returned invalid data")
  })
})
