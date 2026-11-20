import { describe, expect, it } from "vitest"
import {
  CONNECTION_DURATION_OPTIONS,
  DEFAULT_CONNECTION_DURATION,
  DEFAULT_TOKEN_ACCESS,
  DEFAULT_TOKEN_EXPIRY,
  describeExpiry,
  parseTokenAccess,
  resolveExpiry,
  scopeLabel,
  TOKEN_EXPIRY_OPTIONS,
} from "./access-policy"

const NOW = new Date("2026-11-20T10:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

describe("token expiry choices", () => {
  it("offers 7 days, 30 days, 90 days, 1 year and never, defaulting to 90 days", () => {
    expect(TOKEN_EXPIRY_OPTIONS.map((option) => option.label)).toEqual(["7 days", "30 days", "90 days", "1 year", "Never expires"])
    expect(DEFAULT_TOKEN_EXPIRY).toBe("90")
  })

  it.each([["7", 7], ["30", 30], ["90", 90], ["365", 365]])("%s resolves to now plus %i days", (value, days) => {
    expect(resolveExpiry(TOKEN_EXPIRY_OPTIONS, value, NOW)).toEqual({ ok: true, expiresAt: new Date(NOW.getTime() + days * DAY) })
  })

  it("never resolves to no expiry", () => {
    expect(resolveExpiry(TOKEN_EXPIRY_OPTIONS, "never", NOW)).toEqual({ ok: true, expiresAt: null })
  })

  it.each(["", "0", "1", "-7", "7.5", "forever", " 7", null, undefined, 7, {}])("rejects %j instead of guessing", (value) => {
    expect(resolveExpiry(TOKEN_EXPIRY_OPTIONS, value, NOW)).toEqual({ ok: false })
  })
})

describe("connection duration choices", () => {
  it("offers 30 days, 90 days, 1 year and until revoked, defaulting to 30 days", () => {
    expect(CONNECTION_DURATION_OPTIONS.map((option) => option.label)).toEqual(["30 days", "90 days", "1 year", "Until I revoke it"])
    expect(DEFAULT_CONNECTION_DURATION).toBe("30")
    expect(resolveExpiry(CONNECTION_DURATION_OPTIONS, "forever", NOW)).toEqual({ ok: true, expiresAt: null })
    expect(resolveExpiry(CONNECTION_DURATION_OPTIONS, "never", NOW)).toEqual({ ok: false }) // tokens say never, connections say forever
    expect(resolveExpiry(CONNECTION_DURATION_OPTIONS, "7", NOW)).toEqual({ ok: false })
  })
})

describe("describeExpiry", () => {
  it("says when it never expires", () => {
    expect(describeExpiry(null, NOW)).toEqual({ text: "Never expires", expired: false, daysLeft: null })
  })

  it("shows the date and how many days are left, rounding a part day up", () => {
    expect(describeExpiry(new Date(NOW.getTime() + 83 * DAY - 1000).toISOString(), NOW)).toMatchObject({ text: "Expires 11 Feb 2027 (in 83 days)", expired: false, daysLeft: 83 })
    expect(describeExpiry(new Date(NOW.getTime() + 3600_000).toISOString(), NOW)).toMatchObject({ daysLeft: 1, text: expect.stringContaining("in 1 day)") })
  })

  it("marks a past date as expired", () => {
    expect(describeExpiry(new Date(NOW.getTime() - DAY).toISOString(), NOW)).toEqual({ text: "Expired 19 Nov 2026", expired: true, daysLeft: 0 })
    expect(describeExpiry(NOW.toISOString(), NOW).expired).toBe(true)
  })
})

describe("scopes", () => {
  it("defaults to read only and names the access plainly", () => {
    expect(DEFAULT_TOKEN_ACCESS).toBe("read")
    expect(parseTokenAccess("read")).toBe("read")
    expect(parseTokenAccess("write")).toBe("write")
    expect(parseTokenAccess("admin")).toBeNull()
    expect(scopeLabel(["applications:read"])).toBe("Read only")
    expect(scopeLabel(["applications:read", "applications:write"])).toBe("Read and change")
  })
})
