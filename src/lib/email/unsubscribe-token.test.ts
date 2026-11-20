import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe-token"

const USER = "3f8f6f1e-8a0b-4c1c-9d55-0d9a4b7d2a10"

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_SECRET", "test-secret")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.dev")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("round-trips a category and the all scope", () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(USER, "weekly_digest"))).toEqual({ userId: USER, scope: "weekly_digest" })
    expect(verifyUnsubscribeToken(signUnsubscribeToken(USER, "all"))).toEqual({ userId: USER, scope: "all" })
  })

  it("rejects a changed user, a widened scope, a bad signature and malformed input", () => {
    const token = signUnsubscribeToken(USER, "job_alerts")
    const [, , signature] = token.split(".")
    expect(verifyUnsubscribeToken(`someone-else.job_alerts.${signature}`)).toBeNull()
    expect(verifyUnsubscribeToken(`${USER}.all.${signature}`)).toBeNull()
    expect(verifyUnsubscribeToken(`${token}x`)).toBeNull()
    expect(verifyUnsubscribeToken(`${token}.extra`)).toBeNull()
    expect(verifyUnsubscribeToken(`${USER}.not_a_category.${signature}`)).toBeNull()
    expect(verifyUnsubscribeToken("")).toBeNull()
  })

  it("does not verify under a different secret", () => {
    const token = signUnsubscribeToken(USER, "job_alerts")
    vi.stubEnv("ENCRYPTION_SECRET", "another-secret")
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })

  it("refuses to sign, and verifies nothing, without ENCRYPTION_SECRET", () => {
    const token = signUnsubscribeToken(USER, "job_alerts")
    vi.stubEnv("ENCRYPTION_SECRET", "")
    expect(() => signUnsubscribeToken(USER, "job_alerts")).toThrow("ENCRYPTION_SECRET")
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })

  it("builds a public https link to the unsubscribe route", () => {
    const url = unsubscribeUrl(USER, "job_alerts")
    expect(url.startsWith("https://jobclock.dev/api/email/unsubscribe?t=")).toBe(true)
    expect(verifyUnsubscribeToken(decodeURIComponent(url.split("?t=")[1]))).toEqual({ userId: USER, scope: "job_alerts" })
  })
})
