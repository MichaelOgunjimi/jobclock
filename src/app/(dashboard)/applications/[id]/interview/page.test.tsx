import { render, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, beforeEach, vi } from "vitest"
import InterviewPrepPage from "./page"

const mockState = vi.hoisted(() => ({
  activeJobsByKind: {} as Record<string, { id: string } | undefined>,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "app-123" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/contexts/generation-jobs-context", () => ({
  useGenerationJobsContext: () => ({
    jobs: [],
    unseenJobs: [],
    unseenCount: 0,
    getActiveJob: (_applicationId: string, kind: string) => mockState.activeJobsByKind[kind],
  }),
}))

describe("InterviewPrepPage job completion refresh", () => {
  beforeEach(() => {
    mockState.activeJobsByKind = {}
  })

  it.each(["interview_prep", "company_research", "cover_letter", "interview_answer"] as const)(
    "re-fetches saved content when %s finishes",
    async (kind) => {
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString()

        if (url.includes("/api/applications/app-123/interview")) {
          return {
            json: async () => ({ content: null, questions: [], storyCount: null, answers: {} }),
          } as Response
        }

        if (url.includes("/api/applications/app-123/company-research")) {
          return {
            json: async () => ({ content: null }),
          } as Response
        }

        throw new Error(`Unexpected fetch URL: ${url}`)
      })

      vi.stubGlobal("fetch", fetchMock)
      mockState.activeJobsByKind = { [kind]: { id: "job-1" } }

      const { rerender } = render(<InterviewPrepPage />)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
      })

      mockState.activeJobsByKind = {}
      rerender(<InterviewPrepPage />)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(4)
      })
    }
  )
})
