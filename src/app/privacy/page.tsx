import type { Metadata } from "next"
import Link from "next/link"
import { LegalSection, PublicLegalPage } from "@/components/legal/public-legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How JobClock collects, uses, stores, and protects personal data.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <PublicLegalPage
      kicker="Privacy"
      title="JobClock privacy policy"
      summary="This policy explains what personal data JobClock handles, why it is needed, who processes it, and the choices available to you."
      updatedAt="21 July 2026"
    >
      <LegalSection number="01" title="Who is responsible">
        <p>
          JobClock is operated by Michael Ogunjimi. For privacy questions or requests, email{" "}
          <a href="mailto:support@jobclock.michaelogunjimi.com">support@jobclock.michaelogunjimi.com</a>.
        </p>
      </LegalSection>

      <LegalSection number="02" title="Data JobClock handles">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Account data:</strong> email address, authentication records, and account identifiers.</li>
          <li><strong>Profile and career data:</strong> name, contact details, work history, skills, preferences, CVs, templates, and uploaded files.</li>
          <li><strong>Job-search data:</strong> saved roles, application stages, notes, generated CVs and cover letters, research, and interview material.</li>
          <li><strong>Configuration and credentials:</strong> encrypted AI-provider or job-source API keys and hashed extension tokens.</li>
          <li><strong>Technical and support data:</strong> security logs, page and device information, error details, and messages you send to support.</li>
        </ul>
      </LegalSection>

      <LegalSection number="03" title="How and why data is used">
        <p>
          JobClock uses this data to create and secure your account, provide the workspace and extension, import and organise jobs, generate material you request, troubleshoot problems, prevent abuse, and improve service reliability.
        </p>
        <p>
          Depending on the activity, processing is necessary to provide the service you request, pursue legitimate interests in operating and securing JobClock, comply with legal obligations, or act on your consent where consent is required. JobClock does not sell personal data or use it for behavioural advertising.
        </p>
      </LegalSection>

      <LegalSection number="04" title="Service providers and transfers">
        <p>
          JobClock relies on service providers including Supabase for authentication, database and file storage; Vercel for hosting and privacy-focused web analytics; and Upstash for queued background work. Information may also be sent to the AI provider you configure, such as OpenAI or Anthropic, when you request an AI-assisted feature.
        </p>
        <p>
          These providers may process data outside the United Kingdom. JobClock uses providers subject to their contractual and legal transfer safeguards. Your own AI-provider account remains governed by that provider&apos;s terms and privacy policy.
        </p>
      </LegalSection>

      <LegalSection number="05" title="Storage, security, and retention">
        <p>
          Access is restricted by account authentication and database access controls. Provider API keys are encrypted before storage, and extension tokens are stored as hashes by JobClock. No internet service can guarantee absolute security, so you should also protect your password, mailbox, and provider keys.
        </p>
        <p>
          Account and workspace data is generally retained while your account is active. You can delete individual content where the product provides a delete control, or request account and associated data deletion by email. Limited records may be retained where required for security, dispute resolution, backups, or legal compliance.
        </p>
      </LegalSection>

      <LegalSection number="06" title="Your data rights">
        <p>
          Depending on applicable law, you may ask for access, correction, deletion, restriction, objection, or portability of your personal data, and may withdraw consent where processing relies on consent. Email the support address above to make a request. You may also complain to the UK Information Commissioner&apos;s Office.
        </p>
      </LegalSection>

      <LegalSection number="07" title="Cookies, the extension, and changes">
        <p>
          See the <Link href="/cookies">cookie policy</Link> for browser storage used by the website. The Chrome extension has a separate, more specific <Link href="/extension/privacy">extension privacy policy</Link>.
        </p>
        <p>
          This policy may be updated when the service or legal requirements change. Material updates will be identified by a revised date and, when appropriate, an additional notice.
        </p>
      </LegalSection>
    </PublicLegalPage>
  )
}
