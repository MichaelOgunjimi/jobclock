import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("./actions", () => ({
  createQuestion: vi.fn(),
  saveAnswer: vi.fn(),
  confirmProfileFacts: vi.fn(),
  createProfileFact: vi.fn(),
  updateProfileFact: vi.fn(),
  deleteProfileFact: vi.fn(),
  confirmDiscoveredStory: vi.fn(),
}))

import { InterviewWorkspace } from "./interview-workspace"

describe("InterviewWorkspace", () => {
  it("presents questions, practice, stories, and personal evidence", () => {
    render(
      <InterviewWorkspace
        initial={{
          questions: [
            {
              id: null,
              key: "tell-me-about-yourself",
              text: "Tell me about yourself.",
              category: "opening",
              sourceType: "built_in",
              sourceRef: "tell-me-about-yourself",
              applicationId: null,
              requiresStory: false,
              evidenceTags: ["summary"],
              createdAt: null,
              updatedAt: null,
            },
          ],
          answers: [],
          facts: [],
          stories: [],
          applications: [],
          cvFactDrafts: [],
        }}
      />,
    )

    expect(screen.getByRole("tab", { name: "Questions" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Practice" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Story Bank" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "About Me" })).toBeInTheDocument()
    expect(screen.getAllByText("Tell me about yourself.")).toHaveLength(2)
  })
})
