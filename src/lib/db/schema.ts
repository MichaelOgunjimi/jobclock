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
  isEasyApply: boolean("is_easy_apply").default(false),
  applyDeadline: date("apply_deadline"),
})

// ============================================================
// APPLICATIONS
// ============================================================

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  jobId: uuid("job_id").references(() => jobsCache.id, { onDelete: "set null" }),
  status: applicationStatusEnum("status").default("saved"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  coverLetterId: uuid("cover_letter_id"),
  customizedCvId: uuid("customized_cv_id"),
  source: text("source"),
  notes: text("notes"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastStatusUpdate: timestamp("last_status_update", { withTimezone: true }).defaultNow(),
  autoApplyAttempted: boolean("auto_apply_attempted").default(false),
  autoApplySuccess: boolean("auto_apply_success"),
  applicationQualityScore: integer("application_quality_score"),
  rightToWorkConfirmed: boolean("right_to_work_confirmed").default(false),
})

// ============================================================
// COVER LETTERS
// ============================================================

export const coverLetters = pgTable("cover_letters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
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
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
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
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
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
