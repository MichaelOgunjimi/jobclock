import type { Metadata } from "next"
import { PublicExtensionPage } from "@/components/extension/public-extension-page"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Extension Privacy",
  description:
    "How the JobClock Chrome extension accesses, uses, stores, and transfers data.",
  alternates: {
    canonical: "/extension/privacy",
  },
}

const permissions = [
  {
    name: "activeTab",
    purpose:
      "Temporarily accesses the tab where you opened JobClock so it can identify the active page.",
  },
  {
    name: "scripting",
    purpose:
      "Runs the packaged JobClock extractor on that active tab to read job details.",
  },
  {
    name: "storage",
    purpose:
      "Stores your extension token and short-lived popup state locally in Chrome.",
  },
  {
    name: "Access to jobclock.michaelogunjimi.com",
    purpose:
      "Allows API requests only to jobclock.michaelogunjimi.com for previews, saves, and stage updates.",
  },
]

export default function ExtensionPrivacyPage() {
  return (
    <PublicExtensionPage
      kicker="Extension privacy"
      title="JobClock extension privacy"
      lede="This policy describes the data handled by the JobClock Chrome extension, when access happens, and the controls available to you."
      updatedAt="12 June 2026"
    >
      <PolicySection title="Single purpose" kicker="01">
        <p>
          The JobClock extension helps a signed-in JobClock user preview the
          active job listing, save it to their application pipeline, and update
          stages for recent applications. It does not collect page content in
          the background.
        </p>
      </PolicySection>

      <PolicySection title="What the extension accesses" kicker="02">
        <p>
          Page access happens only when you open the extension on a normal HTTP
          or HTTPS page. It may read the active page URL and title, plus visible
          or structured job details such as the job title, company, location,
          salary, and description.
        </p>
        <p>
          The extension also handles your personal extension token, recent
          applications returned from your JobClock account, and application
          stage changes that you explicitly submit.
        </p>
      </PolicySection>

      <PolicySection title="Storage and transfer" kicker="03">
        <p>
          Your extension token and transient popup state are stored locally in
          Chrome using <code>chrome.storage.local</code>. The extension does not
          expose an editable server address.
        </p>
        <p>
          The token, active page URL and title, and extracted job content are
          sent over HTTPS only to jobclock.michaelogunjimi.com. The extension
          itself does not send this information directly to other domains.
        </p>
        <p>
          The JobClock service may send relevant job content to your
          user-configured AI provider to turn the page into a structured
          preview. Those providers process data under their own terms and your
          account configuration.
        </p>
      </PolicySection>

      <PolicySection title="Retention and your controls" kicker="04">
        <p>
          Opening a preview does not add the job to your account. Job
          information is persisted to your JobClock account only after you
          select Save to JobClock.
        </p>
        <p>
          Saved application data remains in your account until you update or
          delete it. You can delete saved applications in JobClock, and you can
          use <strong>Revoke Token</strong> in JobClock settings to stop an
          existing extension token from authorizing future requests. Remove or
          replace the token in the extension to clear the locally stored
          credential.
        </p>
      </PolicySection>

      <PolicySection title="Sale and advertising" kicker="05">
        <p>
          Extension data is not sold or used for advertising. It is used to
          provide the preview, save, recent-application, and stage-update
          features requested by the user.
        </p>
      </PolicySection>

      <Card>
        <CardHeader className="border-b">
          <p className="page-kicker">06 · Permissions</p>
          <CardTitle>Why Chrome permissions are needed</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2">
          {permissions.map((permission) => (
            <div key={permission.name} className="bg-card p-6">
              <h2 className="font-mono text-sm font-semibold">
                {permission.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {permission.purpose}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <PolicySection title="Contact" kicker="07">
        <p>
          JobClock is published by Michael Ogunjimi. Questions about this
          policy or the extension can be sent to{" "}
          <a
            className="font-medium text-foreground underline underline-offset-4"
            href="mailto:michael_ogunjimi@yahoo.com"
          >
            michael_ogunjimi@yahoo.com
          </a>
          , or raised through the public JobClock support page.
        </p>
      </PolicySection>
    </PublicExtensionPage>
  )
}

function PolicySection({
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
