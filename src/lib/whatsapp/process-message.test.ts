import { describe, expect, it } from "vitest"
import { extractFirstJobUrl } from "@/lib/jobs/extract-job-url"
import { extractWhatsAppPairingCode } from "./process-message"

describe("WhatsApp commands", () => {
  it("recognizes the prepared account-pairing message", () => {
    expect(extractWhatsAppPairingCode("Connect JobClock: 2345ABCD")).toBe("2345ABCD")
    expect(extractWhatsAppPairingCode("hello")).toBeNull()
  })

  it("extracts a shared job URL and removes message punctuation", () => {
    expect(extractFirstJobUrl("Take a look https://jobs.example.com/role?id=12)."))
      .toBe("https://jobs.example.com/role?id=12")
  })
})
