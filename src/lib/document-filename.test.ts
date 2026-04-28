import { describe, expect, it } from "vitest"
import { buildCvFilenameBase, withPdfExtension } from "./document-filename"

describe("document filenames", () => {
  it("builds CV filenames from full name, company, and role", () => {
    expect(
      buildCvFilenameBase({
        fullName: "Michael Adebayo",
        company: "Monzo",
        role: "Frontend Engineer",
      }),
    ).toBe("Michael Adebayo - Monzo - Frontend Engineer - CV")
  })

  it("omits missing CV filename parts", () => {
    expect(buildCvFilenameBase({ fullName: "Michael Adebayo", company: null, role: "" })).toBe(
      "Michael Adebayo - CV",
    )
  })

  it("removes characters that are unsafe in filenames", () => {
    expect(
      buildCvFilenameBase({
        fullName: "Michael/Adebayo",
        company: "Acme: Labs",
        role: "Frontend * Engineer",
      }),
    ).toBe("Michael Adebayo - Acme Labs - Frontend Engineer - CV")
  })

  it("adds a PDF extension once", () => {
    expect(withPdfExtension("Michael Adebayo - Monzo - CV")).toBe("Michael Adebayo - Monzo - CV.pdf")
    expect(withPdfExtension("Michael Adebayo - Monzo - CV.pdf")).toBe("Michael Adebayo - Monzo - CV.pdf")
  })
})
