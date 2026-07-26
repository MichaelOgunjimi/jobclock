import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileTabs } from "./profile-tabs"
import { saveGenerationAutomation } from "./actions"

const { navigationState } = vi.hoisted(() => ({
  navigationState: { search: "" },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigationState.search),
}))

vi.mock("./actions", () => ({
  saveGenerationAutomation: vi.fn(),
}))

vi.mock("./cv-card-actions", () => ({
  CvCardActions: () => null,
}))

vi.mock("./cv-upload-dialog", () => ({
  CvUploadDialog: () => null,
}))

vi.mock("./writing-styles-tab", () => ({
  WritingStylesTab: () => null,
}))

describe("ProfileTabs CV cards", () => {
  it("shows the number of review issues for a CV", () => {
    render(
      <ProfileTabs
        cvs={[
          {
            id: "cv-1",
            name: "Product CV",
            is_primary: true,
            created_at: "2026-07-23T12:00:00.000Z",
            parsed_json: { name: "Michael", skills: [], experience: [] },
            review_finding_count: 2,
          },
        ]}
        builtInStyles={[]}
        userStyles={[]}
      />,
    )

    expect(screen.getByText("2 review issues")).toBeInTheDocument()
  })

  it("does not show a review badge when a CV has no findings", () => {
    render(
      <ProfileTabs
        cvs={[
          {
            id: "cv-2",
            name: "Clean CV",
            is_primary: false,
            created_at: "2026-07-23T12:00:00.000Z",
            parsed_json: { name: "Michael", skills: [], experience: [] },
            review_finding_count: 0,
          },
        ]}
        builtInStyles={[]}
        userStyles={[]}
      />,
    )

    expect(screen.queryByText(/review issues?/i)).not.toBeInTheDocument()
  })
})

describe("ProfileTabs automation", () => {
  it("shows independent CV and cover-letter generation toggles", () => {
    navigationState.search = "tab=automation"

    render(
      <ProfileTabs
        cvs={[]}
        builtInStyles={[]}
        userStyles={[]}
        generationAutomation={{ generateCv: true, generateCoverLetter: false }}
      />,
    )

    expect(screen.getByRole("switch", { name: /tailored cv/i })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: /cover letter/i })).toHaveAttribute("aria-checked", "false")
  })

  it("saves either automation independently", async () => {
    navigationState.search = "tab=automation"
    vi.mocked(saveGenerationAutomation).mockResolvedValue({ success: true })
    render(
      <ProfileTabs
        cvs={[]}
        builtInStyles={[]}
        userStyles={[]}
        generationAutomation={{ generateCv: false, generateCoverLetter: false }}
      />,
    )

    fireEvent.click(screen.getByRole("switch", { name: /tailored cv/i }))
    fireEvent.click(screen.getByRole("button", { name: /save automation/i }))

    await waitFor(() => {
      expect(saveGenerationAutomation).toHaveBeenCalledWith({
        generateCv: true,
        generateCoverLetter: false,
      })
    })
  })
})
