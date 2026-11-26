import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getClaims = vi.fn()

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }))
vi.mock("./config", () => ({
  getSupabaseConfig: () => ({ url: "https://x.supabase.co", anonKey: "anon" }),
  getSupabaseSetupHint: () => "setup",
}))
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
// react's per-request cache() is a no-op outside a request, so each call re-reads the claims.
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), cache: <T,>(fn: T) => fn }))

import { getCurrentUser } from "./server"

describe("getCurrentUser", () => {
  beforeEach(() => getClaims.mockReset())

  it("returns the verified subject and email", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email: "a@b.co" } }, error: null })
    await expect(getCurrentUser()).resolves.toEqual({ id: "user-1", email: "a@b.co" })
  })

  it("returns null when the token is missing or fails verification", async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    await expect(getCurrentUser()).resolves.toBeNull()
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid JWT") })
    await expect(getCurrentUser()).resolves.toBeNull()
    getClaims.mockResolvedValue({ data: { claims: {} }, error: null })
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it("works without the Auth server (the mocked client has no getUser) and tolerates a missing email", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null })
    await expect(getCurrentUser()).resolves.toEqual({ id: "user-1", email: undefined })
  })
})

describe("getCurrentUser callers", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return sourceFiles(path)
      return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : []
    })
  }

  // getCurrentUser trusts an unexpired JWT, so it must never gate a mutation or an API response.
  it("is not used by server actions, route handlers or OAuth consent", () => {
    const root = join(process.cwd(), "src")
    const offenders = sourceFiles(root)
      .filter((file) => {
        if (file.endsWith(join("lib", "supabase", "server.ts"))) return false
        const source = readFileSync(file, "utf8")
        if (!/\bgetCurrentUser\b/.test(source)) return false
        const rel = relative(root, file)
        return (
          /(^|\/)(actions|route)\.tsx?$/.test(rel) ||
          rel.startsWith(join("app", "api")) ||
          rel.startsWith(join("app", "oauth")) ||
          /^\s*["']use server["']/.test(source) // file-level directive only; page-inline actions delegate to actions.ts
        )
      })
      .map((file) => relative(root, file))

    expect(offenders).toEqual([])
  })
})
