import type { Metadata } from "next"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { PublicExtensionPage } from "@/components/extension/public-extension-page"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CHROME_WEB_STORE_URL } from "@/lib/extension"

export const metadata: Metadata = {
  title: "Extension Support",
  description:
    "Set up the JobClock Chrome extension and resolve connection, extraction, and saving issues.",
  alternates: {
    canonical: "/extension/support",
  },
}

const setupSteps = [
  {
    title: "Install JobClock",
    body: "Open the published Chrome Web Store listing, select Add to Chrome, and confirm Add extension.",
    href: CHROME_WEB_STORE_URL,
  },
  {
    title: "Generate a token",
    body: "Sign in to JobClock, open Settings, find the extension section, and select Generate Token.",
  },
  {
    title: "Connect JobClock",
    body: "Open the extension, paste the token, and select Connect JobClock. The token is stored locally in Chrome.",
  },
  {
    title: "Preview and save",
    body: "Open a job page, select the extension, review the extracted details, then choose Save to JobClock.",
  },
]

export default function ExtensionSupportPage() {
  return (
    <PublicExtensionPage
      kicker="Extension support"
      title="JobClock extension support"
      lede="Connect the extension, capture jobs from the active page, and recover cleanly when a site or network request gets in the way."
      updatedAt="22 July 2026"
    >
      <Card>
        <CardHeader className="border-b">
          <p className="page-kicker">01 · Setup</p>
          <CardTitle>Connect the extension</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2">
          {setupSteps.map((step, index) => (
            <div key={step.title} className="bg-card p-6">
              <p className="page-kicker">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-4 text-xl tracking-[-0.03em]">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
              {step.href ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Open Chrome Web Store
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <SupportSection title="Supported job pages" kicker="02">
        <p>
          JobClock works on normal HTTP and HTTPS job pages where the listing
          details are available in the page. Keep the job itself open in the
          active tab before selecting the extension.
        </p>
        <p>
          On LinkedIn and other sites that load descriptions lazily, scroll to
          the job description and wait for it to finish loading before opening
          JobClock. Sign-in walls, browser internal pages, PDFs, and pages that
          block script access may not be extractable.
        </p>
      </SupportSection>

      <SupportSection title="Extraction and saved state" kicker="03">
        <p>
          If you close the popup while extraction is running, the work
          continues. Reopening JobClock on the same tab and exact URL restores
          the existing loading, preview, success, or error state instead of
          starting extraction again.
        </p>
        <p>
          Navigating to a different URL starts a fresh preview. To deliberately
          run extraction again on the current page, select{" "}
          <strong>Re-extract</strong>. If an operation was interrupted, select{" "}
          <strong>Try again</strong>.
        </p>
      </SupportSection>

      <SupportSection title="Saving and recent applications" kicker="04">
        <p>
          Review the preview before selecting <strong>Save to JobClock</strong>.
          The Recent applications view shows the latest saved items and lets
          you submit stage changes such as applied, screening, interview, or
          offer.
        </p>
        <p>
          If a save appears to have completed but the popup was closed, reopen
          it on the same page. JobClock restores the completed state without
          saving a duplicate automatically.
        </p>
      </SupportSection>

      <Card>
        <CardHeader className="border-b">
          <p className="page-kicker">05 · Troubleshooting</p>
          <CardTitle>Common problems</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          <TroubleshootingItem title="Unauthorized or invalid token">
            Your token may have expired or been revoked. Generate a new token
            under <strong>JobClock Settings → Extension</strong>, then open the
            extension settings and reconnect.
          </TroubleshootingItem>
          <TroubleshootingItem title="No job details found">
            Confirm the full description is visible, especially on LinkedIn,
            then select <strong>Try again</strong>. Some protected or unusual
            page layouts may require manual entry in JobClock.
          </TroubleshootingItem>
          <TroubleshootingItem title="Interrupted extraction">
            Keep the job tab open and select <strong>Try again</strong>. The
            extension reports an interruption when a stored loading state no
            longer has a matching background operation.
          </TroubleshootingItem>
          <TroubleshootingItem title="Network or server error">
            Confirm Chrome is online and that
            jobclock.michaelogunjimi.com opens normally. Retry after the
            connection is restored.
          </TroubleshootingItem>
        </CardContent>
      </Card>

      <SupportSection title="Privacy and contact" kicker="06">
        <p>
          Read the{" "}
          <Link
            href="/extension/privacy"
            className="font-medium text-foreground underline underline-offset-4"
          >
            JobClock extension privacy policy
          </Link>{" "}
          for details about page access, token storage, data transfer, and
          deletion.
        </p>
        <p>
          For support, email{" "}
          <a
            href="mailto:support@jobclock.michaelogunjimi.com"
            className="font-medium text-foreground underline underline-offset-4"
          >
            support@jobclock.michaelogunjimi.com
          </a>
          . Include the page URL, the error message, and your Chrome version,
          but never include your extension token.
        </p>
      </SupportSection>
    </PublicExtensionPage>
  )
}

function SupportSection({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <p className="page-kicker">{kicker}</p>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-[15px] leading-7 text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}

function TroubleshootingItem({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-6">
      <h2 className="text-lg tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </section>
  )
}
