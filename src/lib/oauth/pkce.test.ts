import { randomBytes } from "crypto"
import { describe, expect, it } from "vitest"
import { s256Challenge, verifyPkce } from "./pkce"

const verifier = randomBytes(32).toString("base64url")

describe("PKCE", () => {
  it("accepts the matching S256 verifier", () => {
    expect(verifyPkce(verifier, s256Challenge(verifier))).toBe(true)
  })

  it("rejects a different verifier", () => {
    expect(verifyPkce(randomBytes(32).toString("base64url"), s256Challenge(verifier))).toBe(false)
  })

  it("rejects `plain`: the verifier is never accepted as the challenge itself", () => {
    expect(verifyPkce(verifier, verifier)).toBe(false)
  })

  it("rejects malformed verifiers and challenges", () => {
    expect(verifyPkce("short", s256Challenge("short"))).toBe(false)
    expect(verifyPkce(`${verifier}!`, s256Challenge(`${verifier}!`))).toBe(false)
    expect(verifyPkce(verifier, "")).toBe(false)
    expect(verifyPkce("", "")).toBe(false)
  })
})
