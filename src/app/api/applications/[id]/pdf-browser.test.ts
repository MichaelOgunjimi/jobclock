import { beforeEach, describe, expect, it, vi } from "vitest"

const playwrightLaunch = vi.hoisted(() => vi.fn())
const coreLaunch = vi.hoisted(() => vi.fn())
const executablePath = vi.hoisted(() => vi.fn())

vi.mock("@playwright/test", () => ({
  chromium: {
    launch: playwrightLaunch,
  },
}))

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--serverless"],
    executablePath,
  },
}))

vi.mock("playwright-core", () => ({
  chromium: {
    launch: coreLaunch,
  },
}))

import { launchPdfBrowser } from "./pdf-browser"

describe("launchPdfBrowser", () => {
  beforeEach(() => {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH
    playwrightLaunch.mockReset()
    coreLaunch.mockReset()
    executablePath.mockReset()
    executablePath.mockResolvedValue("/tmp/chromium")
  })

  it("uses the original Playwright browser path when available", async () => {
    const browser = { close: vi.fn(), newContext: vi.fn() }
    playwrightLaunch.mockResolvedValue(browser)

    await expect(launchPdfBrowser()).resolves.toBe(browser)

    expect(playwrightLaunch).toHaveBeenCalledWith({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe("0")
    expect(coreLaunch).not.toHaveBeenCalled()
  })

  it("falls back to serverless Chromium when the original path cannot launch", async () => {
    const browser = { close: vi.fn(), newContext: vi.fn() }
    playwrightLaunch.mockRejectedValue(new Error("browser executable missing"))
    coreLaunch.mockResolvedValue(browser)

    await expect(launchPdfBrowser()).resolves.toBe(browser)

    expect(coreLaunch).toHaveBeenCalledWith({
      args: ["--serverless"],
      executablePath: "/tmp/chromium",
      headless: true,
    })
  })
})
