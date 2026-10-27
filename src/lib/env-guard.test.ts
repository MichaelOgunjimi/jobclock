import { afterEach, describe, expect, it, vi } from "vitest"
import { PRODUCTION_REFS, assertNotProduction, productionRefIn, runtimeEnvProblem } from "./env-guard"

const [PROD] = PRODUCTION_REFS
const prodDb = `postgresql://postgres.${PROD}:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
const prodDirect = `postgresql://postgres:pw@db.${PROD}.supabase.co:5432/postgres`
const stagingDb = "postgresql://postgres.naixebennlljgrfixoqm:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

describe("productionRefIn", () => {
  it("finds the production ref in pooler and direct URLs", () => {
    expect(productionRefIn(prodDb)).toBe(PROD)
    expect(productionRefIn(prodDirect)).toBe(PROD)
  })
  it("ignores other projects and missing values", () => {
    expect(productionRefIn(stagingDb, undefined, "http://127.0.0.1:54322/postgres")).toBeUndefined()
  })
})

describe("assertNotProduction", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("refuses production without the override", () => {
    expect(() => assertNotProduction("db:migrate", prodDb)).toThrow(/PRODUCTION/)
  })
  it("refuses when the override names a different ref", () => {
    vi.stubEnv("ALLOW_PRODUCTION", "somethingelse")
    expect(() => assertNotProduction("db:migrate", prodDirect)).toThrow(/ALLOW_PRODUCTION=/)
  })
  it("allows production only with the exact ref", () => {
    vi.stubEnv("ALLOW_PRODUCTION", PROD)
    expect(() => assertNotProduction("db:migrate", prodDb)).not.toThrow()
  })
  it("allows staging and local without any override", () => {
    expect(() => assertNotProduction("db:migrate", stagingDb, "http://127.0.0.1:54322/postgres")).not.toThrow()
  })
})

describe("runtimeEnvProblem", () => {
  const withProd = { NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }

  it("is fine for production itself, on Vercel or by APP_ENV", () => {
    expect(runtimeEnvProblem({ ...withProd, VERCEL_ENV: "production" } as never)).toBeNull()
    expect(runtimeEnvProblem({ ...withProd, APP_ENV: "production" } as never)).toBeNull()
  })
  it("is an error when local, test, staging or a preview uses the production database", () => {
    for (const env of [{ APP_ENV: "local" }, { APP_ENV: "test" }, { APP_ENV: "staging" }, { VERCEL_ENV: "preview" }]) {
      expect(runtimeEnvProblem({ ...withProd, ...env } as never)?.level).toBe("error")
    }
  })
  it("only warns when APP_ENV is unset, so existing setups keep working", () => {
    expect(runtimeEnvProblem(withProd as never)?.level).toBe("warn")
  })
  it("is fine when no production ref is configured", () => {
    expect(runtimeEnvProblem({ APP_ENV: "staging", DATABASE_URL: stagingDb } as never)).toBeNull()
  })
})
