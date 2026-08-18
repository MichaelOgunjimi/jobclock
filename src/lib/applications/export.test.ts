import { describe, expect, it } from "vitest"
import { createApplicationExport, type ApplicationExportSource } from "./export"

const source = {
  application: {
    id: "app-1",
    userId: "user-1",
    status: "interview",
    customTitle: "Staff Product Engineer",
    customCompany: "Acme Labs",
    customLocation: "Remote UK",
    customSalaryText: "£100k–£120k",
    customDescription: "Corrected job description",
  },
  job: {
    id: "job-1",
    title: "Product Engineer",
    company: "Acme",
    location: "London",
    description: "Original job description",
    salaryMin: "90000",
    salaryMax: "110000",
    salaryCurrency: "GBP",
  },
  selectedCv: {
    id: "cv-1",
    userId: "user-1",
    name: "Primary CV",
    parsedJson: { skills: ["TypeScript"] },
    reviewFindings: { score: 88 },
    originalFilePath: "private/original.pdf",
    filePath: "private/processed.pdf",
  },
  writingStyle: {
    id: "style-1",
    userId: "user-1",
    label: "Direct",
    content: "Open with evidence.",
  },
  tailoredCvs: [
    {
      id: "tailored-1",
      userId: "user-1",
      applicationId: "app-1",
      cvJson: { summary: "Tailored summary" },
      pdfPath: "private/tailored.pdf",
    },
  ],
  coverLetters: [
    {
      id: "letter-1",
      userId: "user-1",
      applicationId: "app-1",
      content: "Dear hiring team…",
    },
  ],
  statusHistory: [
    {
      id: "event-1",
      userId: "user-1",
      applicationId: "app-1",
      fromStatus: "applied",
      toStatus: "interview",
    },
  ],
  interviewPreparations: [
    {
      id: "prep-1",
      applicationId: "app-1",
      questions: ["Why Acme?"],
      suggestedAnswers: { raw: "Answer notes" },
      researchContent: "Acme research",
    },
  ],
  interviewQuestions: [
    {
      id: "question-2",
      userId: "user-1",
      applicationId: "app-1",
      text: "What would you build first?",
    },
  ],
  interviewAnswers: [
    {
      answer: {
        id: "answer-1",
        userId: "user-1",
        applicationId: "app-1",
        questionId: "question-1",
        content: "I would start with discovery.",
      },
      question: {
        id: "question-1",
        userId: "user-1",
        applicationId: null,
        text: "How would you begin?",
      },
    },
  ],
  offers: [
    {
      id: "offer-1",
      userId: "user-1",
      applicationId: "app-1",
      company: "Acme Labs",
      role: "Staff Product Engineer",
    },
  ],
} as unknown as ApplicationExportSource

describe("createApplicationExport", () => {
  it("creates a versioned, AI-friendly bundle with effective job details", () => {
    const result = createApplicationExport(source, "2026-08-18T12:00:00.000Z")

    expect(result.format).toBe("jobclock.application-export")
    expect(result.version).toBe(1)
    expect(result.exportedAt).toBe("2026-08-18T12:00:00.000Z")
    expect(result.summary).toMatchObject({
      role: "Staff Product Engineer",
      company: "Acme Labs",
      location: "Remote UK",
      description: "Corrected job description",
      status: "interview",
    })
    expect(result.summary.salary).toEqual({
      display: "£100k–£120k",
      minimum: "90000",
      maximum: "110000",
      currency: "GBP",
    })
  })

  it("removes account and private storage fields while retaining generated content", () => {
    const result = createApplicationExport(source)

    expect(result.application).not.toHaveProperty("userId")
    expect(result.selectedCv).not.toHaveProperty("userId")
    expect(result.selectedCv).not.toHaveProperty("originalFilePath")
    expect(result.selectedCv).not.toHaveProperty("filePath")
    expect(result.tailoredCvs[0]).not.toHaveProperty("pdfPath")
    expect(result.coverLetters[0]).not.toHaveProperty("userId")
    expect(result.interview.answers[0]).toMatchObject({
      content: "I would start with discovery.",
      question: { text: "How would you begin?" },
    })
    expect(result.interview.answers[0]).not.toHaveProperty("userId")
    expect(result.interview.answers[0].question).not.toHaveProperty("userId")
  })
})
