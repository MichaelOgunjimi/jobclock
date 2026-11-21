import { describe, expect, it } from "vitest"
import {
  CONNECTION_DURATION_OPTIONS,
  DEFAULT_CONNECTION_DURATION,
  DEFAULT_TOKEN_ACCESS,
  DEFAULT_TOKEN_EXPIRY,
  describeAccess,
  describeExpiry,
  EXTRA_SCOPE_OPTIONS,
  extraScopeOptions,
  parseExtraScopes,
  parseTokenAccess,
  resolveExpiry,
  scopeLabel,
  TOKEN_EXPIRY_OPTIONS,
  tokenScopes,
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

describe("delete and AI-generation scope choices", () => {
  const delete_ = EXTRA_SCOPE_OPTIONS.find((option) => option.scope === "applications:delete")!
  const generate = EXTRA_SCOPE_OPTIONS.find((option) => option.scope === "ai:generate")!

  it("are separate opt-ins in the power group, in plain words", () => {
    expect([delete_.group, generate.group]).toEqual(["power", "power"])
    expect(delete_.description).toMatch(/Permanently delete applications/)
    expect(delete_.description).toMatch(/cannot be undone/)
    expect(generate.description).toMatch(/Use your AI credits \(generate CVs, cover letters, research, interview prep\)/)
    expect(EXTRA_SCOPE_OPTIONS.filter((option) => option.group === "private").map((option) => option.scope)).toEqual(["profile:read", "interview:read", "profile:write"])
  })

  it("parseExtraScopes accepts them, in a fixed order, and still rejects anything unknown or repeated", () => {
    expect(parseExtraScopes(["ai:generate", "applications:delete"])).toEqual(["applications:delete", "ai:generate"])
    expect(parseExtraScopes(["ai:generate", "ai:generate"])).toBeNull()
    expect(parseExtraScopes(["applications:delete", "admin"])).toBeNull()
    expect(parseExtraScopes(["applications:*"])).toBeNull()
    expect(parseExtraScopes([])).toEqual([])
  })

  it("a token holds them only when passed: never from write, never by default", () => {
    for (const access of ["read", "write"] as const) {
      expect(tokenScopes(access)).not.toContain("applications:delete")
      expect(tokenScopes(access)).not.toContain("ai:generate")
    }
    expect(tokenScopes("write", ["applications:delete"])).toEqual(["applications:read", "applications:write", "applications:delete"])
    expect(tokenScopes("read", ["ai:generate"])).toEqual(["applications:read", "ai:generate"])
  })

  it("badges and the security email name them, loudly", () => {
    expect(extraScopeOptions(["applications:read", "applications:delete", "ai:generate"]).map((option) => option.label)).toEqual(["Delete applications", "Use AI credits"])
    expect(describeAccess(["applications:read", "applications:write", "applications:delete"])).toMatch(/permanently delete your applications/i)
    expect(describeAccess(["applications:read", "ai:generate"])).toMatch(/use your AI credits/i)
    expect(describeAccess(["applications:read", "applications:write"])).not.toMatch(/delete|credits/i)
  })
})

describe("private-data scope choices", () => {
  it("offers profile, interview and profile-write as three separate options with plain words", () => {
    expect(EXTRA_SCOPE_OPTIONS.map((option) => option.scope)).toEqual(["profile:read", "interview:read", "profile:write", "applications:delete", "ai:generate"])
    expect(EXTRA_SCOPE_OPTIONS.map((option) => option.description).join(" ")).toMatch(/full text of your CVs/)
    expect(EXTRA_SCOPE_OPTIONS.map((option) => option.description).join(" ")).toMatch(/interview stories and notes about yourself/)
    expect(EXTRA_SCOPE_OPTIONS[2].description).toMatch(/never delete any of that/)
  })

  it("a new token holds the applications scopes alone by default, and the private ones only when chosen", () => {
    expect(tokenScopes("read")).toEqual(["applications:read"])
    expect(tokenScopes("write")).toEqual(["applications:read", "applications:write"])
    expect(tokenScopes("read", ["profile:read"])).toEqual(["applications:read", "profile:read"])
    expect(tokenScopes("write", ["profile:write", "interview:read"])).toEqual(["applications:read", "applications:write", "interview:read", "profile:write"])
  })

  it("no applications choice implies a private scope", () => {
    for (const access of ["read", "write"] as const) expect(tokenScopes(access).filter((scope) => !scope.startsWith("applications:"))).toEqual([])
  })

  it.each([[undefined, []], [null, []], [[], []], [["profile:read"], ["profile:read"]], [["profile:write", "profile:read"], ["profile:read", "profile:write"]]])("parses %j", (value, expected) => {
    expect(parseExtraScopes(value)).toEqual(expected)
  })

  it.each([["profile:read"], ["admin"], [["applications:write"]], [["profile:read", "profile:read"]], [["profile:read", "admin"]], [[1]], [{}], [["profile:read", "interview:read", "profile:write", "x"]]])("rejects %j instead of ignoring it", (value) => {
    expect(parseExtraScopes(value)).toBeNull()
  })

  it("lists the private scopes a connection holds, in plain words", () => {
    expect(extraScopeOptions(["applications:read", "applications:write"])).toEqual([])
    expect(extraScopeOptions(["applications:read", "interview:read"]).map((option) => option.label)).toEqual(["Interview material"])
  })

  it("describes access for the security email: unchanged for applications-only, with the private scopes named otherwise", () => {
    expect(describeAccess(["applications:read"])).toBe("read only")
    expect(describeAccess(["applications:read", "applications:write"])).toBe("read and change")
    expect(describeAccess(["applications:read", "profile:read", "profile:write"])).toBe("read only for applications; also read your profile, contact details and CVs; change your profile and interview material")
  })
})
