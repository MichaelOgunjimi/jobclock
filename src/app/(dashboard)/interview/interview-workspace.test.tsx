import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./actions", () => ({
  createQuestion: vi.fn(),
  saveAnswer: vi.fn(),
  confirmProfileFacts: vi.fn(),
  createProfileFact: vi.fn(),
  updateProfileFact: vi.fn(),
  deleteProfileFact: vi.fn(),
  confirmDiscoveredStory: vi.fn(),
}))

const navigationMock = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navigationMock.replace,
  }),
  useSearchParams: () => navigationMock.searchParams,
}))

import { InterviewWorkspace } from "./interview-workspace"

describe("InterviewWorkspace", () => {
  beforeEach(() => {
    navigationMock.replace.mockClear()
    navigationMock.searchParams = new URLSearchParams()
  })

  const baseInitial = {
    selectedApplicationId: null,
    applicationContextError: null,
  }

  it("presents questions, practice, stories, and personal evidence", () => {
    render(
      <InterviewWorkspace
        initial={{
          ...baseInitial,
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
          applicationCvFactDrafts: [],
          cvFactDrafts: [],
        }}
      />,
    )

    expect(screen.getByRole("tab", { name: "Questions" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Grill Me" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Story Bank" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "About Me" })).toBeInTheDocument()
    expect(screen.getAllByText("Tell me about yourself.")).toHaveLength(2)
  })

  it("lets the user search the workspace application context by job or company", () => {
    render(
      <InterviewWorkspace
        initial={{
          ...baseInitial,
          questions: [
            {
              id: "question-1",
              key: "greatest-strengths",
              text: "What are your greatest strengths?",
              category: "strengths",
              sourceType: "built_in",
              sourceRef: "greatest-strengths",
              applicationId: null,
              requiresStory: false,
              evidenceTags: ["skill"],
              createdAt: null,
              updatedAt: null,
            },
          ],
          answers: [],
          facts: [],
          stories: [],
          applications: [
            {
              id: "app-1",
              slug: "junior-software-engineer-app1",
              title: "Junior Software Engineer",
              company: "OneFamily",
              hasResearch: false,
            },
            {
              id: "app-2",
              slug: "graduate-platform-engineer-app2",
              title: "Graduate Platform Engineer",
              company: "LiveFlow",
              hasResearch: false,
            },
          ],
          applicationCvFactDrafts: [],
          cvFactDrafts: [],
        }}
      />,
    )

    const picker = screen.getByRole("combobox", {
      name: "Application context",
    })
    fireEvent.focus(picker)
    fireEvent.change(picker, { target: { value: "one" } })

    expect(screen.getByText("Junior Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("OneFamily")).toBeInTheDocument()
    expect(
      screen.queryByText("Graduate Platform Engineer"),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Junior Software Engineer"))

    expect(
      screen.getAllByText("Junior Software Engineer at OneFamily").length,
    ).toBeGreaterThan(0)
    expect(navigationMock.replace).toHaveBeenCalledWith(
      "/interview?application=junior-software-engineer-app1",
      { scroll: false },
    )
  })

  it("shows tailored CV facts for the selected job so they can be confirmed", () => {
    render(
      <InterviewWorkspace
        initial={{
          ...baseInitial,
          questions: [
            {
              id: "question-1",
              key: "greatest-strengths",
              text: "What are your greatest strengths?",
              category: "strengths",
              sourceType: "built_in",
              sourceRef: "greatest-strengths",
              applicationId: null,
              requiresStory: false,
              evidenceTags: ["skill"],
              createdAt: null,
              updatedAt: null,
            },
          ],
          answers: [],
          facts: [],
          stories: [],
          applications: [
            {
              id: "app-1",
              slug: "junior-software-engineer-app1",
              title: "Junior Software Engineer",
              company: "OneFamily",
              hasResearch: true,
            },
          ],
          applicationCvFactDrafts: [
            {
              applicationId: "app-1",
              customizedCvId: "tailored-cv-1",
              generatedAt: "2026-06-15T10:00:00.000Z",
              facts: [
                {
                  category: "skill",
                  label: "TypeScript",
                  detail: "TypeScript",
                  sourceType: "cv",
                  logicalSourceRef: "application-cv:app-1:cv:skill:typescript",
                  contentDigest: "digest",
                  sourceRef: "application-cv:app-1:cv:skill:typescript:digest",
                  confirmedAt: null,
                },
                {
                  category: "project",
                  label: "Portfolio",
                  detail: "Built a portfolio project with Next.js.",
                  sourceType: "cv",
                  logicalSourceRef: "application-cv:app-1:cv:project:portfolio",
                  contentDigest: "project-digest",
                  sourceRef: "application-cv:app-1:cv:project:portfolio:project-digest",
                  confirmedAt: null,
                },
              ],
            },
          ],
          cvFactDrafts: [],
        }}
      />,
    )

    const picker = screen.getByRole("combobox", {
      name: "Application context",
    })
    fireEvent.focus(picker)
    fireEvent.change(picker, { target: { value: "one" } })
    fireEvent.click(screen.getByText("Junior Software Engineer"))

    expect(screen.getByText("Suggested from this tailored CV")).toBeInTheDocument()
    expect(screen.getByText("Company research available")).toBeInTheDocument()
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0)
    expect(
      screen.getByRole("button", { name: "Confirm selected facts" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "About Me" }))

    expect(screen.getAllByText("Suggested from this tailored CV").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Junior Software Engineer at OneFamily").length).toBeGreaterThan(0)
    expect(screen.getByText("CV date: 15 Jun 2026")).toBeInTheDocument()
    expect(screen.getByText("Skills")).toBeInTheDocument()
    expect(screen.getByText("Projects")).toBeInTheDocument()
  })
})
