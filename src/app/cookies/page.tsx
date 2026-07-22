import type { Metadata } from "next"
import { LegalSection, PublicLegalPage } from "@/components/legal/public-legal-page"

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The cookies and similar browser storage technologies used by JobClock.",
  alternates: { canonical: "/cookies" },
}

export default function CookiePolicyPage() {
  return (
    <PublicLegalPage
      kicker="Cookies"
      title="JobClock cookie policy"
      summary="JobClock uses limited browser storage for sign-in, security, and interface preferences. It does not use advertising cookies."
      updatedAt="21 July 2026"
    >
      <LegalSection number="01" title="What this policy covers">
        <p>Cookies are small values stored by a browser. Similar technologies, including local storage, can remember information on a device. This policy explains how JobClock uses both.</p>
      </LegalSection>

      <LegalSection number="02" title="Essential authentication cookies">
        <p>
          JobClock uses Supabase authentication cookies to maintain your signed-in session, refresh access securely, and protect account-only pages. Their names may vary by Supabase project and token format. These cookies are necessary for the account service you request and expire or rotate in line with the authentication session.
        </p>
      </LegalSection>

      <LegalSection number="03" title="Preference storage">
        <p>
          The <code>job-assistant-theme</code> preference is stored in a cookie and local storage so JobClock can remember light or dark appearance. The cookie lasts up to one year unless you remove it sooner.
        </p>
        <p>
          JobClock may also use local storage for interface preferences such as sidebar state or analytics-view layout. These values stay on your device until the application or you remove them. They are not used for advertising or cross-site tracking.
        </p>
      </LegalSection>

      <LegalSection number="04" title="Cookie-free web analytics">
        <p>
          JobClock uses Vercel Web Analytics to understand aggregate page usage. Vercel states that this service does not use cookies and identifies a visitor using a daily-changing hash rather than a persistent personal identifier. JobClock does not configure analytics events to include CV content, provider keys, extension tokens, or other workspace data.
        </p>
      </LegalSection>

      <LegalSection number="05" title="Consent and browser controls">
        <p>
          JobClock currently does not set advertising cookies or non-essential analytics cookies, so it does not display a cookie-consent banner. If non-essential storage is introduced, JobClock will request consent before using it where required.
        </p>
        <p>
          You can inspect or remove cookies and local storage through your browser settings. Blocking authentication cookies will prevent sign-in and account features, while removing preference storage will reset the related interface choices.
        </p>
      </LegalSection>

      <LegalSection number="06" title="Contact and updates">
        <p>
          Questions can be sent to <a href="mailto:support@jobclock.michaelogunjimi.com">support@jobclock.michaelogunjimi.com</a>. This policy will be updated if JobClock changes the browser storage or analytics technologies it uses.
        </p>
      </LegalSection>
    </PublicLegalPage>
  )
}
