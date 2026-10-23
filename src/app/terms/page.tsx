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
      updatedAt="23 October 2026"
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

      <LegalSection number="07" title="Paid plans, credits, and payments">
        <p>
          JobClock is free to use with your own AI-provider key. JobClock Pro is an optional paid plan, billed monthly or yearly in pounds sterling, that includes a monthly allowance of JobClock AI credits so you do not need a separate provider account. The price, billing period, and credit allowance are shown before you pay. JobClock is not VAT-registered, so no VAT is added to the price shown. Paid plans are currently offered to customers in the United Kingdom.
        </p>
        <p>
          Your subscription renews automatically at the end of each billing period until you cancel. Payments are taken and managed by Stripe, which stores your payment details; JobClock never sees or stores your full card number. Prices may change for future billing periods, and we will give you notice before a change affects you.
        </p>
        <p>
          Each AI action uses a number of credits, shown on the pricing page. Your monthly allowance refreshes each month, and unused allowance does not roll over. You can also buy extra credits: they are used after your monthly allowance, do not expire while your account is open, have no cash value, and cannot be transferred. If a payment fails, JobClock AI credits are paused after a short grace period until the payment is fixed; your data stays in your account, and you can still use JobClock with your own provider key.
        </p>
      </LegalSection>

      <LegalSection number="08" title="Cancellation and refunds">
        <p>
          You can cancel at any time from Settings → Billing. Your plan then stays active until the end of the period you have paid for, after which your account moves to the free plan. Nothing is deleted when you cancel, and you can resume before the period ends.
        </p>
        <p>
          You have 14 days from buying a subscription or a credit pack to ask for a refund. We refund what you paid minus the value of the credits you have used, worked out at the price per credit of what you bought: £12 for 300 credits on the monthly plan (£0.04 a credit), £120 for 3,600 credits across the year on the yearly plan (about £0.033 a credit), and the pack price divided by the pack size for extra credits. For example, if you used 50 credits of a monthly plan, you would get £10 back. If you have used none, you get everything back. After the 14 days we do not offer refunds, apart from where the law requires it or where a charge was made in error. Contact <a href="mailto:support@jobclock.michaelogunjimi.com">support@jobclock.michaelogunjimi.com</a> with the email address on your account.
        </p>
        <p>
          Nothing in this section affects your statutory rights, including your rights if the service is not as described or is not provided with reasonable care and skill.
        </p>
      </LegalSection>

      <LegalSection number="09" title="Suspension, termination, and liability">
        <p>
          You may stop using JobClock at any time. Access may be suspended or terminated where reasonably necessary to protect users or the service, investigate misuse, comply with law, or address a material breach.
        </p>
        <p>
          To the extent permitted by law, JobClock is not responsible for indirect or consequential losses, lost opportunities, employer decisions, third-party failures, or losses caused by inaccurate job listings or unreviewed generated content. Nothing limits liability where doing so would be unlawful.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Changes and governing law">
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
