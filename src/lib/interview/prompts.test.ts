import { describe, expect, it } from "vitest"
import { buildInterviewAnswerPrompt, INTERVIEW_ANSWER_SYSTEM_PROMPT } from "./prompts"

const question = {
  key: "tell-me-about-yourself",
  text: "Tell me about yourself.",
  category: "opening" as const,
  requiresStory: false,
  evidenceTags: ["summary", "experience"],
}

const evidence = {
  facts: [
    {
      id: "fact-1",
      category: "education",
      label: "MSc Artificial Intelligence",
      detail: "Completed at the University of Manchester.",
    },
    {
      id: "fact-2",
      category: "project",
      label: "JobClock",
      detail: "Built a job-search assistant with Next.js.",
    },
  ],
  stories: [],
}

describe("interview answer prompts", () => {
  it("keeps job context out of general answers", () => {
    const prompt = buildInterviewAnswerPrompt({
      question,
      evidence,
      application: null,
    })

    expect(prompt).not.toContain("ACME")
    expect(prompt).toContain("Use only the confirmed evidence")
    expect(prompt).toContain("[fact-1]")
  })

  it("adds job requirements without changing the candidate evidence", () => {
    const prompt = buildInterviewAnswerPrompt({
      question,
      evidence,
      application: {
        title: "Software Engineer",
        company: "ACME",
        description: "Build reliable TypeScript services.",
      },
    })

    expect(prompt).toContain("Software Engineer at ACME")
    expect(prompt).toContain("Build reliable TypeScript services.")
    expect(prompt).toContain("Do not add facts, metrics, tools, or outcomes")
    expect(prompt).toContain("[fact-1]")
  })

  it("requires natural spoken answers without fabricated details", () => {
    expect(INTERVIEW_ANSWER_SYSTEM_PROMPT).toContain("sounds natural when spoken")
    expect(INTERVIEW_ANSWER_SYSTEM_PROMPT).toContain("Never invent")
    expect(INTERVIEW_ANSWER_SYSTEM_PROMPT).toContain("under 250 words")
  })
})
