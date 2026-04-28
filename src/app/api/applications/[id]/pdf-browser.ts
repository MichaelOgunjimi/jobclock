import type { Browser } from "puppeteer-core"

export type PdfBrowser = Pick<Browser, "close" | "newPage">

// On Vercel, sparticuz downloads this to /tmp on cold start and reuses it on
// warm starts — no file tracing required. Override with CHROMIUM_REMOTE_URL if needed.
const CHROMIUM_REMOTE_URL =
  process.env.CHROMIUM_REMOTE_URL ??
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar"

export async function launchPdfBrowser(): Promise<PdfBrowser> {
  const { launch } = await import("puppeteer-core")

  // Docker / local dev: use the system Chromium set by docker-compose
  const systemChromium = process.env.PUPPETEER_EXECUTABLE_PATH
  if (systemChromium) {
    return launch({
      executablePath: systemChromium,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    })
  }

  // Vercel / Lambda: download binary from GitHub releases, cached in /tmp
  const { default: chromium } = await import("@sparticuz/chromium")
  return launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_REMOTE_URL),
    headless: true,
  })
}
