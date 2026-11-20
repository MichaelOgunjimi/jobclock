import type { Metadata } from "next"
import Link from "next/link"
import { LegalSection, PublicLegalPage } from "@/components/legal/public-legal-page"
import { SUPPORT_EMAIL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach JobClock for support, billing questions, or data requests.",
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return (
    <PublicLegalPage
      kicker="Contact"
      title="Contact JobClock"
      summary="Questions about your account, billing, or your data? Email us and a person will reply."
      updatedAt="19 November 2026"
    >
      <LegalSection number="01" title="Email support">
        <p>
          Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Include the email address on your account and, for a bug, what you were doing when it happened. Never send a password or an extension token.
        </p>
      </LegalSection>

      <LegalSection number="02" title="Response time">
        <p>We reply within 2 working days.</p>
      </LegalSection>

      <LegalSection number="03" title="Policies">
        <p>
          Read the <Link href="/terms">terms of service</Link> and the <Link href="/privacy">privacy policy</Link>. For data-rights requests, see the privacy policy.
        </p>
      </LegalSection>
    </PublicLegalPage>
  )
}
