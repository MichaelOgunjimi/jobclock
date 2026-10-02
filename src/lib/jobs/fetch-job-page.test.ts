import { describe, expect, it } from "vitest"
import { extractJobPage, isPrivateNetworkAddress } from "./fetch-job-page"

describe("job page fetching helpers", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects private address %s", (address) => {
    expect(isPrivateNetworkAddress(address)).toBe(true)
  })

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPrivateNetworkAddress(address)).toBe(false)
    }
  )

  it("extracts schema.org JobPosting data into import hints", () => {
    const html = `
      <html><head><title>Fallback title</title>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior Product Engineer",
        "description": "<p>Build useful products &amp; lead delivery.</p>",
        "hiringOrganization": { "name": "Acme Ltd" },
        "jobLocation": { "address": { "addressLocality": "London", "addressCountry": "GB" } },
        "baseSalary": { "currency": "GBP", "value": { "minValue": "70000", "maxValue": "90000" } }
      }
      </script></head><body><h1>Senior Product Engineer</h1><p>Apply today.</p></body></html>
    `

    expect(extractJobPage(html)).toMatchObject({
      pageTitle: "Senior Product Engineer",
      pageHints: {
        title: "Senior Product Engineer",
        company: "Acme Ltd",
        location: "London, GB",
        description: "Build useful products & lead delivery.",
        salaryText: "GBP 70000-90000",
      },
    })
  })
})

