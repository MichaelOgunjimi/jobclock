import type { Browser } from "@playwright/test"

export type PdfBrowser = Pick<Browser, "close" | "newContext">

export async function launchPdfBrowser(): Promise<PdfBrowser> {
  try {
    const { chromium } = await import("@playwright/test")

    return await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
  } catch (error) {
    console.warn("Falling back to serverless Chromium for PDF generation", error)

    const { default: sparticuz } = await import("@sparticuz/chromium")
    const { chromium } = await import("playwright-core")

    const browser = await chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    })

    return browser as unknown as PdfBrowser
  }
}
