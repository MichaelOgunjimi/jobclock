import { describe, expect, it } from "vitest"
import { interviewAnswerPrompt, interviewAnswerSystemPrompt } from "./interview"

describe("interviewAnswerPrompt", () => {
  it("includes the question, the story, and the JD context", () => {
    const prompt = interviewAnswerPrompt({
      question: "Tell me about a time you debugged a production issue.",
      story: "Situation: payments service was timing out. Task: find root cause. Action: traced logs to a slow DB query. Result: cut latency 80%.",
      jdContext: "Backend engineer role focused on payment systems.",
    })

    expect(prompt).toContain("Tell me about a time you debugged a production issue.")
    expect(prompt).toContain("payments service was timing out")
    expect(prompt).toContain("payment systems")
  })

  it("instructs the model to use STAR structure", () => {
    const prompt = interviewAnswerPrompt({
      question: "q",
      story: "s",
      jdContext: "j",
    })
    expect(prompt).toMatch(/STAR/i)
  })
})

describe("interviewAnswerSystemPrompt", () => {
  it("forbids fabrication beyond the supplied story", () => {
    const prompt = interviewAnswerSystemPrompt()
    expect(prompt).toMatch(/never (fabricate|invent)/i)
    expect(prompt).toMatch(/(only|exclusively).+(story|provided)/i)
  })
})
