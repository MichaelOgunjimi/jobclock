import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/contexts/generation-jobs-context", () => ({
  useGenerationJobsContext: () => ({
    jobs: [],
    recentJobs: [],
    unseenJobs: [],
    unseenCount: 0,
    getActiveJob: vi.fn(),
    getApplicationLabel: vi.fn(),
    trackJob: vi.fn(),
  }),
}))
vi.mock("@/hooks/use-download-pdf", () => ({
  useDownloadPdf: () => ({ handleDownloadPdf: vi.fn(), isDownloading: false }),
}))
vi.mock("./actions", () => ({
  updateStatus: vi.fn(),
  updateNotes: vi.fn(),
  updateCv: vi.fn(),
  updateWritingStyle: vi.fn(),
  updateDescription: vi.fn(),
  updateJobDetail: vi.fn(),
  deleteApplication: vi.fn(),
  generateCoverLetter: vi.fn(),
}))

import { ApplicationDetail } from "./application-detail"

const encoder = new TextEncoder()

function renderApplicationDetail() {
  render(
    <ApplicationDetail
      application={{
        id: "app-1",
        status: "saved",
        created_at: "2026-06-01T12:00:00.000Z",
        applied_at: null,
        custom_description: "Build helpful software.",
        selected_cv_id: null,
        structure_id: null,
        cover_letter_tone: null,
        notes: null,
        jobs_cache: {
          title: "Product Engineer",
          company: "Acme",
          location: "London",
          description: "Build helpful software.",
          salary_min: null,
          salary_max: null,
          posted_at: null,
          source: "manual",
          is_easy_apply: null,
          url: null,
        },
      } as never}
      cvs={[]}
      writingStyles={[]}
      tailoredCvs={[]}
      generatedCoverLetter={null}
      followUpDueAt={null}
      followUpNotes={null}
    />,
  )
}

function mockStreamingChat() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController
    },
  })
  const fetchMock = vi.fn().mockResolvedValue(new Response(stream))
  vi.stubGlobal("fetch", fetchMock)
  return {
    fetchMock,
    enqueue(text: string) {
      controller?.enqueue(encoder.encode(text))
    },
    close() {
      controller?.close()
    },
  }
}

describe("ApplicationDetail chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("lets the user draft the next message while an answer is streaming", async () => {
    const chat = mockStreamingChat()
    renderApplicationDetail()

    const input = screen.getByLabelText("Message")
    fireEvent.change(input, { target: { value: "What should I ask?" } })
    fireEvent.submit(input.closest("form")!)

    await waitFor(() => expect(chat.fetchMock).toHaveBeenCalled())

    expect(input).not.toBeDisabled()
    fireEvent.change(input, { target: { value: "done" } })
    expect(input).toHaveValue("done")

    chat.close()
  })

  it("does not force-scroll streaming content after the user scrolls up", async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const chat = mockStreamingChat()
    renderApplicationDetail()

    const input = screen.getByLabelText("Message")
    fireEvent.change(input, { target: { value: "Summarise this role" } })
    fireEvent.submit(input.closest("form")!)
    await waitFor(() => expect(chat.fetchMock).toHaveBeenCalled())

    const messageList = document.querySelector('[aria-live="polite"]') as HTMLDivElement
    Object.defineProperties(messageList, {
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100, writable: true },
    })
    fireEvent.scroll(messageList)

    await act(async () => {
      chat.enqueue("Streaming answer")
    })

    await screen.findByText("Streaming answer")
    expect(scrollIntoView).not.toHaveBeenCalled()

    chat.close()
  })

  it("opens an expanded chat dialog with the existing conversation", async () => {
    const chat = mockStreamingChat()
    renderApplicationDetail()

    const input = screen.getByLabelText("Message")
    fireEvent.change(input, { target: { value: "How should I position myself?" } })
    fireEvent.submit(input.closest("form")!)
    await waitFor(() => expect(chat.fetchMock).toHaveBeenCalled())

    await act(async () => {
      chat.enqueue("Lead with the platform work.")
    })

    fireEvent.click(screen.getByRole("button", { name: "Open expanded chat" }))

    const dialog = screen.getByRole("dialog", { name: "Expanded application chat" })
    expect(within(dialog).getByText("How should I position myself?")).toBeInTheDocument()
    expect(within(dialog).getByText("Lead with the platform work.")).toBeInTheDocument()

    chat.close()
  })

  it("shares draft input between embedded and expanded chat views", () => {
    renderApplicationDetail()

    const input = screen.getByLabelText("Message")
    fireEvent.change(input, { target: { value: "done" } })
    fireEvent.click(screen.getByRole("button", { name: "Open expanded chat" }))

    const dialog = screen.getByRole("dialog", { name: "Expanded application chat" })
    const dialogInput = within(dialog).getByLabelText("Message")
    expect(dialogInput).toHaveValue("done")

    fireEvent.change(dialogInput, { target: { value: "follow up on metrics" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Close expanded chat" }))

    expect(screen.getByLabelText("Message")).toHaveValue("follow up on metrics")
  })

  it("shows streamed assistant content in the expanded chat while generation is active", async () => {
    const chat = mockStreamingChat()
    renderApplicationDetail()

    const input = screen.getByLabelText("Message")
    fireEvent.change(input, { target: { value: "Draft a recruiter reply" } })
    fireEvent.submit(input.closest("form")!)
    await waitFor(() => expect(chat.fetchMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole("button", { name: "Open expanded chat" }))
    const dialog = screen.getByRole("dialog", { name: "Expanded application chat" })

    await act(async () => {
      chat.enqueue("Thanks for reaching out")
    })

    expect(await within(dialog).findByText("Thanks for reaching out")).toBeInTheDocument()

    chat.close()
  })
})
