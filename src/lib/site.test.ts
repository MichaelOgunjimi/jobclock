import { afterEach, describe, expect, it, vi } from "vitest"
import { EXTENSION_HOSTS, getAppUrl, getSiteHost, isProductionSite } from "./site"

afterEach(() => vi.unstubAllEnvs())

describe("getAppUrl", () => {
  it("returns NEXT_PUBLIC_APP_URL without trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.dev//")
    expect(getAppUrl()).toBe("https://jobclock.dev")
    expect(getSiteHost()).toBe("jobclock.dev")
  })
  it("falls back to localhost outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NODE_ENV", "development")
    expect(getAppUrl()).toBe("http://localhost:3000")
  })
  it("throws in production when it is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
  })
})

describe("isProductionSite", () => {
  it("is true for APP_ENV=production, or Vercel production when APP_ENV is unset", () => {
    vi.stubEnv("APP_ENV", "production")
    expect(isProductionSite()).toBe(true)
    vi.stubEnv("APP_ENV", "")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isProductionSite()).toBe(true)
  })
  it("is false for staging even though it is Vercel's production target", () => {
    vi.stubEnv("APP_ENV", "staging")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isProductionSite()).toBe(false)
  })
  it("is false for previews and local development", () => {
    vi.stubEnv("APP_ENV", "")
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(isProductionSite()).toBe(false)
    vi.stubEnv("VERCEL_ENV", "")
    expect(isProductionSite()).toBe(false)
  })
})

describe("EXTENSION_HOSTS", () => {
  it("lists the new host first and the legacy host second", () => {
    expect(EXTENSION_HOSTS).toEqual(["jobclock.dev", "jobclock.michaelogunjimi.com"])
  })
})
