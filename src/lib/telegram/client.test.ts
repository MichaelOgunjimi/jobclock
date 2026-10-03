import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { escapeHtml, sendTelegramText } from "./client"

describe("telegram client", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token")
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const sent = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body)

  it("sends HTML and keeps the keyboard", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }))
    await sendTelegramText("1", "<b>Hi</b>", [[{ text: "Go", url: "https://x.test" }]])

    expect(sent(0)).toMatchObject({ chat_id: "1", text: "<b>Hi</b>", parse_mode: "HTML" })
    expect(sent(0).reply_markup.inline_keyboard).toHaveLength(1)
  })

  it("resends as plain text when Telegram rejects the markup", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 400 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
    await sendTelegramText("1", "<b>A &amp; B</b> &lt;c&gt;")

    expect(sent(1).parse_mode).toBeUndefined()
    expect(sent(1).text).toBe("A & B <c>")
  })

  it("throws for other failures and escapes HTML", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }))
    await expect(sendTelegramText("1", "x")).rejects.toThrow("(500)")
    expect(escapeHtml("<a>&")).toBe("&lt;a&gt;&amp;")
  })
})
