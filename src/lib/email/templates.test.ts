import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { escapeHtml, jobAlertEmail, paymentFailedEmail, subscriptionEndedEmail } from "./templates"

const job = (overrides: Partial<PersistedJobInput> = {}) =>
  ({ title: "Engineer", company: "Acme", location: "London", url: "https://acme.example/jobs/1", ...overrides }) as PersistedJobInput

describe("email templates", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.dev"))

  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<b>"A" & B</b>`)).toBe("&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;")
  })

  it("renders billing emails with a billing link in both html and text", () => {
    for (const email of [paymentFailedEmail(), subscriptionEndedEmail()]) {
      expect(email.html).toContain('href="https://jobclock.dev/settings?tab=billing"')
      expect(email.html).toContain("support@jobclock.dev")
      expect(email.text).toContain("https://jobclock.dev/settings?tab=billing")
    }
    expect(paymentFailedEmail().subject).toBe("Your JobClock payment did not go through")
    expect(subscriptionEndedEmail().subject).toBe("Your JobClock Pro subscription has ended")
  })

  it("escapes job fields and never links to a non-http url", () => {
    const email = jobAlertEmail([job({ title: `<script>alert(1)</script>`, url: "javascript:alert(1)" })])
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;script&gt;")
    expect(email.html).not.toContain("javascript:")
    expect(email.html).toContain('href="https://jobclock.dev"')
  })

  it("pluralises the subject and caps the list at ten with an overflow note", () => {
    expect(jobAlertEmail([job()]).subject).toBe("1 new job at the companies you track")
    const many = jobAlertEmail(Array.from({ length: 12 }, (_, i) => job({ title: `Role ${i}` })))
    expect(many.subject).toBe("12 new jobs at the companies you track")
    expect(many.html).toContain("Role 9")
    expect(many.html).not.toContain("Role 10")
    expect(many.html).toContain("+ 2 more roles")
  })
})
