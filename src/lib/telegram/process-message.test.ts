import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  sendTelegramText: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { insert: mocks.insert },
}))
vi.mock("./client", () => ({ sendTelegramText: mocks.sendTelegramText }))
vi.mock("./stats", () => ({
  getApplicationStats: vi.fn().mockResolvedValue({ byStatus: { saved: 1 }, savedThisWeek: 1, appliedThisWeek: 0 }),
  formatStats: () => "STATS TEXT",
}))
vi.mock("./pairing", () => ({
  consumeTelegramPairingToken: vi.fn(),
  findTelegramUser: vi.fn(),
  touchTelegramConnection: vi.fn(),
  disconnectTelegram: vi.fn(),
  getTelegramConnection: vi.fn(),
}))
vi.mock("@/lib/jobs/fetch-job-page", () => ({ fetchJobPage: vi.fn() }))
vi.mock("@/lib/jobs/import-job", () => ({
  parseImportedJobPreview: vi.fn(),
  JobImportError: class JobImportError extends Error {},
}))
vi.mock("@/lib/jobs/persist-job", () => ({
  persistJobForUser: vi.fn(),
  listRecentApplicationsForUser: vi.fn(),
}))

import { fetchJobPage } from "@/lib/jobs/fetch-job-page"
import { parseImportedJobPreview } from "@/lib/jobs/import-job"
import { listRecentApplicationsForUser, persistJobForUser } from "@/lib/jobs/persist-job"
import { disconnectTelegram, findTelegramUser } from "./pairing"
import { extractFirstJobUrl } from "@/lib/jobs/extract-job-url"
import { extractTelegramStartToken, processTelegramMessage } from "./process-message"

describe("Telegram commands", () => {
  beforeEach(() => vi.clearAllMocks())

  it("parses native deep-link start commands for the configured bot", () => {
    expect(extractTelegramStartToken("/start Abc_123-xyz", "JobClockBot")).toBe("Abc_123-xyz")
    expect(extractTelegramStartToken("/start@JobClockBot token", "@jobclockbot")).toBe("token")
    expect(extractTelegramStartToken("/start@OtherBot token", "jobclockbot")).toBeNull()
    expect(extractTelegramStartToken("/start", "jobclockbot")).toBeNull()
  })

  it("extracts a shared job URL and removes message punctuation", () => {
    expect(extractFirstJobUrl("Take a look https://jobs.example.com/role?id=12)."))
      .toBe("https://jobs.example.com/role?id=12")
  })

  it("does not process an update whose receipt already exists", async () => {
    mocks.insert.mockReturnValue({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    })

    await processTelegramMessage({
      updateId: 42,
      messageId: 7,
      chatId: "123456789",
      telegramUserId: "123456789",
      username: "michael",
      displayName: "Michael",
      body: "https://example.com/job",
    })

    expect(mocks.sendTelegramText).not.toHaveBeenCalled()
  })

  describe("job import", () => {
    const update = (body: string) => ({
      updateId: 1, messageId: 1, chatId: "1", telegramUserId: "1",
      username: null, displayName: null, body,
    })

    beforeEach(() => {
      mocks.insert.mockReturnValue({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ updateId: 1 }]) })),
        })),
      })
      vi.mocked(findTelegramUser).mockResolvedValue("user-1")
      vi.mocked(parseImportedJobPreview).mockResolvedValue({ title: "Dev", company: "Acme" } as never)
      vi.mocked(persistJobForUser).mockResolvedValue({ applicationSlug: "dev", alreadySaved: false } as never)
    })

    it("imports a link with a pasted description without fetching the page", async () => {
      const text = "Software engineer role. ".repeat(20)
      await processTelegramMessage(update(`https://blocked.example.com/job ${text}`))

      expect(fetchJobPage).not.toHaveBeenCalled()
      expect(parseImportedJobPreview).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://blocked.example.com/job", pageText: text.trim() })
      )
    })

    it("answers /help without requiring a connection", async () => {
      vi.mocked(findTelegramUser).mockResolvedValue(null)
      await processTelegramMessage(update("/help"))
      expect(mocks.sendTelegramText).toHaveBeenCalledWith("1", expect.stringContaining("/recent"))
    })

    it("replies to /stats with the formatted summary", async () => {
      await processTelegramMessage(update("/stats"))
      expect(mocks.sendTelegramText).toHaveBeenCalledWith("1", "STATS TEXT")
    })

    it("lists recent saved jobs for /recent@bot", async () => {
      vi.mocked(listRecentApplicationsForUser).mockResolvedValue([
        { applicationId: "app-1", title: "Dev", company: "Acme", status: "saved", applicationUrl: "https://x.test/applications/dev" },
      ] as never)
      await processTelegramMessage(update("/recent@jobclock_bot"))
      expect(mocks.sendTelegramText).toHaveBeenCalledWith(
        "1",
        "Dev at Acme (saved)\nhttps://x.test/applications/dev",
        [[{ text: "Dev at Acme (saved)", callback_data: "j:app-1" }]]
      )
    })

    it("disconnects on /disconnect and still requires a connection for commands", async () => {
      await processTelegramMessage(update("/disconnect"))
      expect(disconnectTelegram).toHaveBeenCalledWith("user-1")

      vi.mocked(findTelegramUser).mockResolvedValue(null)
      vi.mocked(disconnectTelegram).mockClear()
      await processTelegramMessage(update("/disconnect"))
      expect(disconnectTelegram).not.toHaveBeenCalled()
    })

    it("tells the user to paste the description when a site returns 403", async () => {
      vi.mocked(fetchJobPage).mockRejectedValue(new Error("The job page returned HTTP 403."))
      await processTelegramMessage(update("https://blocked.example.com/job"))

      expect(mocks.sendTelegramText).toHaveBeenLastCalledWith("1", expect.stringContaining("blocks automated access"))
    })
  })
})
