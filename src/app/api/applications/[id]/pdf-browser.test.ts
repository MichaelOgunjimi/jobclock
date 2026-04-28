import { describe, expect, it, vi, beforeEach } from "vitest"

const puppeteerLaunch = vi.hoisted(() => vi.fn())
const sparticuzArgs = ["--serverless"]
const sparticuzExecutablePath = vi.hoisted(() => vi.fn())

vi.mock("puppeteer-core", () => ({
  launch: puppeteerLaunch,
}))

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: sparticuzArgs,
    executablePath: sparticuzExecutablePath,
  },
}))

import { launchPdfBrowser } from "./pdf-browser"

describe("launchPdfBrowser", () => {
  beforeEach(() => {
    puppeteerLaunch.mockReset()
    sparticuzExecutablePath.mockReset()
    sparticuzExecutablePath.mockResolvedValue("/tmp/chromium")
  })

  it("launches with sparticuz chromium", async () => {
    const browser = { close: vi.fn(), newPage: vi.fn() }
    puppeteerLaunch.mockResolvedValue(browser)

    await expect(launchPdfBrowser()).resolves.toBe(browser)

    expect(puppeteerLaunch).toHaveBeenCalledWith({
      args: sparticuzArgs,
      executablePath: "/tmp/chromium",
      headless: true,
    })
  })

  it("rejects when launch fails", async () => {
    puppeteerLaunch.mockRejectedValue(new Error("launch failed"))

    await expect(launchPdfBrowser()).rejects.toThrow("launch failed")
  })
})
