import { beforeEach, describe, expect, it, vi } from "vitest"
import { PgDialect } from "drizzle-orm/pg-core"

const mocks = vi.hoisted(() => {
  const state = { wheres: [] as unknown[], returned: [{ id: "u1" }] as unknown[], throws: false }
  const chain: Record<string, unknown> = {}
  chain.set = (values: unknown) => ((chain.values = values), chain)
  chain.where = (clause: unknown) => (state.wheres.push(clause), chain)
  chain.returning = () => (state.throws ? Promise.reject(new Error("db down")) : Promise.resolve(state.returned))
  return { state, chain, getUser: vi.fn(), limit: vi.fn(), configured: vi.fn() }
})
vi.mock("@/lib/db", () => ({ db: { update: () => mocks.chain } }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock("@/lib/rate-limit", () => ({ timezoneRateLimit: { limit: mocks.limit } }))

import { captureBrowserTimezone } from "./timezone-actions"

describe("captureBrowserTimezone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.state.wheres.length = 0
    mocks.state.returned = [{ id: "u1" }]
    mocks.state.throws = false
    mocks.configured.mockReturnValue(true)
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mocks.limit.mockResolvedValue({ success: true })
  })

  it("saves the zone only where the profile has none", async () => {
    expect(await captureBrowserTimezone("Europe/London")).toBe(true)
    const sql = new PgDialect().sqlToQuery(mocks.state.wheres[0] as never)
    expect(sql.sql).toContain('"profiles"."id" =')
    expect(sql.sql).toContain('"profiles"."timezone" is null')
    expect(sql.params).toEqual(["u1"])
    expect(mocks.chain.values).toEqual({ timezone: "Europe/London" })
    expect(mocks.limit).toHaveBeenCalledWith("u1")
  })

  it("does nothing when a zone was already saved", async () => {
    mocks.state.returned = []
    expect(await captureBrowserTimezone("Europe/London")).toBe(false)
  })

  it("rejects an invalid zone before touching auth or the database", async () => {
    expect(await captureBrowserTimezone("Mars/Olympus")).toBe(false)
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.state.wheres).toHaveLength(0)
  })

  it("does nothing for a signed-out visitor or when rate limited", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect(await captureBrowserTimezone("Europe/London")).toBe(false)

    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    mocks.limit.mockResolvedValue({ success: false })
    expect(await captureBrowserTimezone("Europe/London")).toBe(false)
    expect(mocks.state.wheres).toHaveLength(0)
  })

  it("never throws: a database failure is swallowed", async () => {
    mocks.state.throws = true
    expect(await captureBrowserTimezone("Europe/London")).toBe(false)
  })
})
