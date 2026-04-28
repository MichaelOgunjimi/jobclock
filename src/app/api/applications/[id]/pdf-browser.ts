import type { Browser } from "puppeteer-core"

export type PdfBrowser = Pick<Browser, "close" | "newPage">

export async function launchPdfBrowser(): Promise<PdfBrowser> {
  const { launch } = await import("puppeteer-core")
  const { default: chromium } = await import("@sparticuz/chromium")

  return launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}
