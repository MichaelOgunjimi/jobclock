import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { apiTokens } from "@/lib/db/schema"
import { expectAllQueriesScopedTo, recorded, resetFakeDb, tableRow } from "./fake-db"
import {
  authenticateApiToken,
  createApiToken,
  generateRawApiToken,
  hashApiToken,
  LIMIT_ERRORS,
  listApiTokens,
  parseLimit,
  revokeApiToken,
  setApiTokenDailyCap,
} from "./tokens"
import { MAX_DAILY_CREATE_CAP, MAX_DAILY_CREDIT_CAP, MAX_DAILY_DELETE_CAP } from "./limits"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"

describe("owner-chosen limits (parseLimit)", () => {
  it("daily deletions: whole numbers from 0 (switched off) up to the maximum; null is not an option", () => {
    expect(parseLimit("delete", 0)).toBe(0)
    expect(parseLimit("delete", 10)).toBe(10)
    expect(parseLimit("delete", MAX_DAILY_DELETE_CAP)).toBe(MAX_DAILY_DELETE_CAP)
    for (const bad of [-1, 1.5, MAX_DAILY_DELETE_CAP + 1, null, "5", NaN, undefined]) expect(parseLimit("delete", bad), String(bad)).toBeUndefined()
  })

  it("daily credits: null is the explicit no-limit choice, 0 means generation off, and the rest are whole numbers up to the maximum", () => {
    expect(parseLimit("credit", null)).toBeNull()
    expect(parseLimit("credit", 0)).toBe(0)
    expect(parseLimit("credit", 20)).toBe(20)
    expect(parseLimit("credit", MAX_DAILY_CREDIT_CAP)).toBe(MAX_DAILY_CREDIT_CAP)
    for (const bad of [-1, 2.5, MAX_DAILY_CREDIT_CAP + 1, "20", undefined]) expect(parseLimit("credit", bad), String(bad)).toBeUndefined()
  })

  it("daily creations: unchanged (0 = unlimited), and null is not accepted", () => {
    expect(parseLimit("create", 0)).toBe(0)
    expect(parseLimit("create", null)).toBeUndefined()
    expect(parseLimit("create", MAX_DAILY_CREATE_CAP + 1)).toBeUndefined()
  })

  it("every kind has an error that says what 0 means", () => {
    expect(LIMIT_ERRORS.delete).toMatch(/0 switches deleting off/)
    expect(LIMIT_ERRORS.credit).toMatch(/0 switches AI generation off/)
    expect(LIMIT_ERRORS.credit).toMatch(/no limit/)
  })
})

describe("api token generation", () => {
  it("makes unique jc_ tokens with at least 256 bits of entropy", () => {
    const a = generateRawApiToken()
    expect(a).toMatch(/^jc_[A-Za-z0-9_-]{43}$/)
    expect(generateRawApiToken()).not.toBe(a)
  })

  it("hashes with SHA-256 (hex), deterministically", () => {
    expect(hashApiToken("jc_abc")).toBe(hashApiToken("jc_abc"))
    expect(hashApiToken("jc_abc")).toMatch(/^[0-9a-f]{64}$/)
    expect(hashApiToken("jc_abc")).not.toBe(hashApiToken("jc_abd"))
  })
})

describe("createApiToken", () => {
  beforeEach(() => resetFakeDb())

  it("stores only the hash and a short prefix, never the plaintext, and returns the token once", async () => {
    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "Laptop", createdAt: new Date(), tokenPrefix: "jc_abcde", tokenHash: "x", scopes: ["applications:read"], dailyCreateCap: 100 })])

    const result = await createApiToken(USER, "  Laptop ")
    if ("error" in result) throw new Error(result.error)

    const insert = recorded.find((query) => /^insert/i.test(query.sql))!
    expect(insert.params).toContain(hashApiToken(result.token))
    expect(insert.params).toContain("Laptop")
    expect(insert.params).toContain(result.token.slice(0, 8))
    expect(JSON.stringify(recorded)).not.toContain(result.token)
    expect(result.token).toMatch(/^jc_/)
    expect(JSON.stringify(result.metadata)).not.toContain(result.token)
    expectAllQueriesScopedTo(USER)
  })

  it("rejects an empty or over-long label without touching the database", async () => {
    expect(await createApiToken(USER, "   ")).toHaveProperty("error")
    expect(await createApiToken(USER, "x".repeat(61))).toHaveProperty("error")
    expect(recorded).toHaveLength(0)
  })

  it("has no cap on how many tokens you can have (only you can create them, signed in)", async () => {
    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "Eleventh", createdAt: new Date(), tokenPrefix: "jc_abcde", tokenHash: "x", scopes: ["applications:read"], dailyCreateCap: 100 })])
    expect(await createApiToken(USER, "Eleventh")).toHaveProperty("token")
    expect(recorded.some((query) => /count\(\*\)/.test(query.sql))).toBe(false)
  })

  it("stores the chosen scopes, expiry and daily limit, defaulting to read only for 90 days", async () => {
    const now = new Date("2026-11-20T10:00:00.000Z")
    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "L", createdAt: now, tokenPrefix: "jc_abcde", tokenHash: "x", scopes: ["applications:read"], dailyCreateCap: 100 })])
    await createApiToken(USER, "Default", {}, now)
    const [defaults] = recorded.filter((query) => /^insert/i.test(query.sql))
    expect(defaults.params).toContain('{"applications:read"}')
    expect(defaults.params).toContain("2027-02-18T10:00:00.000Z")
    expect(defaults.params).toContain(100)

    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "L", createdAt: now, tokenPrefix: "jc_abcde", tokenHash: "x", scopes: ["applications:read", "applications:write"], dailyCreateCap: 0 })])
    await createApiToken(USER, "Full", { access: "write", expiry: "never", dailyCreateCap: 0 }, now)
    const [chosen] = recorded.filter((query) => /^insert/i.test(query.sql))
    expect(chosen.params).toContain('{"applications:read","applications:write"}')
    expect(chosen.params).toContain(null) // never expires
    expect(chosen.params).toContain(0)
  })

  it("stores the private scopes only when they were chosen, after the applications ones", async () => {
    const now = new Date("2026-11-20T10:00:00.000Z")
    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "L", createdAt: now, tokenPrefix: "jc_abcde", tokenHash: "x", scopes: ["applications:read", "profile:read", "profile:write"], dailyCreateCap: 100 })])
    await createApiToken(USER, "Private", { access: "read", extraScopes: ["profile:read", "profile:write"] }, now)
    const [insert] = recorded.filter((query) => /^insert/i.test(query.sql))
    expect(insert.params).toContain('{"applications:read","profile:read","profile:write"}')

    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "L", createdAt: now, tokenPrefix: "jc_abcde", tokenHash: "x", scopes: ["applications:read"], dailyCreateCap: 100 })])
    await createApiToken(USER, "Plain", { access: "read" }, now)
    expect(recorded.filter((query) => /^insert/i.test(query.sql))[0].params).toContain('{"applications:read"}')
  })

  it("rejects an unknown access, expiry or limit without touching the database", async () => {
    expect(await createApiToken(USER, "x", { access: "admin" as never })).toHaveProperty("error")
    expect(await createApiToken(USER, "x", { expiry: "forever" })).toHaveProperty("error")
    expect(await createApiToken(USER, "x", { expiry: "3" })).toHaveProperty("error")
    expect(await createApiToken(USER, "x", { dailyCreateCap: -1 })).toHaveProperty("error")
    expect(await createApiToken(USER, "x", { dailyCreateCap: 1.5 })).toHaveProperty("error")
    expect(recorded).toHaveLength(0)
  })
})

describe("setApiTokenDailyCap", () => {
  it("is bound to the owner, so another user's token id changes nothing", async () => {
    resetFakeDb(({ params }) => (params.includes(USER) ? [["t1"]] : []))
    expect(await setApiTokenDailyCap(USER, "t1", 7)).toBe(true)
    expectAllQueriesScopedTo(USER)
    resetFakeDb(({ params }) => (params.includes(USER) ? [["t1"]] : []))
    expect(await setApiTokenDailyCap(OTHER, "t1", 7)).toBe(false)
    expectAllQueriesScopedTo(OTHER, [USER])
  })
})

describe("listApiTokens / revokeApiToken", () => {
  beforeEach(() => resetFakeDb())

  it("lists only the owner's tokens and exposes no hash", async () => {
    resetFakeDb(() => [tableRow(apiTokens, { id: "t1", userId: USER, label: "L", tokenHash: "secret-hash", tokenPrefix: "jc_abcde", createdAt: new Date() })])
    const tokens = await listApiTokens(USER)
    expect(tokens).toHaveLength(1)
    expect(JSON.stringify(tokens)).not.toContain("secret-hash")
    expectAllQueriesScopedTo(USER, [OTHER])
  })

  it("revokes by id and owner, so another user's token id revokes nothing", async () => {
    resetFakeDb(({ params }) => (params.includes(USER) ? [["t1"]] : []))
    expect(await revokeApiToken(USER, "t1")).toBe(true)
    expectAllQueriesScopedTo(USER)

    resetFakeDb(({ params }) => (params.includes(USER) ? [["t1"]] : []))
    expect(await revokeApiToken(OTHER, "t1")).toBe(false)
    expectAllQueriesScopedTo(OTHER, [USER])
    expect(recorded[0].sql).toMatch(/"revoked_at" is null/)
  })
})

describe("authenticateApiToken", () => {
  beforeEach(() => resetFakeDb())

  it("rejects anything that is not a jc_ token without a database call", async () => {
    for (const bad of ["", "ja_ext_abc", "Bearer jc_x", "jc_" + "a".repeat(300)]) {
      expect(await authenticateApiToken(bad)).toBeNull()
    }
    expect(recorded).toHaveLength(0)
  })

  it("looks up by hash among non-revoked tokens, stamps last_used_at, and returns the owner", async () => {
    const token = generateRawApiToken()
    resetFakeDb(() => [["t1", USER, ["applications:read"], 100]])
    expect(await authenticateApiToken(token)).toEqual({ tokenId: "t1", userId: USER, scopes: ["applications:read"], dailyCreateCap: 100 })

    const [query] = recorded
    expect(query.sql).toMatch(/^update "api_tokens" set "last_used_at"/)
    expect(query.sql).toMatch(/"revoked_at" is null/)
    expect(query.sql).toMatch(/"expires_at" is null or "api_tokens"."expires_at" > /)
    expect(query.params).toContain(hashApiToken(token))
    expect(JSON.stringify(recorded)).not.toContain(token)
  })

  it("returns null for an unknown or revoked token (no row matches)", async () => {
    resetFakeDb(() => [])
    expect(await authenticateApiToken(generateRawApiToken())).toBeNull()
  })

  it("says a known token has expired, rather than reporting it as unknown", async () => {
    const expiredAt = new Date("2026-11-01T00:00:00.000Z")
    resetFakeDb(({ sql }) => (/^select/i.test(sql) ? [[expiredAt]] : []))
    expect(await authenticateApiToken(generateRawApiToken(), new Date("2026-11-20T00:00:00.000Z"))).toEqual({ expired: true, expiredAt })
  })
})
