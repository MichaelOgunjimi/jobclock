import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { expectAllQueriesScopedTo, recorded, resetFakeDb, row, type RecordedQuery } from "./fake-db"
import { MAX_CV_CHARS, MAX_LETTER_CHARS, MAX_PRIVATE_LIST } from "./limits"
import { getCoverLetter, getCv, getProfile, getTailoredCv, listProfileDocuments, parseProfileUpdate, renameCv, setPrimaryCv, updateProfile } from "./profile-tools"
import { runAsConnection } from "./connection-context"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CV1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const CV2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const NOW = new Date("2026-11-20T10:00:00.000Z")

const PROFILE_KEYS = ["fullName", "phone", "linkedinUrl", "githubUrl", "portfolioUrl", "desiredRoles", "locationsUk", "targetSalaryMin", "experienceLevel", "rightToWorkUk"]
const profileRow = (extra: Record<string, unknown> = {}) =>
  row(PROFILE_KEYS, { fullName: "Ada Lovelace", phone: "+44 7700 900000", linkedinUrl: "https://linkedin.com/in/ada", githubUrl: null, portfolioUrl: null, desiredRoles: ["Engineer"], locationsUk: ["London"], targetSalaryMin: "50000", experienceLevel: ["mid"], rightToWorkUk: true, ...extra })

/** Rows only ever go to a query bound to the owner, like the user_id condition does in the database. */
const forOwner = (answer: (query: RecordedQuery) => unknown[][]) => (query: RecordedQuery) => (query.params.includes(OWNER) && !query.params.includes(INTRUDER) ? answer(query) : [])

const insertMetadata = (table: string) => JSON.parse(recorded.find((query) => query.sql.startsWith(`insert into "${table}"`))!.params.find((p) => typeof p === "string" && p.startsWith("{")) as string)
const statements = (pattern: RegExp) => recorded.filter((query) => pattern.test(query.sql))

beforeEach(() => resetFakeDb())

describe("get_profile", () => {
  const seed = () =>
    resetFakeDb(forOwner(() => [row(["email", ...PROFILE_KEYS], { email: "ada@example.com", fullName: "Ada Lovelace", phone: "+44 7700 900000", linkedinUrl: "https://linkedin.com/in/ada", desiredRoles: ["Engineer"], locationsUk: ["London"], targetSalaryMin: "50000", experienceLevel: ["mid"], rightToWorkUk: true })]))

  it("returns the profile the Account and Profile pages show, with the account email", async () => {
    seed()
    const outcome = await getProfile(OWNER)
    expect(outcome).toMatchObject({
      data: {
        email: "ada@example.com",
        full_name: "Ada Lovelace",
        phone: "+44 7700 900000",
        linkedin_url: "https://linkedin.com/in/ada",
        github_url: null,
        desired_roles: ["Engineer"],
        locations: ["London"],
        target_salary_min: 50000,
        experience_levels: ["mid"],
        right_to_work_uk: true,
      },
    })
    expectAllQueriesScopedTo(OWNER)
  })

  it("never selects preferences (AI keys), the avatar, template paths or anything billing", async () => {
    seed()
    await getProfile(OWNER)
    const sql = recorded.map((query) => query.sql).join(" ")
    expect(sql).not.toMatch(/preferences|avatar|template_path|allow_platform_ai_key|billing|stripe/i)
  })

  it("another user's profile is not found", async () => {
    seed()
    expect(await getProfile(INTRUDER)).toEqual({ error: "Profile not found." })
  })
})

describe("get_cv", () => {
  const CV_KEYS = ["id", "name", "isPrimary", "createdAt", "parsedJson", "reviewFindings"]
  const cv = { name: "Ada Lovelace", email: "ada@example.com", phone: "+44 7700 900000", summary: "Engineer", experience: [{ company: "Acme", title: "Dev", description: "Built things", highlights: [" shipped "] }], education: [], skills: ["TypeScript", " "] }
  const seed = (parsedJson: unknown, reviewFindings: unknown = null) =>
    resetFakeDb(forOwner(() => [row(CV_KEYS, { id: CV1, name: "Main CV", isPrimary: true, createdAt: NOW, parsedJson, reviewFindings })]))

  it("returns the whole structured CV with contact details, cleaned like the web app, plus saved review findings", async () => {
    seed(cv, { findings: [{ issue: "Add metrics" }] })
    const outcome = await getCv(OWNER)
    if ("error" in outcome) throw new Error(outcome.error)
    expect(outcome.data).toMatchObject({ id: CV1, name: "Main CV", is_primary: true, has_content: true, truncated: false })
    expect(outcome.data.cv).toMatchObject({ email: "ada@example.com", phone: "+44 7700 900000", skills: ["TypeScript"], review_findings: { findings: [{ issue: "Add metrics" }] } })
    expect((outcome.data.cv as { experience: { highlights: string[] }[] }).experience[0].highlights).toEqual(["shipped"])
    expectAllQueriesScopedTo(OWNER)
  })

  it("picks the primary CV without an id and a given CV with one, always for the owner", async () => {
    seed(cv)
    await getCv(OWNER)
    await getCv(OWNER, CV2)
    expect(recorded[0].sql).toContain('"is_primary" = $')
    expect(recorded[1].params).toContain(CV2)
    expectAllQueriesScopedTo(OWNER)
  })

  it("never selects the uploaded file or its location", async () => {
    seed(cv)
    await getCv(OWNER)
    expect(recorded.map((query) => query.sql).join(" ")).not.toMatch(/file_path|original_file/)
  })

  it("somebody else's CV id, or no CV, is a plain error", async () => {
    seed(cv)
    expect(await getCv(INTRUDER, CV1)).toEqual({ error: "CV not found. Use an id from list_cvs." })
    expect(await getCv(INTRUDER)).toEqual({ error: expect.stringContaining("No primary CV") })
  })

  it("a CV with nothing parsed says so", async () => {
    seed(null)
    expect(await getCv(OWNER)).toMatchObject({ data: { has_content: false } })
  })

  it(`cuts a huge CV to ${MAX_CV_CHARS.toLocaleString("en-GB")} characters, dropping whole entries and saying exactly what was cut`, async () => {
    const huge = { ...cv, summary: "s".repeat(1000), experience: Array.from({ length: 200 }, (_, i) => ({ company: `Co ${i}`, title: "Dev", description: "d".repeat(500), highlights: [] })) }
    seed(huge)
    const outcome = await getCv(OWNER)
    if ("error" in outcome) throw new Error(outcome.error)
    expect(outcome.data).toMatchObject({ truncated: true, omitted: ["experience"] })
    expect(outcome.data.total_characters as number).toBeGreaterThan(MAX_CV_CHARS)
    expect(JSON.stringify(outcome.data.cv).length).toBeLessThanOrEqual(MAX_CV_CHARS)
    const kept = (outcome.data.cv as { experience: unknown[] }).experience
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(200)
  })
})

describe("list_profile_documents", () => {
  const DOC_KEYS = ["type", "name", "issuer", "issuedAt", "expiresAt"]

  it("returns certificate metadata only, never files, paths, sizes or credential ids", async () => {
    resetFakeDb(forOwner(() => [row(DOC_KEYS, { type: "certificate", name: "AWS SAA", issuer: "Amazon", issuedAt: "2025-01-01", expiresAt: null })]))
    const outcome = await listProfileDocuments(OWNER)
    expect(outcome).toMatchObject({ data: { count: 1, truncated: false, documents: [{ type: "certificate", name: "AWS SAA", issuer: "Amazon", issued_at: "2025-01-01", expires_at: null }] } })
    expect(Object.keys((outcome as { data: { documents: object[] } }).data.documents[0]).sort()).toEqual(["expires_at", "issued_at", "issuer", "name", "type"])
    expect(recorded.map((query) => query.sql).join(" ")).not.toMatch(/file_path|mime|file_size|credential/)
    expectAllQueriesScopedTo(OWNER)
  })

  it(`shows at most ${MAX_PRIVATE_LIST} and says there are more`, async () => {
    resetFakeDb(forOwner(() => Array.from({ length: MAX_PRIVATE_LIST + 1 }, (_, i) => row(DOC_KEYS, { type: "certificate", name: `Cert ${i}` }))))
    expect(await listProfileDocuments(OWNER)).toMatchObject({ data: { count: MAX_PRIVATE_LIST, truncated: true } })
  })
})

describe("get_tailored_cv and get_cover_letter", () => {
  const seed = (answer: (query: RecordedQuery) => unknown[][]) =>
    resetFakeDb(({ sql, params }) => {
      if (/from "applications"/.test(sql)) return params.includes(OWNER) && params.includes(APP) ? [[APP]] : []
      return params.includes(OWNER) ? answer({ sql, params }) : []
    })

  it("returns the tailored CV the owner already has, with the ATS score and no PDF location", async () => {
    seed(() => [row(["cvJson", "atsScore", "createdAt"], { cvJson: { name: "Ada", skills: ["TS"], education: [] }, atsScore: 82, createdAt: NOW })])
    const outcome = await getTailoredCv(OWNER, APP)
    expect(outcome).toMatchObject({ data: { has_tailored_cv: true, ats_score: 82, cv: { name: "Ada" }, truncated: false } })
    expect(recorded.map((query) => query.sql).join(" ")).not.toMatch(/pdf_path/)
    expectAllQueriesScopedTo(OWNER)
  })

  it("says plainly when there is none, and never generates one", async () => {
    seed(() => [])
    expect(await getTailoredCv(OWNER, APP)).toEqual({ data: { id: APP, has_tailored_cv: false } })
    expect(await getCoverLetter(OWNER, APP)).toEqual({ data: { id: APP, has_cover_letter: false } })
  })

  it("an application that is not the owner's is 'not found' and its CV and letter are never queried", async () => {
    seed(() => [row(["cvJson"], { cvJson: { name: "Someone else" } })])
    expect(await getTailoredCv(INTRUDER, APP)).toEqual({ error: "Application not found." })
    expect(await getCoverLetter(INTRUDER, APP)).toEqual({ error: "Application not found." })
    expect(recorded.every((query) => /from "applications"/.test(query.sql))).toBe(true)
  })

  it(`cuts a cover letter at ${MAX_LETTER_CHARS.toLocaleString("en-GB")} characters and flags it`, async () => {
    seed(() => [row(["content", "tone", "label", "createdAt"], { content: "x".repeat(MAX_LETTER_CHARS + 500), tone: "formal", label: "v1", createdAt: NOW })])
    const outcome = await getCoverLetter(OWNER, APP)
    if ("error" in outcome) throw new Error(outcome.error)
    expect(outcome.data).toMatchObject({ truncated: true, total_characters: MAX_LETTER_CHARS + 500, tone: "formal" })
    expect((outcome.data.content as string).length).toBe(MAX_LETTER_CHARS)
    expectAllQueriesScopedTo(OWNER)
  })
})

describe("update_profile validation (nothing is written when a value is refused)", () => {
  it.each([
    [{ full_name: "x".repeat(101) }, /full_name is longer than the 100-character limit/],
    [{ phone: "call me" }, /phone can only contain digits/],
    [{ phone: "1".repeat(31) }, /phone is longer than the 30-character limit/],
    [{ linkedin_url: "javascript:alert(1)" }, /linkedin_url must be a web address/],
    [{ github_url: "ftp://example.com/x" }, /github_url must be a web address/],
    [{ portfolio_url: "https://example.com/" + "a".repeat(300) }, /portfolio_url is longer than the 300-character limit/],
    [{ desired_roles: Array.from({ length: 21 }, (_, i) => `Role ${i}`) }, /desired_roles has more than 20 entries/],
    [{ desired_roles: ["ok", " "] }, /empty entry/],
    [{ locations: ["x".repeat(101)] }, /An entry in locations is longer than the 100-character limit/],
    [{ experience_levels: ["wizard"] }, /experience_levels can only contain graduate, junior, mid, senior/],
    [{ target_salary_min: -1 }, /target_salary_min must be a whole number from 0 to 10,000,000/],
    [{ target_salary_min: 50000.5 }, /target_salary_min must be a whole number/],
    [{ target_salary_min: 99_999_999 }, /target_salary_min must be a whole number/],
    [{ full_name: "Ada\u0000" }, /control characters/],
  ])("%j", async (args, message) => {
    resetFakeDb(forOwner(() => [profileRow()]))
    const outcome = await updateProfile(OWNER, args)
    expect(outcome).toEqual({ error: expect.stringMatching(message) })
    expect(recorded).toHaveLength(0)
  })

  it("every limit error says it is a fixed server limit and where it is documented", async () => {
    const outcome = await updateProfile(OWNER, { full_name: "x".repeat(101) })
    expect(outcome).toEqual({ error: expect.stringContaining("docs/mcp-agent-access.md") })
    expect(outcome).toEqual({ error: expect.stringContaining("src/lib/mcp/limits.ts") })
  })

  it("asking for nothing is an error that lists the fields", async () => {
    expect(await updateProfile(OWNER, {})).toEqual({ error: expect.stringContaining("Provide at least one field") })
  })

  it("accepts a normal edit, trims, dedupes and stores no locations as null like the Profile page", () => {
    expect(parseProfileUpdate({ full_name: "  Ada  ", linkedin_url: "linkedin.com/in/ada", desired_roles: ["Engineer", "engineer", " Dev "], locations: [], experience_levels: ["mid", "mid"], target_salary_min: 60000 })).toEqual({
      ok: true,
      value: { fullName: "Ada", linkedinUrl: "linkedin.com/in/ada", desiredRoles: ["Engineer", "Dev"], locationsUk: null, experienceLevel: ["mid"], targetSalaryMin: "60000" },
    })
  })

  it("an empty string or null clears a text field", () => {
    expect(parseProfileUpdate({ phone: "", github_url: null })).toEqual({ ok: true, value: { phone: null, githubUrl: null } })
  })
})

describe("update_profile", () => {
  it("changes only what was sent, returns before and after, and records field names but not the values", async () => {
    resetFakeDb(forOwner(() => [profileRow()]))
    const outcome = await runAsConnection({ kind: "token", id: "tok-1", dailyCreateCap: 100 }, () => updateProfile(OWNER, { phone: "+44 7911 123456", desired_roles: ["Engineer", "Staff Engineer"], right_to_work_uk: true }))
    expect(outcome).toMatchObject({
      data: {
        changed: true,
        before: { phone: "+44 7700 900000", desired_roles: ["Engineer"] },
        after: { phone: "+44 7911 123456", desired_roles: ["Engineer", "Staff Engineer"] },
      },
    })
    // right_to_work_uk was sent but is unchanged, so it is not reported as changed.
    expect(Object.keys((outcome as { data: { after: object } }).data.after).sort()).toEqual(["desired_roles", "phone"])

    const update = statements(/^update "profiles"/)[0]
    expect(update.sql).toContain('"profiles"."id" = $')
    expect(update.sql).not.toMatch(/"email"|"allow_platform_ai_key"|"preferences"|"avatar_url"|"full_name"/)
    expect(update.params).toContain("+44 7911 123456")

    const event = insertMetadata("profile_audit_events")
    expect(event).toEqual({ source: "mcp", connectionKind: "token", connectionId: "tok-1", fields: ["phone", "desired_roles"] })
    expect(JSON.stringify(recorded.filter((query) => /profile_audit_events/.test(query.sql)))).not.toMatch(/7911|Staff Engineer|7700/)
    expectAllQueriesScopedTo(OWNER)
  })

  it("reports a no-op as unchanged and writes nothing", async () => {
    resetFakeDb(forOwner(() => [profileRow()]))
    expect(await updateProfile(OWNER, { phone: "+44 7700 900000" })).toMatchObject({ data: { changed: false } })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })

  it("can clear the salary and set experience levels", async () => {
    resetFakeDb(forOwner(() => [profileRow()]))
    expect(await updateProfile(OWNER, { target_salary_min: null, experience_levels: ["senior"] })).toMatchObject({ data: { before: { target_salary_min: 50000, experience_levels: ["mid"] }, after: { target_salary_min: null, experience_levels: ["senior"] } } })
  })

  it("never touches another user's profile: with the wrong owner there is nothing to update", async () => {
    resetFakeDb(forOwner(() => [profileRow()]))
    expect(await updateProfile(INTRUDER, { phone: "+44 7911 123456" })).toEqual({ error: "Profile not found." })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })

  it("ignores smuggled fields: the email, plan, billing, AI keys and notifications cannot be reached", async () => {
    const smuggled = { email: "x@y.z", preferences: { anthropic_api_key: "k" }, allow_platform_ai_key: true, avatar_url: "https://evil.example/a.png", plan: "pro" }
    expect(parseProfileUpdate(smuggled as never)).toEqual({ ok: true, value: {} })
    resetFakeDb(forOwner(() => [profileRow()]))
    expect(await updateProfile(OWNER, smuggled as never)).toEqual({ error: expect.stringContaining("Provide at least one field") })
    expect(recorded).toHaveLength(0)
  })
})

describe("set_primary_cv and rename_cv", () => {
  const CVS = [row(["id", "name", "isPrimary"], { id: CV1, name: "Old primary", isPrimary: true }), row(["id", "name", "isPrimary"], { id: CV2, name: null, isPrimary: false })]

  it("moves the primary flag the way the Profile page does, returns the previous primary and records only ids", async () => {
    resetFakeDb(forOwner(() => CVS))
    const outcome = await setPrimaryCv(OWNER, CV2)
    expect(outcome).toMatchObject({ data: { changed: true, before: { primary_cv: { id: CV1, name: "Old primary" } }, after: { primary_cv: { id: CV2, name: "Untitled CV" } } } })
    const updates = statements(/^update "user_cvs"/)
    expect(updates).toHaveLength(2)
    expect(updates[0].params).toContain(true)
    expect(updates[1].params).toContain(false)
    expect(insertMetadata("profile_audit_events")).toMatchObject({ cvId: CV2, previousCvId: CV1 })
    expectAllQueriesScopedTo(OWNER)
  })

  it("is a no-op when the CV is already the only primary", async () => {
    resetFakeDb(forOwner(() => CVS))
    expect(await setPrimaryCv(OWNER, CV1)).toMatchObject({ data: { changed: false } })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })

  it("a CV that is not the owner's is not found", async () => {
    resetFakeDb(forOwner(() => CVS))
    expect(await setPrimaryCv(INTRUDER, CV2)).toEqual({ error: "CV not found. Use an id from list_cvs." })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })

  it("renames a CV with before and after, a name length limit, and logs only the length", async () => {
    resetFakeDb(forOwner(() => [row(["name"], { name: "Old name" })]))
    expect(await renameCv(OWNER, CV1, "  Backend CV ")).toMatchObject({ data: { changed: true, before: { name: "Old name" }, after: { name: "Backend CV" } } })
    expect(insertMetadata("profile_audit_events")).toMatchObject({ cvId: CV1, characters: 10 })
    expect(JSON.stringify(recorded.filter((query) => /profile_audit_events/.test(query.sql)))).not.toContain("Backend CV")
    expectAllQueriesScopedTo(OWNER)

    resetFakeDb()
    expect(await renameCv(OWNER, CV1, " ")).toEqual({ error: "name is required." })
    expect(await renameCv(OWNER, CV1, "x".repeat(101))).toEqual({ error: expect.stringContaining("100-character limit") })
    expect(recorded).toHaveLength(0)
  })

  it("renaming somebody else's CV changes nothing", async () => {
    resetFakeDb(forOwner(() => [row(["name"], { name: "Old name" })]))
    expect(await renameCv(INTRUDER, CV1, "Mine now")).toEqual({ error: "CV not found. Use an id from list_cvs." })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })
})
