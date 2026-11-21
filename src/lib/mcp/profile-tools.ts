import { and, desc, eq, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { coverLetters, customizedCvs, profileDocuments, profiles, userCvs } from "@/lib/db/schema"
import { toExternalProfileHref } from "@/app/(dashboard)/account/account-link-utils"
import { sanitizeCvData } from "@/lib/cv-data"
import type { CvData } from "@/lib/supabase/database.types"
import {
  limitMessage,
  MAX_CV_CHARS,
  MAX_LETTER_CHARS,
  MAX_LINK_CHARS,
  MAX_NAME_CHARS,
  MAX_PHONE_CHARS,
  MAX_PRIVATE_LIST,
  MAX_PROFILE_LIST_ITEM_CHARS,
  MAX_PROFILE_LIST_ITEMS,
  MAX_TARGET_SALARY,
  tooLong,
} from "./limits"
import { clip, fitRecord, notFound, ownsApplication, PRIVATE_TEXT_NOTE, recordProfileEvent } from "./private-data"
import { iso, NOT_FOUND, type ToolOutcome } from "./tools"

/**
 * profile:read and profile:write tools. The most private data in the app: contact details and the full text of CVs.
 * Nothing here returns a storage path, signed URL, API key or billing figure, and nothing generates content.
 */

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<ToolOutcome> {
  const [profile] = await db
    .select({
      email: profiles.email,
      fullName: profiles.fullName,
      phone: profiles.phone,
      linkedinUrl: profiles.linkedinUrl,
      githubUrl: profiles.githubUrl,
      portfolioUrl: profiles.portfolioUrl,
      desiredRoles: profiles.desiredRoles,
      locationsUk: profiles.locationsUk,
      targetSalaryMin: profiles.targetSalaryMin,
      experienceLevel: profiles.experienceLevel,
      rightToWorkUk: profiles.rightToWorkUk,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)
  if (!profile) return notFound("Profile")
  return { data: { ...profileView(profile), email: profile.email, note: PRIVATE_TEXT_NOTE } }
}

type ProfileRow = {
  fullName: string | null
  phone: string | null
  linkedinUrl: string | null
  githubUrl: string | null
  portfolioUrl: string | null
  desiredRoles: string[] | null
  locationsUk: string[] | null
  targetSalaryMin: string | null
  experienceLevel: string[] | null
  rightToWorkUk: boolean | null
}

/** The fields update_profile may change, under their tool names. The account email, plan, billing, AI keys and notification settings are not here. */
function profileView(row: ProfileRow) {
  return {
    full_name: row.fullName,
    phone: row.phone,
    linkedin_url: row.linkedinUrl,
    github_url: row.githubUrl,
    portfolio_url: row.portfolioUrl,
    desired_roles: row.desiredRoles ?? [],
    locations: row.locationsUk ?? [],
    target_salary_min: row.targetSalaryMin == null ? null : Number(row.targetSalaryMin),
    experience_levels: row.experienceLevel ?? [],
    right_to_work_uk: row.rightToWorkUk,
  }
}

export async function getCv(userId: string, cvId?: string): Promise<ToolOutcome> {
  const [row] = await db
    .select({ id: userCvs.id, name: userCvs.name, isPrimary: userCvs.isPrimary, createdAt: userCvs.createdAt, parsedJson: userCvs.parsedJson, reviewFindings: userCvs.reviewFindings })
    .from(userCvs)
    .where(and(eq(userCvs.userId, userId), cvId ? eq(userCvs.id, cvId) : eq(userCvs.isPrimary, true)))
    .orderBy(desc(userCvs.createdAt))
    .limit(1)
  if (!row) return { error: cvId ? "CV not found. Use an id from list_cvs." : "No primary CV. Use list_cvs to see the CVs, then pass cv_id." }

  const head = { id: row.id, name: row.name ?? "Untitled CV", is_primary: row.isPrimary ?? false, created_at: iso(row.createdAt) }
  if (!row.parsedJson) return { data: { ...head, has_content: false } }
  const fit = fitRecord({ ...sanitizeCvData(row.parsedJson as CvData), ...(row.reviewFindings ? { review_findings: row.reviewFindings } : {}) }, MAX_CV_CHARS)
  return { data: { ...head, has_content: true, cv: fit.value, truncated: fit.truncated, total_characters: fit.total_characters, ...(fit.omitted.length ? { omitted: fit.omitted } : {}), note: PRIVATE_TEXT_NOTE } }
}

/** Certificates and qualifications as metadata only: never the uploaded file, its path, size or credential id. */
export async function listProfileDocuments(userId: string): Promise<ToolOutcome> {
  const rows = await db
    .select({ type: profileDocuments.type, name: profileDocuments.name, issuer: profileDocuments.issuer, issuedAt: profileDocuments.issuedAt, expiresAt: profileDocuments.expiresAt })
    .from(profileDocuments)
    .where(eq(profileDocuments.userId, userId))
    .orderBy(desc(profileDocuments.createdAt))
    .limit(MAX_PRIVATE_LIST + 1)
  const shown = rows.slice(0, MAX_PRIVATE_LIST)
  return {
    data: {
      count: shown.length,
      truncated: rows.length > shown.length,
      documents: shown.map((row) => ({ type: row.type, name: row.name, issuer: row.issuer, issued_at: row.issuedAt, expires_at: row.expiresAt })),
      note: PRIVATE_TEXT_NOTE,
    },
  }
}

/** Read only: returns the customised CV the owner already generated for this application; never generates one. */
export async function getTailoredCv(userId: string, applicationId: string): Promise<ToolOutcome> {
  if (!(await ownsApplication(userId, applicationId))) return NOT_FOUND
  const [row] = await db
    .select({ cvJson: customizedCvs.cvJson, atsScore: customizedCvs.atsScore, createdAt: customizedCvs.createdAt })
    .from(customizedCvs)
    .where(and(eq(customizedCvs.userId, userId), eq(customizedCvs.applicationId, applicationId)))
    .orderBy(desc(customizedCvs.createdAt))
    .limit(1)
  if (!row?.cvJson) return { data: { id: applicationId, has_tailored_cv: false } }
  const fit = fitRecord({ ...sanitizeCvData(row.cvJson as CvData) }, MAX_CV_CHARS)
  return {
    data: {
      id: applicationId,
      has_tailored_cv: true,
      saved_at: iso(row.createdAt),
      ats_score: row.atsScore,
      cv: fit.value,
      truncated: fit.truncated,
      total_characters: fit.total_characters,
      ...(fit.omitted.length ? { omitted: fit.omitted } : {}),
      note: `Generated from the owner's CV and the job posting. ${PRIVATE_TEXT_NOTE}`,
    },
  }
}

/** Read only: the newest cover letter saved for this application (the one the web app shows); never generates one. */
export async function getCoverLetter(userId: string, applicationId: string): Promise<ToolOutcome> {
  if (!(await ownsApplication(userId, applicationId))) return NOT_FOUND
  const [row] = await db
    .select({ content: coverLetters.content, tone: coverLetters.tone, label: coverLetters.label, createdAt: coverLetters.createdAt })
    .from(coverLetters)
    .where(and(eq(coverLetters.userId, userId), eq(coverLetters.applicationId, applicationId)))
    .orderBy(desc(coverLetters.createdAt))
    .limit(1)
  if (!row) return { data: { id: applicationId, has_cover_letter: false } }
  const letter = clip(row.content, MAX_LETTER_CHARS)
  return {
    data: {
      id: applicationId,
      has_cover_letter: true,
      saved_at: iso(row.createdAt),
      tone: row.tone,
      label: row.label,
      content: letter.text,
      truncated: letter.truncated,
      total_characters: letter.total,
      note: PRIVATE_TEXT_NOTE,
    },
  }
}

// ── Writes (profile:write) ──────────────────────────────────────────────────────────────────────────────────────

const CONTROL = /[\u0000-\u001f\u007f]/
const EXPERIENCE_LEVELS = ["graduate", "junior", "mid", "senior"] as const

export interface ProfileUpdate {
  full_name?: string | null
  phone?: string | null
  linkedin_url?: string | null
  github_url?: string | null
  portfolio_url?: string | null
  desired_roles?: string[]
  locations?: string[]
  target_salary_min?: number | null
  experience_levels?: string[]
  right_to_work_uk?: boolean
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Text or null (empty clears it). */
function parseText(field: string, value: string | null, max: number): Parsed<string | null> {
  const text = (value ?? "").trim()
  if (text.length > max) return fail(tooLong(field, max))
  if (CONTROL.test(text)) return fail(`${field} cannot contain control characters.`)
  return { ok: true, value: text || null }
}

function parseLink(field: string, value: string | null): Parsed<string | null> {
  const text = parseText(field, value, MAX_LINK_CHARS)
  if (!text.ok || text.value === null) return text
  // The same test the Account page uses before it turns the text into a link: http or https only.
  return toExternalProfileHref(text.value) ? text : fail(`${field} must be a web address (http or https), e.g. https://example.com/you.`)
}

function parseList(field: string, value: string[]): Parsed<string[]> {
  if (value.length > MAX_PROFILE_LIST_ITEMS) {
    return fail(limitMessage(`${field} has more than ${MAX_PROFILE_LIST_ITEMS} entries`, "Short lists keep your preferences readable and the job search focused. Send the ones that matter most."))
  }
  const items: string[] = []
  for (const raw of value) {
    const item = raw.trim()
    if (!item) return fail(`${field} cannot contain an empty entry.`)
    if (item.length > MAX_PROFILE_LIST_ITEM_CHARS) return fail(tooLong(`An entry in ${field}`, MAX_PROFILE_LIST_ITEM_CHARS))
    if (CONTROL.test(item)) return fail(`${field} cannot contain control characters.`)
    if (!items.some((existing) => existing.toLowerCase() === item.toLowerCase())) items.push(item)
  }
  return { ok: true, value: items }
}

type ProfileChanges = Partial<Pick<typeof profiles.$inferInsert, "fullName" | "phone" | "linkedinUrl" | "githubUrl" | "portfolioUrl" | "desiredRoles" | "locationsUk" | "targetSalaryMin" | "experienceLevel" | "rightToWorkUk">>

/** Validates what the agent sent. Returns the columns to write, or the first problem. Nothing is written here. */
export function parseProfileUpdate(args: ProfileUpdate): Parsed<ProfileChanges> {
  const changes: ProfileChanges = {}
  const scalar = [
    ["full_name", "fullName", (value: string | null) => parseText("full_name", value, MAX_NAME_CHARS)],
    ["phone", "phone", (value: string | null) => {
      const text = parseText("phone", value, MAX_PHONE_CHARS)
      return text.ok && text.value !== null && !/^[0-9+()\-.\s]{3,}$/.test(text.value) ? fail("phone can only contain digits, spaces and + ( ) - . characters.") : text
    }],
    ["linkedin_url", "linkedinUrl", (value: string | null) => parseLink("linkedin_url", value)],
    ["github_url", "githubUrl", (value: string | null) => parseLink("github_url", value)],
    ["portfolio_url", "portfolioUrl", (value: string | null) => parseLink("portfolio_url", value)],
  ] as const
  for (const [field, column, parse] of scalar) {
    if (args[field] === undefined) continue
    const parsed = parse(args[field] as string | null)
    if (!parsed.ok) return parsed
    changes[column] = parsed.value
  }

  if (args.desired_roles !== undefined) {
    const parsed = parseList("desired_roles", args.desired_roles)
    if (!parsed.ok) return parsed
    changes.desiredRoles = parsed.value
  }
  if (args.locations !== undefined) {
    const parsed = parseList("locations", args.locations)
    if (!parsed.ok) return parsed
    changes.locationsUk = parsed.value.length > 0 ? parsed.value : null // the Profile page stores no locations as null
  }
  if (args.experience_levels !== undefined) {
    const levels = [...new Set(args.experience_levels)]
    if (levels.some((level) => !(EXPERIENCE_LEVELS as readonly string[]).includes(level))) return fail(`experience_levels can only contain ${EXPERIENCE_LEVELS.join(", ")}.`)
    changes.experienceLevel = levels.length > 0 ? levels : null
  }
  if (args.target_salary_min !== undefined) {
    const salary = args.target_salary_min
    if (salary !== null && (!Number.isInteger(salary) || salary < 0 || salary > MAX_TARGET_SALARY)) {
      return fail(limitMessage(`target_salary_min must be a whole number from 0 to ${MAX_TARGET_SALARY.toLocaleString("en-GB")} (or null to clear it)`, "A figure outside this range is almost always a typo, such as pence instead of pounds."))
    }
    changes.targetSalaryMin = salary === null ? null : String(salary)
  }
  if (args.right_to_work_uk !== undefined) changes.rightToWorkUk = args.right_to_work_uk
  return { ok: true, value: changes }
}

const COLUMN_TO_TOOL_FIELD: Record<keyof ProfileChanges, keyof ProfileUpdate> = {
  fullName: "full_name",
  phone: "phone",
  linkedinUrl: "linkedin_url",
  githubUrl: "github_url",
  portfolioUrl: "portfolio_url",
  desiredRoles: "desired_roles",
  locationsUk: "locations",
  targetSalaryMin: "target_salary_min",
  experienceLevel: "experience_levels",
  rightToWorkUk: "right_to_work_uk",
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Edits the profile fields the Account and Profile pages let the owner edit, with before and after in the result. The
 * audit event keeps only which fields changed. Not auto-undoable: set the before values back with this tool.
 */
export async function updateProfile(userId: string, args: ProfileUpdate): Promise<ToolOutcome> {
  const parsed = parseProfileUpdate(args)
  if (!parsed.ok) return { error: parsed.error }
  const requested = Object.keys(parsed.value) as (keyof ProfileChanges)[]
  if (requested.length === 0) return { error: "Provide at least one field to change: full_name, phone, linkedin_url, github_url, portfolio_url, desired_roles, locations, target_salary_min, experience_levels or right_to_work_uk." }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        fullName: profiles.fullName, phone: profiles.phone, linkedinUrl: profiles.linkedinUrl, githubUrl: profiles.githubUrl, portfolioUrl: profiles.portfolioUrl,
        desiredRoles: profiles.desiredRoles, locationsUk: profiles.locationsUk, targetSalaryMin: profiles.targetSalaryMin, experienceLevel: profiles.experienceLevel, rightToWorkUk: profiles.rightToWorkUk,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .for("update")
      .limit(1)
    if (!row) return notFound("Profile")

    const before = profileView(row)
    const after = profileView({ ...row, ...parsed.value })
    const fields = requested.map((column) => COLUMN_TO_TOOL_FIELD[column]).filter((field) => !same(before[field as keyof typeof before], after[field as keyof typeof after]))
    const pick = (view: typeof before) => Object.fromEntries(fields.map((field) => [field, view[field as keyof typeof view]]))
    if (fields.length === 0) return { data: { changed: false, before: pick(before), after: pick(after) } }

    await tx.update(profiles).set(parsed.value).where(eq(profiles.id, userId))
    await recordProfileEvent(tx, userId, "profile.updated", { fields })
    return {
      data: {
        changed: true,
        before: pick(before),
        after: pick(after),
        to_undo: "Not auto-undoable (undo_last_change covers applications only). Call update_profile again with the before values.",
      },
    }
  })
}

const validCvName = (value: string): Parsed<string> => {
  const name = value.trim()
  if (!name) return fail("name is required.")
  const text = parseText("name", name, MAX_NAME_CHARS)
  return text.ok ? { ok: true, value: text.value ?? name } : text
}

export async function setPrimaryCv(userId: string, cvId: string): Promise<ToolOutcome> {
  return db.transaction(async (tx) => {
    const cvs = await tx
      .select({ id: userCvs.id, name: userCvs.name, isPrimary: userCvs.isPrimary })
      .from(userCvs)
      .where(eq(userCvs.userId, userId))
      .for("update")
    const target = cvs.find((cv) => cv.id === cvId)
    if (!target) return { error: "CV not found. Use an id from list_cvs." }
    const view = (cv?: { id: string; name: string | null }) => (cv ? { id: cv.id, name: cv.name ?? "Untitled CV" } : null)
    const previous = cvs.find((cv) => cv.isPrimary)
    if (target.isPrimary && cvs.filter((cv) => cv.isPrimary).length === 1) return { data: { changed: false, before: { primary_cv: view(previous) }, after: { primary_cv: view(target) } } }

    // New primary first, as the Profile page does, so a failure leaves two primaries rather than none.
    await tx.update(userCvs).set({ isPrimary: true }).where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)))
    await tx.update(userCvs).set({ isPrimary: false }).where(and(eq(userCvs.userId, userId), ne(userCvs.id, cvId)))
    await recordProfileEvent(tx, userId, "profile.cv_primary_changed", { cvId, previousCvId: previous?.id ?? null })
    return {
      data: {
        changed: true,
        before: { primary_cv: view(previous) },
        after: { primary_cv: view(target) },
        to_undo: previous ? `Call set_primary_cv with cv_id "${previous.id}".` : "There was no primary CV before.",
      },
    }
  })
}

export async function renameCv(userId: string, cvId: string, name: string): Promise<ToolOutcome> {
  const parsed = validCvName(name)
  if (!parsed.ok) return { error: parsed.error }
  return db.transaction(async (tx) => {
    const [cv] = await tx.select({ name: userCvs.name }).from(userCvs).where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId))).for("update").limit(1)
    if (!cv) return { error: "CV not found. Use an id from list_cvs." }
    if (cv.name === parsed.value) return { data: { id: cvId, changed: false, before: { name: cv.name }, after: { name: cv.name } } }
    await tx.update(userCvs).set({ name: parsed.value }).where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)))
    await recordProfileEvent(tx, userId, "profile.cv_renamed", { cvId, characters: parsed.value.length })
    return { data: { id: cvId, changed: true, before: { name: cv.name ?? "Untitled CV" }, after: { name: parsed.value }, to_undo: "Call rename_cv again with the before name." } }
  })
}
