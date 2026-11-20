import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { apiTokens } from "@/lib/db/schema"
import { expectAllQueriesScopedTo, recorded, resetFakeDb, tableRow } from "./fake-db"
import {
  MAX_ACTIVE_TOKENS_PER_USER,
  authenticateApiToken,
  createApiToken,
  generateRawApiToken,
  hashApiToken,
  listApiTokens,
  revokeApiToken,
} from "./tokens"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"

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
    resetFakeDb(({ sql }) => {
      if (/count\(\*\)/.test(sql)) return [[0]]
      return [tableRow(apiTokens, { id: "t1", userId: USER, label: "Laptop", createdAt: new Date(), tokenPrefix: "jc_abcde", tokenHash: "x" })]
    })

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

  it("caps active tokens per user", async () => {
    resetFakeDb(() => [[MAX_ACTIVE_TOKENS_PER_USER]])
    expect(await createApiToken(USER, "One more")).toHaveProperty("error")
    expect(recorded.some((query) => /^insert/i.test(query.sql))).toBe(false)
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
    resetFakeDb(() => [["t1", USER]])
    expect(await authenticateApiToken(token)).toEqual({ tokenId: "t1", userId: USER })

    const [query] = recorded
    expect(query.sql).toMatch(/^update "api_tokens" set "last_used_at"/)
    expect(query.sql).toMatch(/"revoked_at" is null/)
    expect(query.params).toContain(hashApiToken(token))
    expect(JSON.stringify(recorded)).not.toContain(token)
  })

  it("returns null for an unknown or revoked token (no row matches)", async () => {
    resetFakeDb(() => [])
    expect(await authenticateApiToken(generateRawApiToken())).toBeNull()
  })
})
