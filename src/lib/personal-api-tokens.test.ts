import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db }))

import {
  authenticatePersonalApiToken,
  generatePersonalApiToken,
  getActivePersonalApiTokenMetadata,
  touchPersonalApiToken,
} from "./personal-api-tokens"

describe("personal api tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("generatePersonalApiToken stores only a hash and prefix", async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn(() => ({ where: updateWhere }))
    const returning = vi.fn().mockResolvedValue([{
      id: "token-1",
      userId: "user-1",
      tokenHash: "hash",
      tokenPrefix: "ja_ext_abcd",
      createdAt: new Date("2026-04-23T10:00:00.000Z"),
      lastUsedAt: null,
      revokedAt: null,
    }])
    const values = vi.fn(() => ({ returning }))

    db.update.mockImplementationOnce(() => ({ set: updateSet }))
    db.insert.mockImplementationOnce(() => ({ values }))

    const result = await generatePersonalApiToken("user-1")

    expect(result.token.startsWith("ja_ext_")).toBe(true)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      tokenHash: expect.any(String),
      tokenPrefix: expect.any(String),
    }))

    const insertCall = (values.mock.calls as unknown as Array<
      [{ tokenHash: string; tokenPrefix: string; userId: string }]
    >).at(0)
    expect(insertCall).toBeDefined()
    const inserted = insertCall?.[0]
    expect(inserted).toBeDefined()
    if (!inserted) throw new Error("Expected token insert values")

    expect(inserted.tokenHash).not.toContain(result.token)
    expect(result.token.startsWith(inserted.tokenPrefix)).toBe(true)
  })

  it("authenticatePersonalApiToken returns the token owner", async () => {
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: "token-1", userId: "user-1" }]),
        }),
      }),
    }))

    await expect(authenticatePersonalApiToken("ja_ext_example")).resolves.toEqual({
      tokenId: "token-1",
      userId: "user-1",
    })
  })

  it("getActivePersonalApiTokenMetadata returns the latest active token", async () => {
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: vi.fn().mockResolvedValue([{
              id: "token-1",
              userId: "user-1",
              tokenHash: "hash",
              tokenPrefix: "ja_ext_abcd",
              createdAt: new Date("2026-04-23T10:00:00.000Z"),
              lastUsedAt: new Date("2026-04-23T12:00:00.000Z"),
              revokedAt: null,
            }]),
          }),
        }),
      }),
    }))

    await expect(getActivePersonalApiTokenMetadata("user-1")).resolves.toEqual({
      id: "token-1",
      tokenPrefix: "ja_ext_abcd",
      createdAt: "2026-04-23T10:00:00.000Z",
      lastUsedAt: "2026-04-23T12:00:00.000Z",
    })
  })

  it("touchPersonalApiToken updates the last-used timestamp", async () => {
    const where = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn(() => ({ where }))
    db.update.mockImplementationOnce(() => ({ set }))

    await touchPersonalApiToken("token-1")

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      lastUsedAt: expect.any(Date),
    }))
    expect(where).toHaveBeenCalled()
  })
})
