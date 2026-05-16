import { describe, expect, it } from "vitest"
import {
  buildCoverLetterSystemPrompt,
  buildCoverLetterUserPrompt,
} from "./cover-letter"

const baseParams = {
  title: "Software Engineer",
  company: "Acme",
  description: "We build distributed systems.",
  cvContext: "Junior developer with 1 year experience.",
}

describe("buildCoverLetterUserPrompt", () => {
  it("includes the company research block when companyResearch is provided", () => {
    const prompt = buildCoverLetterUserPrompt({
      ...baseParams,
      companyResearch: "Acme recently launched a logistics API used by 10k merchants.",
    })

    expect(prompt).toContain("### COMPANY RESEARCH")
    expect(prompt).toContain("Acme recently launched a logistics API")
  })

  it("omits the company research block when companyResearch is absent", () => {
    const prompt = buildCoverLetterUserPrompt({
      ...baseParams,
    })

    expect(prompt).not.toContain("### COMPANY RESEARCH")
  })

  it("omits the company research block when companyResearch is an empty string", () => {
    const prompt = buildCoverLetterUserPrompt({
      ...baseParams,
      companyResearch: "   ",
    })

    expect(prompt).not.toContain("### COMPANY RESEARCH")
  })
})

describe("buildCoverLetterSystemPrompt", () => {
  it("includes the evidence-tied rule for company research", () => {
    const prompt = buildCoverLetterSystemPrompt("Tone: professional.")
    expect(prompt).toMatch(/company research/i)
    expect(prompt).toMatch(/(tie|tied|link).+evidence/i)
    expect(prompt).toMatch(/never.+standalone|standalone.+never/i)
  })
})
