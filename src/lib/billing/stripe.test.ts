import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { getBillingOrigin } from "./stripe"

describe("getBillingOrigin", () => {
  beforeEach(() => vi.unstubAllEnvs())

  it("returns Checkout to the exact preview deployment", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("VERCEL_URL", "jobclock-preview.vercel.app")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.michaelogunjimi.com")
    expect(getBillingOrigin()).toBe("https://jobclock-preview.vercel.app")
  })

  it("uses the configured application URL outside preview", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.michaelogunjimi.com/path")
    expect(getBillingOrigin()).toBe("https://jobclock.michaelogunjimi.com")
  })
})
