import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  sendTelegramText: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { insert: mocks.insert },
}))
vi.mock("./client", () => ({ sendTelegramText: mocks.sendTelegramText }))
vi.mock("./pairing", () => ({
  consumeTelegramPairingToken: vi.fn(),
  findTelegramUser: vi.fn(),
  touchTelegramConnection: vi.fn(),
}))
vi.mock("@/lib/jobs/fetch-job-page", () => ({ fetchJobPage: vi.fn() }))
vi.mock("@/lib/jobs/import-job", () => ({ parseImportedJobPreview: vi.fn() }))
vi.mock("@/lib/jobs/persist-job", () => ({ persistJobForUser: vi.fn() }))

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
})
