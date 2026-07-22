import type { Metadata } from "next"
import { LegalSection, PublicLegalPage } from "@/components/legal/public-legal-page"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you create an account or use JobClock.",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <PublicLegalPage
      kicker="Terms"
      title="JobClock terms of service"
      summary="These terms set the ground rules for using JobClock’s website, workspace, and browser extension."
      updatedAt="21 July 2026"
    >
      <LegalSection number="01" title="Agreement and operator">
        <p>
          JobClock is operated by Michael Ogunjimi. By creating an account or using JobClock, you agree to these terms. If you do not agree, do not use the service. Questions can be sent to <a href="mailto:support@jobclock.michaelogunjimi.com">support@jobclock.michaelogunjimi.com</a>.
        </p>
      </LegalSection>

      <LegalSection number="02" title="Accounts and eligibility">
        <p>
          You must provide accurate account information, keep your credentials secure, and promptly report suspected unauthorised access. You are responsible for activity performed through your account. JobClock is not intended for children under 16.
        </p>
      </LegalSection>

      <LegalSection number="03" title="The service">
        <p>
          JobClock helps users find, save, prepare for, and track job applications. Features may include imported listings, CV and cover letter tools, interview preparation, application tracking, and the JobClock browser extension. Features may change as the service evolves.
        </p>
        <p>
          JobClock is a productivity tool, not an employer, recruitment agency, legal adviser, immigration adviser, or guarantor of employment. You must review job listings and generated material before relying on or submitting them.
        </p>
      </LegalSection>

      <LegalSection number="04" title="Your content and provider keys">
        <p>
          You retain ownership of content you upload or create. You grant JobClock the limited permission needed to host, process, transform, and display that content solely to operate the features you request. You confirm that you have the right to provide the content.
        </p>
        <p>
          If you add an OpenAI, Anthropic, Reed, or other provider key, you are responsible for that provider account, its terms, charges, limits, and permitted use. Do not add a credential you are not authorised to use.
        </p>
      </LegalSection>

      <LegalSection number="05" title="Acceptable use">
        <p>You must not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>use JobClock unlawfully, fraudulently, or to infringe another person&apos;s rights;</li>
          <li>upload malicious code or attempt to bypass security, access controls, or usage limits;</li>
          <li>scrape, overload, reverse engineer, or disrupt the service except where applicable law expressly permits it;</li>
          <li>use generated content deceptively or submit information you know is materially false; or</li>
          <li>resell or provide unauthorised access to the service.</li>
        </ul>
      </LegalSection>

      <LegalSection number="06" title="Third-party services and availability">
        <p>
          Job listings, AI providers, authentication, hosting, and other integrations are supplied by third parties. JobClock does not control their availability, accuracy, decisions, or terms. A listing may be outdated, incomplete, or removed, and AI output may contain mistakes.
        </p>
        <p>
          JobClock is provided on an “as available” basis. Maintenance, security work, provider failures, or product changes may interrupt access. Nothing in these terms excludes rights or warranties that applicable consumer law does not allow to be excluded.
        </p>
      </LegalSection>

      <LegalSection number="07" title="Suspension, termination, and liability">
        <p>
          You may stop using JobClock at any time. Access may be suspended or terminated where reasonably necessary to protect users or the service, investigate misuse, comply with law, or address a material breach.
        </p>
        <p>
          To the extent permitted by law, JobClock is not responsible for indirect or consequential losses, lost opportunities, employer decisions, third-party failures, or losses caused by inaccurate job listings or unreviewed generated content. Nothing limits liability where doing so would be unlawful.
        </p>
      </LegalSection>

      <LegalSection number="08" title="Changes and governing law">
        <p>
          These terms may change as JobClock develops. Material changes will be identified by a revised date and, when appropriate, an additional notice. Continued use after an update means the revised terms apply.
        </p>
        <p>
          These terms are governed by the laws of England and Wales, subject to any mandatory rights you have under the law of the country where you live. Courts with jurisdiction under applicable law may hear disputes.
        </p>
      </LegalSection>
    </PublicLegalPage>
  )
}
