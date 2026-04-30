import { describe, expect, it } from "vitest"
import {
  buildFallbackPreview,
  chooseDescription,
  deriveTitleAndCompanyFromPageTitle,
  isSubstantialDescription,
  parseSalaryText,
} from "./import-job"

describe("isSubstantialDescription", () => {
  it("treats long-form page descriptions as substantial", () => {
    expect(
      isSubstantialDescription(
        "We are hiring a software engineer to build internal systems and trading workflows across logistics, billing, and operations. You will work with the founder, CTO, and trading team to ship production code, maintain systems, and improve the reliability of the platform across a wide range of business processes and operational constraints."
      )
    ).toBe(true)
  })

  it("treats short meta-style blurbs as non-substantial", () => {
    expect(isSubstantialDescription("Join our team and help build the future of hiring.")).toBe(false)
  })
})

describe("chooseDescription", () => {
  it("prefers the raw page description when it is substantial", () => {
    const hintedDescription =
      "About the job We are hiring a software engineer to work across logistics, billing, internal tools, and trading systems. You will partner closely with the founder, CTO, and trading team to build production systems, automate operations, and support the movement of goods across the supply chain. Requirements include production experience, strong Postgres and Python fundamentals, comfort with Docker, Linux, and Bash, and an interest in fast-moving technical work."

    expect(chooseDescription("Short AI summary.", hintedDescription)).toBe(hintedDescription)
  })

  it("falls back to the AI description when the page hint is only a short blurb", () => {
    expect(
      chooseDescription(
        "Full parsed description with responsibilities, requirements, and process.",
        "Short company blurb."
      )
    ).toBe("Full parsed description with responsibilities, requirements, and process.")
  })
})

describe("deriveTitleAndCompanyFromPageTitle", () => {
  it("extracts title and company from common board titles", () => {
    expect(
      deriveTitleAndCompanyFromPageTitle("Python Developer (Pricing) - Bright Purple Resourcing - Totaljobs")
    ).toEqual({
      title: "Python Developer (Pricing)",
      company: "Bright Purple Resourcing",
    })
  })
})

describe("buildFallbackPreview", () => {
  it("builds a usable preview from page hints when AI output is unusable", () => {
    expect(
      buildFallbackPreview({
        url: "https://www.totaljobs.com/job/python-developer",
        fallbackSource: "totaljobs.com",
        pageTitle: "Python Developer (Pricing) - Bright Purple Resourcing - Totaljobs",
        hints: {
          title: "Python Developer (Pricing)",
          company: "Bright Purple Resourcing",
          location: "Edinburgh",
          description:
            "A long-form description of the role, responsibilities, and requirements that came from the page itself.",
        },
        pageText: "Easy apply Python Developer (Pricing) Bright Purple Resourcing Edinburgh",
      })
    ).toEqual(
      expect.objectContaining({
        title: "Python Developer (Pricing)",
        company: "Bright Purple Resourcing",
        source: "totaljobs.com",
        isEasyApply: true,
      })
    )
  })
})

describe("parseSalaryText", () => {
  it("normalizes Glassdoor estimated salary ranges", () => {
    expect(parseSalaryText("£30K - £40K (Employer Est.)")).toEqual({
      salaryMin: 30000,
      salaryMax: 40000,
      salaryCurrency: "GBP",
    })
  })
})
