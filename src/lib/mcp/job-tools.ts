import { and, desc, eq, gte, like, sql } from "drizzle-orm"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { applicationAuditEvents, applications, jobsCache, profiles, userCvs } from "@/lib/db/schema"
import { persistJobForUser } from "@/lib/jobs/persist-job"
import { jobUrlKey, normalizeJobUrl } from "@/lib/jobs/normalize-url"
import type { ApplicationStatus } from "@/lib/supabase/database.types"
import { currentConnection } from "./connection-context"
import { DEFAULT_DAILY_CREATE_CAP, DUPLICATE_WINDOW_DAYS, limitMessage, MAX_BATCH_JOBS, MAX_DESCRIPTION_CHARS, tooBig, tooLong } from "./limits"
import { addNote, escapeLike, MCP_SOURCE, setFollowUp, type ToolOutcome } from "./tools"

/**
 * Tools for a job-finding agent: check whether a job is already tracked, add it, and learn what the owner
 * wants. Everything a posting says is untrusted text. It is stored as data only: never fetched, executed or
 * used as an instruction, and no AI generation is started for it.
 */

// The limits (and why each exists) live in ./limits; re-exported here for the tools and tests that import them from this file.
export { DUPLICATE_WINDOW_DAYS, MAX_BATCH_JOBS, MAX_DESCRIPTION_CHARS }
/** The default for a new token or connection; the owner can change it for each one (0 = unlimited). */
export const DAILY_CREATE_CAP = DEFAULT_DAILY_CREATE_CAP
const DAY_MS = 24 * 60 * 60 * 1000

// Control characters (NUL breaks Postgres text), zero-width characters and bidi overrides (used to hide or spoof text).
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g
export const cleanText = (value: string) => value.replace(INVISIBLE, "").replace(/\r\n?/g, "\n").trim()
export const cleanLine = (value: string) => cleanText(value).replace(/\s+/g, " ")

const timestamp = z.iso.datetime({ offset: true })

export const jobFields = {
  url: z.string().trim().min(1).max(2000, tooLong("url", 2000)).describe("The posting's http(s) URL. JobClock never fetches it."),
  title: z.string().trim().min(1).max(200, tooLong("title", 200)),
  company: z.string().trim().min(1).max(200, tooLong("company", 200)),
  location: z.string().trim().max(200, tooLong("location", 200)).optional(),
  description: z.string().max(100_000, tooLong("description", 100_000)).optional().describe(`The posting text, as plain text. Stored up to ${MAX_DESCRIPTION_CHARS} characters.`),
  salary_min: z.number().min(0).max(10_000_000, tooBig("salary_min", 10_000_000, "Larger numbers are almost certainly a mistake (such as a monthly figure in pence).")).optional(),
  salary_max: z.number().min(0).max(10_000_000, tooBig("salary_max", 10_000_000, "Larger numbers are almost certainly a mistake (such as a monthly figure in pence).")).optional(),
  salary_currency: z.string().trim().length(3).optional().describe("ISO 4217 code, e.g. GBP."),
  posted_at: z.union([z.iso.date(), timestamp]).optional(),
  apply_deadline: z.iso.date().optional().describe("YYYY-MM-DD."),
  remote: z.boolean().optional(),
  remote_type: z.enum(["remote", "hybrid", "on-site"]).optional(),
  source: z.string().trim().max(40, tooLong("source", 40)).optional().describe('Where the job was found, e.g. "linkedin". Default "mcp".'),
  note: z.string().trim().min(1).max(2000, tooLong("note", 2000)).optional().describe("Why this job suits the owner. Added to the application's notes."),
  follow_up_due_at: timestamp.optional().describe("ISO 8601 timestamp with a timezone."),
  allow_duplicate: z.boolean().optional().describe("Add even if the same company and title was added recently."),
}
export const jobSchema = z.object(jobFields)
export type JobArgs = z.infer<typeof jobSchema>

const matchColumns = {
  id: applications.id,
  slug: applications.slug,
  status: applications.status,
  createdAt: applications.createdAt,
  customTitle: applications.customTitle,
  customCompany: applications.customCompany,
  jobTitle: jobsCache.title,
  jobCompany: jobsCache.company,
  url: jobsCache.url,
}

function toMatch(row: {
  id: string
  slug: string
  status: ApplicationStatus | null
  createdAt: Date | null
  customTitle: string | null
  customCompany: string | null
  jobTitle: string | null
  jobCompany: string | null
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.customTitle ?? row.jobTitle ?? "Untitled role",
    company: row.customCompany ?? row.jobCompany ?? "Unknown company",
    status: row.status ?? "saved",
    created_at: row.createdAt?.toISOString() ?? null,
  }
}

/** The user's applications for this posting. Narrowed in SQL by host and path, then compared on the normalised URL so tracking parameters and slashes in older rows do not hide a match. */
async function findByUrl(userId: string, normalized: string) {
  const key = jobUrlKey(normalized)
  const rows = await db
    .select(matchColumns)
    .from(applications)
    .innerJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applications.userId, userId), like(jobsCache.url, `%://${escapeLike(key.split("?")[0])}%`)))
    .orderBy(desc(applications.createdAt))
    .limit(25)
  return rows.filter((row) => {
    const stored = normalizeJobUrl(row.url)
    return stored !== null && jobUrlKey(stored) === key
  })
}

async function findByCompanyAndTitle(userId: string, company: string, title: string, since?: Date) {
  return db
    .select(matchColumns)
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(
      eq(applications.userId, userId),
      sql`lower(trim(coalesce(${applications.customCompany}, ${jobsCache.company}))) = ${company.toLowerCase()}`,
      sql`lower(trim(coalesce(${applications.customTitle}, ${jobsCache.title}))) = ${title.toLowerCase()}`,
      since ? gte(applications.createdAt, since) : undefined,
    ))
    .orderBy(desc(applications.createdAt))
    .limit(5)
}

export async function checkJobExists(userId: string, args: { url?: string; company?: string; title?: string }): Promise<ToolOutcome> {
  const company = args.company && cleanLine(args.company)
  const title = args.title && cleanLine(args.title)
  if (!args.url && !(company && title)) return { error: "Provide url, or both company and title." }

  let urlMatches: ReturnType<typeof toMatch>[] = []
  if (args.url) {
    const normalized = normalizeJobUrl(args.url)
    if (!normalized) return { error: "url must be a valid http or https URL." }
    urlMatches = (await findByUrl(userId, normalized)).map(toMatch)
  }
  const similar = company && title
    ? (await findByCompanyAndTitle(userId, company, title)).map(toMatch).filter((match) => !urlMatches.some((m) => m.id === match.id))
    : []
  return { data: { exists: urlMatches.length > 0, url_matches: urlMatches, same_company_and_title: similar } }
}

/** What this connection added in the window. Without a connection (a direct call) it counts everything added through MCP by the user. */
async function createdViaMcpSince(userId: string, since: Date): Promise<number> {
  const connection = currentConnection()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applicationAuditEvents)
    .where(and(
      eq(applicationAuditEvents.userId, userId),
      eq(applicationAuditEvents.eventType, "application.created"),
      gte(applicationAuditEvents.createdAt, since),
      sql`${applicationAuditEvents.metadata}->>'source' = ${MCP_SOURCE}`,
      connection ? sql`${applicationAuditEvents.metadata}->>'connectionId' = ${connection.id}` : undefined,
    ))
  return row?.count ?? 0
}

type AddContext = { createdToday: number; now: Date; dailyCap: number }

const dailyCapFor = () => currentConnection()?.dailyCreateCap ?? DAILY_CREATE_CAP

async function addJob(userId: string, args: JobArgs, ctx: AddContext): Promise<ToolOutcome> {
  const normalized = normalizeJobUrl(args.url)
  if (!normalized) return { error: "url must be a valid http or https URL." }
  const title = cleanLine(args.title)
  const company = cleanLine(args.company)
  if (!title || !company) return { error: "title and company must not be empty." }
  if (args.salary_min != null && args.salary_max != null && args.salary_min > args.salary_max) {
    return { error: "salary_min must not be greater than salary_max." }
  }

  const [existing] = await findByUrl(userId, normalized)
  if (existing) return { data: { created: false, duplicate: "url", existing: toMatch(existing) } }

  if (!args.allow_duplicate) {
    const since = new Date(ctx.now.getTime() - DUPLICATE_WINDOW_DAYS * DAY_MS)
    const similar = await findByCompanyAndTitle(userId, company, title, since)
    if (similar.length > 0) {
      return {
        data: {
          created: false,
          duplicate: "company_and_title",
          existing: toMatch(similar[0]),
          hint: "The same company and title was added in the last 90 days. If this is a different posting, call again with allow_duplicate: true.",
        },
      }
    }
  }

  if (ctx.dailyCap > 0 && ctx.createdToday >= ctx.dailyCap) {
    return {
      error: limitMessage(
        `Daily limit reached: this connection has already added ${ctx.createdToday} applications in the last 24 hours (its limit is ${ctx.dailyCap})`,
        "The limit stops an agent that loops from flooding the owner's list.",
        "The owner can raise it, or set it to 0 for no limit, in JobClock under Settings -> AI Agent, on this token or connected app.",
      ),
    }
  }

  const description = args.description ? cleanText(args.description) : ""
  const descriptionTruncated = description.length > MAX_DESCRIPTION_CHARS
  const result = await persistJobForUser(
    userId,
    {
      url: normalized,
      source: (args.source && cleanLine(args.source)) || MCP_SOURCE,
      title,
      company,
      location: args.location ? cleanLine(args.location) || null : null,
      description: description.slice(0, MAX_DESCRIPTION_CHARS) || null,
      salaryMin: args.salary_min,
      salaryMax: args.salary_max,
      salaryCurrency: args.salary_currency?.toUpperCase(),
      postedAt: args.posted_at,
      applyDeadline: args.apply_deadline,
      isRemote: args.remote ?? (args.remote_type ? args.remote_type === "remote" : null),
      remoteType: args.remote_type,
    },
    // No AI automations: an agent adding jobs must never spend the owner's credits. A shared cached row is never overwritten.
    { autoGenerate: false, keepCachedJob: true, auditSource: MCP_SOURCE },
  )
  if (result.alreadySaved) {
    const [raced] = await findByUrl(userId, normalized)
    return { data: { created: false, duplicate: "url", existing: raced ? toMatch(raced) : { id: result.applicationId, slug: result.applicationSlug } } }
  }
  ctx.createdToday += 1

  const warnings: string[] = []
  if (args.note) {
    const noted = await addNote(userId, result.applicationId, args.note, ctx.now)
    if ("error" in noted) warnings.push(`note not added: ${noted.error}`)
  }
  if (args.follow_up_due_at) {
    const followed = await setFollowUp(userId, result.applicationId, { dueAt: args.follow_up_due_at })
    if ("error" in followed) warnings.push(`follow-up not set: ${followed.error}`)
  }

  return {
    data: {
      created: true,
      id: result.applicationId,
      slug: result.applicationSlug,
      status: "saved",
      title,
      company,
      url: normalized,
      ...(descriptionTruncated ? { description_truncated: true } : {}),
      ...(warnings.length ? { warnings } : {}),
      to_undo: "Agents cannot delete applications: the owner can remove it in the JobClock web app.",
    },
  }
}

export async function addApplication(userId: string, args: JobArgs, now = new Date()): Promise<ToolOutcome> {
  return addJob(userId, args, { createdToday: await createdViaMcpSince(userId, new Date(now.getTime() - DAY_MS)), now, dailyCap: dailyCapFor() })
}

/** Items are handled one after another (so a repeat inside the batch is caught as a duplicate); one bad item never stops the rest. */
export async function addApplications(userId: string, items: unknown[], now = new Date()): Promise<ToolOutcome> {
  if (items.length === 0) return { error: "Send at least one job." }
  if (items.length > MAX_BATCH_JOBS) {
    return { error: limitMessage(`Too many jobs in one call: ${items.length} sent, at most ${MAX_BATCH_JOBS} allowed`, "A batch is processed in one request, which has a time limit, and each job gets its own result. Send the rest in further calls.") }
  }

  const ctx = { createdToday: await createdViaMcpSince(userId, new Date(now.getTime() - DAY_MS)), now, dailyCap: dailyCapFor() }
  const results: Record<string, unknown>[] = []
  for (const [index, item] of items.entries()) {
    const parsed = jobSchema.safeParse(item)
    let outcome: ToolOutcome
    if (!parsed.success) {
      outcome = { error: parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "item"}: ${issue.message}`).join("; ") }
    } else {
      try {
        outcome = await addJob(userId, parsed.data, ctx)
      } catch (error) {
        console.error("add_applications item failed", error)
        outcome = { error: "The job could not be saved. Try it again on its own." }
      }
    }
    results.push({ index, ...("error" in outcome ? { created: false, error: outcome.error } : outcome.data) })
  }
  const created = results.filter((result) => result.created === true).length
  const failed = results.filter((result) => "error" in result).length
  return { data: { created, duplicates: results.length - created - failed, failed, results } }
}

// ---- what the owner is looking for ----

const strings = (value: unknown, max: number, length: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => scrub(cleanLine(item)).slice(0, length))
    .filter(Boolean)
    .slice(0, max)

/** Free text can carry contact details by accident; this tool promises none. */
const scrub = (text: string) => text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[removed]").replace(/\+?\d(?:[\s().-]?\d){8,}/g, "[removed]")

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {})
const text = (value: unknown, length: number) => (typeof value === "string" ? scrub(cleanLine(value)).slice(0, length) : "")

function summariseCv(parsed: unknown) {
  const cv = record(parsed)
  const roles = (Array.isArray(cv.experience) ? cv.experience : []).slice(0, 6).map((entry) => {
    const role = record(entry)
    return { title: text(role.title, 100), company: text(role.company, 100), start: text(role.start_date, 20), end: text(role.end_date, 20) }
  }).filter((role) => role.title || role.company)
  const education = (Array.isArray(cv.education) ? cv.education : []).slice(0, 3).map((entry) => {
    const item = record(entry)
    return { degree: text(item.degree, 100), field: text(item.field, 100), institution: text(item.institution, 100) }
  }).filter((item) => item.degree || item.institution)
  const summary = {
    headline: text(cv.headline, 120),
    summary: text(cv.summary, 500),
    skills: strings(cv.skills, 40, 40),
    recent_roles: roles,
    education,
    languages: strings(cv.languages, 10, 40),
    certifications: strings(cv.certifications, 10, 80),
  }
  // Omit what is empty. The CV's name, email, phone, location and links are never read.
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value))))
}

export async function getJobPreferences(userId: string): Promise<ToolOutcome> {
  const [[profile], [cv]] = await Promise.all([
    db
      .select({
        desiredRoles: profiles.desiredRoles,
        locations: profiles.locationsUk,
        targetSalaryMin: profiles.targetSalaryMin,
        experienceLevel: profiles.experienceLevel,
        rightToWorkUk: profiles.rightToWorkUk,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
    db
      .select({ parsedJson: userCvs.parsedJson })
      .from(userCvs)
      .where(and(eq(userCvs.userId, userId), eq(userCvs.isPrimary, true)))
      .orderBy(desc(userCvs.createdAt))
      .limit(1),
  ])

  const salary = profile?.targetSalaryMin == null ? null : Number(profile.targetSalaryMin)
  const preferences = {
    desired_roles: strings(profile?.desiredRoles, 20, 100),
    locations: strings(profile?.locations, 20, 100),
    experience_levels: strings(profile?.experienceLevel, 10, 40),
    ...(salary !== null && Number.isFinite(salary) ? { target_salary_min: salary } : {}),
    ...(typeof profile?.rightToWorkUk === "boolean" ? { right_to_work_uk: profile.rightToWorkUk } : {}),
  }
  const cvSummary = cv ? summariseCv(cv.parsedJson) : {}
  return {
    data: {
      ...Object.fromEntries(Object.entries(preferences).filter(([, value]) => !Array.isArray(value) || value.length > 0)),
      ...(Object.keys(cvSummary).length ? { cv: cvSummary } : {}),
      note: "Only what the owner entered is shown. JobClock does not record remote preference, industries, excluded companies or visa status beyond UK right to work: ask the owner rather than guess.",
    },
  }
}
