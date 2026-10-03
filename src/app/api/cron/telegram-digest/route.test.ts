import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  list: vi.fn(),
  build: vi.fn(),
  send: vi.fn(),
  setDigest: vi.fn(),
}))

vi.mock("@/lib/cron/verify-cron-request", () => ({ verifyCronRequest: mocks.verify }))
vi.mock("@/lib/telegram/pairing", () => ({ listDigestSubscribers: mocks.list, setTelegramDigest: mocks.setDigest }))
vi.mock("@/lib/telegram/digest", () => ({ buildDigest: mocks.build }))
vi.mock("@/lib/telegram/client", () => ({ sendTelegramHtml: mocks.send }))

import { POST } from "./route"

describe("POST /api/cron/telegram-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockResolvedValue("")
  })

  it("rejects unauthenticated requests", async () => {
    mocks.verify.mockResolvedValue(null)
    expect((await POST(new Request("http://x"))).status).toBe(401)
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it("sends to subscribers, skips empty digests, and disables blocked chats", async () => {
    mocks.list.mockResolvedValue([
      { userId: "u1", chatId: "1" },
      { userId: "u2", chatId: "2" },
      { userId: "u3", chatId: "3" },
    ])
    mocks.build.mockImplementation(async (userId: string) => (userId === "u2" ? null : `digest ${userId}`))
    mocks.send.mockImplementation(async (chatId: string) => {
      if (chatId === "3") throw new Error("Telegram sendMessage failed (403)")
    })

    const body = await (await POST(new Request("http://x"))).json()

    expect(body).toEqual({ ok: true, subscribers: 3, sent: 1, failed: 1 })
    expect(mocks.send).toHaveBeenCalledWith("1", "digest u1")
    expect(mocks.setDigest).toHaveBeenCalledWith("u3", null)
  })
})
