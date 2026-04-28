import type { Browser } from "puppeteer-core"

export type PdfBrowser = Pick<Browser, "close" | "newPage">

export async function launchPdfBrowser(): Promise<PdfBrowser> {
  const { launch } = await import("puppeteer-core")

  // In local Docker dev (or any env where a system Chromium is available),
  // PUPPETEER_EXECUTABLE_PATH points to the installed binary and avoids
  // the x86_64-only @sparticuz/chromium failing on ARM64 hosts.
  const systemChromium = process.env.PUPPETEER_EXECUTABLE_PATH
  if (systemChromium) {
    return launch({
      executablePath: systemChromium,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    })
  }

  // Production (Vercel / AWS Lambda x86_64): use the bundled @sparticuz/chromium.
  const { default: chromium } = await import("@sparticuz/chromium")
  return launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}
