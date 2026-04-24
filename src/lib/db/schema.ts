import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  jsonb,
  integer,
  date,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

// ============================================================
// ENUMS
// ============================================================

export const applicationStatusEnum = pgEnum("application_status", [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
])

// ============================================================
// PROFILES
// ============================================================

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  preferences: jsonb("preferences").default({}),
  rightToWorkUk: boolean("right_to_work_uk"),
  locationsUk: text("locations_uk").array(),
  desiredRoles: text("desired_roles").array(),
  targetSalaryMin: numeric("target_salary_min"),
  cvTemplatePath: text("cv_template_path"),
  coverLetterTemplatePath: text("cover_letter_template_path"),
  experienceLevel: text("experience_level").array(),
  fullName: text("full_name"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  avatarUrl: text("avatar_url"),
})

// ============================================================
// USER CVS
// ============================================================

export const userCvs = pgTable("user_cvs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  originalFilePath: text("original_file_path"),
  parsedJson: jsonb("parsed_json"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  isPrimary: boolean("is_primary").default(false),
  name: text("name"),
})

// ============================================================
// JOBS CACHE
// ============================================================

export const jobsCache = pgTable("jobs_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").unique().notNull(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  description: text("description"),
  salaryMin: numeric("salary_min"),
  salaryMax: numeric("salary_max"),
  salaryCurrency: text("salary_currency").default("GBP"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
  isEasyApply: boolean("is_easy_apply").default(false),
  applyDeadline: date("apply_deadline"),
  isRemote: boolean("is_remote"),
  remoteType: text("remote_type"), // "remote" | "hybrid" | "on-site"
})

// ============================================================
// PERSONAL API TOKENS
// ============================================================

export const personalApiTokens = pgTable("personal_api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
})

// ============================================================
// COVER LETTER STRUCTURES (writing style guides)
// ============================================================

export const coverLetterStructures = pgTable("cover_letter_structures", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  slug: text("slug"),
  label: text("label").notNull(),
  content: text("content").notNull(),
  defaultTone: text("default_tone").notNull().default("professional"),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// APPLICATIONS
// ============================================================

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    jobId: uuid("job_id").references(() => jobsCache.id, { onDelete: "set null" }),
    status: applicationStatusEnum("status").default("saved"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    coverLetterId: uuid("cover_letter_id").references((): AnyPgColumn => coverLetters.id, { onDelete: "set null" }),
    customizedCvId: uuid("customized_cv_id").references((): AnyPgColumn => customizedCvs.id, { onDelete: "set null" }),
    structureId: uuid("structure_id").references((): AnyPgColumn => coverLetterStructures.id, { onDelete: "set null" }),
    coverLetterTone: text("cover_letter_tone"),
    source: text("source"),
    notes: text("notes"),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastStatusUpdate: timestamp("last_status_update", { withTimezone: true }).defaultNow(),
    autoApplyAttempted: boolean("auto_apply_attempted").default(false),
    autoApplySuccess: boolean("auto_apply_success"),
    applicationQualityScore: integer("application_quality_score"),
    rightToWorkConfirmed: boolean("right_to_work_confirmed").default(false),
    customDescription: text("custom_description"),
    followUpDueAt: timestamp("follow_up_due_at", { withTimezone: true }),
    followUpCount: integer("follow_up_count").default(0),
    followUpNotes: text("follow_up_notes"),
  },
  (table) => [
    uniqueIndex("applications_user_id_job_id_unique").on(table.userId, table.jobId),
  ]
)

// ============================================================
// COVER LETTERS
// ============================================================

export const coverLetters = pgTable("cover_letters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  applicationId: uuid("application_id").references((): AnyPgColumn => applications.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  reviewed: boolean("reviewed").default(false),
  label: text("label"),
  tone: text("tone"),
})

// ============================================================
// CUSTOMIZED CVS
// ============================================================

export const customizedCvs = pgTable("customized_cvs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  applicationId: uuid("application_id").references((): AnyPgColumn => applications.id, { onDelete: "set null" }),
  cvJson: jsonb("cv_json"),
  pdfPath: text("pdf_path"),
  atsScore: integer("ats_score"),
  skillsGap: jsonb("skills_gap"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// INTERVIEW PREP
// ============================================================

export const interviewPrep = pgTable("interview_prep", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id")
    .references(() => applications.id, { onDelete: "cascade" })
    .notNull(),
  questions: text("questions").array(),
  suggestedAnswers: jsonb("suggested_answers"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// OFFERS
// ============================================================

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  applicationId: uuid("application_id").references((): AnyPgColumn => applications.id, { onDelete: "set null" }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  baseSalary: numeric("base_salary"),
  bonus: text("bonus"),
  equity: text("equity"),
  benefits: jsonb("benefits"),
  remotePolicy: text("remote_policy"),
  startDate: date("start_date"),
  negotiationNotes: text("negotiation_notes"),
})

// ============================================================
// TRACKED COMPANIES
// ============================================================

export const trackedCompanies = pgTable("tracked_companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  careersUrl: text("careers_url").notNull(),
  atsType: text("ats_type"), // "greenhouse" | "lever" | "ashby" | "unknown"
  atsBoardIdentifier: text("ats_board_identifier"),
  enabled: boolean("enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// IGNORED JOBS
// ============================================================

export const ignoredJobs = pgTable("ignored_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobsCache.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// STORY BANK (STAR-format interview stories)
// ============================================================

export const storyBank = pgTable("story_bank", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  situation: text("situation"),
  task: text("task"),
  action: text("action"),
  result: text("result"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
