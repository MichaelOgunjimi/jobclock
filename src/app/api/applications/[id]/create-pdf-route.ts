import type { Browser } from "playwright-core"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { withPdfExtension } from "@/lib/document-filename"

type RouteParams = { params: Promise<{ id: string }> }

interface PdfRouteConfig {
  templateValidator: (name: string | null) => boolean
  printPath: string
  dataAttribute: string
  filenamePrefix: string
  defaultTemplate: string
  errorLabel: string
}

export function createPdfRoute({
  templateValidator,
  printPath,
  dataAttribute,
  filenamePrefix,
  defaultTemplate,
  errorLabel,
}: PdfRouteConfig) {
  return async function GET(request: NextRequest, { params }: RouteParams) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const template = request.nextUrl.searchParams.get("template")
    const requestedFilename = request.nextUrl.searchParams.get("filename")
    const printUrl = new URL(`/applications/${id}/${printPath}`, request.nextUrl.origin)

    if (template && templateValidator(template)) {
      printUrl.searchParams.set("template", template)
    }

    let browser: Browser | null = null

    try {
      const { chromium: sparticuz } = await import("@sparticuz/chromium")
      const { chromium } = await import("playwright-core")
      browser = await chromium.launch({
        args: sparticuz.args,
        executablePath: await sparticuz.executablePath(),
        headless: true,
      })

      const context = await browser.newContext({
        extraHTTPHeaders: {
          cookie: request.headers.get("cookie") ?? "",
        },
      })
      const page = await context.newPage()

      await page.goto(printUrl.toString(), { waitUntil: "load" })
      await page.emulateMedia({ media: "print" })
      await page.waitForSelector(`[${dataAttribute}='true']`, { timeout: 15_000 })

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        margin: {
          top: "0",
          right: "0",
          bottom: "0",
          left: "0",
        },
      })

      await context.close()

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${withPdfExtension(requestedFilename ?? `${filenamePrefix}-${template ?? defaultTemplate}`)}"`,
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      console.error(`Failed to generate ${errorLabel} PDF`, error)
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }
}
