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
  bigint,
  date,
  uniqueIndex,
  index,
  check,
  primaryKey,
  foreignKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

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
  "ghosted",
])

// ============================================================
// PROFILES
// ============================================================

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  preferences: jsonb("preferences").default({}),
  allowPlatformAiKey: boolean("allow_platform_ai_key").default(false).notNull(),
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
  reviewFindings: jsonb("review_findings"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  isPrimary: boolean("is_primary").default(false),
  name: text("name"),
})

// ============================================================
// PROFILE DOCUMENTS
// ============================================================

export const profileDocuments = pgTable(
  "profile_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    issuer: text("issuer"),
    issuedAt: date("issued_at"),
    expiresAt: date("expires_at"),
    credentialId: text("credential_id"),
    credentialUrl: text("credential_url"),
    originalFilePath: text("original_file_path").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("profile_documents_user_id_idx").on(table.userId)],
)

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
  industryKey: text("industry_key"),
  industryLabel: text("industry_label"),
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
// WHATSAPP INTAKE
// ============================================================

export const whatsappConnections = pgTable(
  "whatsapp_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // The sender ID is keyed with ENCRYPTION_SECRET before persistence. Keeping
    // only the digest and last four digits is enough for lookup and account UI.
    waIdHash: text("wa_id_hash").notNull(),
    phoneLastFour: text("phone_last_four").notNull(),
    displayName: text("display_name"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("whatsapp_connections_user_id_unique").on(table.userId),
    uniqueIndex("whatsapp_connections_wa_id_hash_unique").on(table.waIdHash),
  ]
)

export const whatsappPairingCodes = pgTable(
  "whatsapp_pairing_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("whatsapp_pairing_codes_user_id_unique").on(table.userId),
    uniqueIndex("whatsapp_pairing_codes_code_hash_unique").on(table.codeHash),
    index("whatsapp_pairing_codes_expires_at_idx").on(table.expiresAt),
  ]
)

export const whatsappMessageReceipts = pgTable("whatsapp_message_receipts", {
  messageId: text("message_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================
// TELEGRAM INTAKE
// ============================================================

export const telegramConnections = pgTable(
  "telegram_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    telegramUserIdHash: text("telegram_user_id_hash").notNull(),
    telegramUserLastFour: text("telegram_user_last_four").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    /** AES-encrypted private chat id; stored only while the weekly digest is enabled. */
    chatIdEncrypted: text("chat_id_encrypted"),
    digestEnabled: boolean("digest_enabled").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("telegram_connections_user_id_unique").on(table.userId),
    uniqueIndex("telegram_connections_user_id_hash_unique").on(table.telegramUserIdHash),
  ]
)

export const telegramPairingTokens = pgTable(
  "telegram_pairing_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("telegram_pairing_tokens_user_id_unique").on(table.userId),
    uniqueIndex("telegram_pairing_tokens_token_hash_unique").on(table.tokenHash),
    index("telegram_pairing_tokens_expires_at_idx").on(table.expiresAt),
  ]
)

export const telegramUpdateReceipts = pgTable("telegram_update_receipts", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
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
    slug: text("slug").notNull(),
    userId: uuid("user_id").notNull(),
    jobId: uuid("job_id").references(() => jobsCache.id, { onDelete: "set null" }),
    status: applicationStatusEnum("status").default("saved"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    coverLetterId: uuid("cover_letter_id").references((): AnyPgColumn => coverLetters.id, { onDelete: "set null" }),
    selectedCvId: uuid("selected_cv_id").references((): AnyPgColumn => userCvs.id, { onDelete: "set null" }),
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
    customTitle: text("custom_title"),
    customCompany: text("custom_company"),
    customLocation: text("custom_location"),
    customSalaryText: text("custom_salary_text"),
    customDescription: text("custom_description"),
    followUpDueAt: timestamp("follow_up_due_at", { withTimezone: true }),
    followUpCount: integer("follow_up_count").default(0),
    followUpNotes: text("follow_up_notes"),
  },
  (table) => [
    uniqueIndex("applications_slug_unique").on(table.slug),
    uniqueIndex("applications_user_id_job_id_unique").on(table.userId, table.jobId),
  ]
)

export const applicationStatusEvents = pgTable(
  "application_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references((): AnyPgColumn => applications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatusEnum("from_status"),
    toStatus: applicationStatusEnum("to_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("application_status_events_application_id_idx").on(table.applicationId),
    index("application_status_events_user_id_created_at_idx").on(table.userId, table.createdAt),
  ]
)

export const applicationAuditEvents = pgTable(
  "application_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Deliberately not a foreign key: the final deletion event must outlive the application.
    applicationId: uuid("application_id").notNull(),
    userId: uuid("user_id").notNull(),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("application_audit_events_owner_timeline_idx").on(
      table.userId,
      table.applicationId,
      table.createdAt,
      table.id,
    ),
  ],
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
  researchContent: text("research_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// GENERATION JOBS (async generation lifecycle)
// ============================================================

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    applicationId: uuid("application_id").references((): AnyPgColumn => applications.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("queued"),
    resultRef: uuid("result_ref"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    params: jsonb("params"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("generation_jobs_active_unique")
      .on(table.applicationId, table.kind)
      .where(sql`${table.status} in ('queued','running')`),
  ]
)

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

export const storyBank = pgTable(
  "story_bank",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    situation: text("situation"),
    task: text("task"),
    action: text("action"),
    result: text("result"),
    tags: text("tags").array(),
    sourceType: text("source_type").notNull().default("manual"),
    sourceRef: text("source_ref"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("story_bank_user_source_unique")
      .on(table.userId, table.sourceType, table.sourceRef)
      .where(sql`${table.sourceRef} is not null`),
  ],
)

export const interviewProfileFacts = pgTable(
  "interview_profile_facts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    detail: text("detail").notNull(),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref"),
    sourceDocumentId: uuid("source_document_id").references(
      () => profileDocuments.id,
      { onDelete: "cascade" },
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("interview_profile_facts_user_id_idx").on(table.userId),
    index("interview_profile_facts_source_document_id_idx").on(table.sourceDocumentId),
    uniqueIndex("interview_profile_facts_user_source_unique")
      .on(table.userId, table.sourceType, table.sourceRef),
  ],
)

export const interviewQuestions = pgTable(
  "interview_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    applicationId: uuid("application_id").references(
      (): AnyPgColumn => applications.id,
      { onDelete: "cascade" },
    ),
    text: text("text").notNull(),
    category: text("category").notNull(),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("interview_questions_user_id_idx").on(table.userId),
    index("interview_questions_application_id_idx").on(table.applicationId),
    uniqueIndex("interview_questions_user_source_unique")
      .on(table.userId, table.sourceType, table.sourceRef)
      .where(sql`${table.sourceRef} is not null`),
  ],
)

export const interviewAnswers = pgTable(
  "interview_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(
      (): AnyPgColumn => applications.id,
      { onDelete: "cascade" },
    ),
    content: text("content").notNull(),
    evidenceSnapshot: jsonb("evidence_snapshot").notNull().default({}),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("interview_answers_user_id_idx").on(table.userId),
    uniqueIndex("interview_answers_saved_general_unique")
      .on(table.userId, table.questionId)
      .where(sql`${table.applicationId} is null and ${table.status} = 'saved'`),
    uniqueIndex("interview_answers_saved_tailored_unique")
      .on(table.userId, table.questionId, table.applicationId)
      .where(sql`${table.applicationId} is not null and ${table.status} = 'saved'`),
  ],
)

// ============================================================
// BILLING AND AI USAGE
// ============================================================

export const billingCustomers = pgTable("billing_customers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeProductId: text("stripe_product_id").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    status: text("status").notNull(),
    billingInterval: text("billing_interval").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    pastDueAt: timestamp("past_due_at", { withTimezone: true }),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
    stripeUpdatedAt: timestamp("stripe_updated_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("billing_subscriptions_status_check", sql`${table.status} in ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete', 'incomplete_expired', 'canceled')`),
    check("billing_subscriptions_interval_check", sql`${table.billingInterval} in ('month', 'year')`),
  ],
)

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    stripeEventId: text("stripe_event_id").primaryKey(),
    type: text("type").notNull(),
    stripeObjectId: text("stripe_object_id"),
    stripeCreatedAt: timestamp("stripe_created_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("billing_webhook_events_status_check", sql`${table.status} in ('processing', 'processed', 'failed', 'ignored')`),
  ],
)

export const aiUsagePeriods = pgTable(
  "ai_usage_periods",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    creditLimit: integer("credit_limit").notNull(),
    creditsReserved: integer("credits_reserved").default(0).notNull(),
    creditsUsed: integer("credits_used").default(0).notNull(),
    costLimitMicrousd: bigint("cost_limit_microusd", { mode: "number" }).notNull(),
    costReservedMicrousd: bigint("cost_reserved_microusd", { mode: "number" }).default(0).notNull(),
    costUsedMicrousd: bigint("cost_used_microusd", { mode: "number" }).default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.periodStart] }),
    check("ai_usage_periods_period_check", sql`${table.periodEnd} > ${table.periodStart}`),
    check("ai_usage_periods_credit_limit_check", sql`${table.creditLimit} >= 0`),
    check("ai_usage_periods_credits_reserved_check", sql`${table.creditsReserved} >= 0`),
    check("ai_usage_periods_credits_used_check", sql`${table.creditsUsed} >= 0`),
    check("ai_usage_periods_credits_total_check", sql`${table.creditsReserved} + ${table.creditsUsed} <= ${table.creditLimit}`),
    check("ai_usage_periods_cost_limit_check", sql`${table.costLimitMicrousd} >= 0`),
    check("ai_usage_periods_cost_reserved_check", sql`${table.costReservedMicrousd} >= 0`),
    check("ai_usage_periods_cost_used_check", sql`${table.costUsedMicrousd} >= 0`),
    check("ai_usage_periods_cost_total_check", sql`${table.costReservedMicrousd} + ${table.costUsedMicrousd} <= ${table.costLimitMicrousd}`),
  ],
)

export const aiUsageActions = pgTable(
  "ai_usage_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    feature: text("feature").notNull(),
    credentialSource: text("credential_source").notNull(),
    status: text("status").notNull(),
    credits: integer("credits").notNull(),
    // Which pool paid for the action: the monthly Pro allowance or purchased top-up credits.
    funding: text("funding").default("allowance").notNull(),
    estimatedCostMicrousd: bigint("estimated_cost_microusd", { mode: "number" }).default(0).notNull(),
    actualCostMicrousd: bigint("actual_cost_microusd", { mode: "number" }).default(0).notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" }).default(0).notNull(),
    cachedInputTokens: bigint("cached_input_tokens", { mode: "number" }).default(0).notNull(),
    outputTokens: bigint("output_tokens", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({ columns: [table.userId, table.periodStart], foreignColumns: [aiUsagePeriods.userId, aiUsagePeriods.periodStart] }).onDelete("cascade"),
    check("ai_usage_actions_feature_check", sql`${table.feature} in ('job_import', 'qualification_document_extraction', 'cv_parse_review', 'application_chat', 'interview_answer', 'interview_preparation', 'cover_letter', 'company_research', 'cv_tailoring')`),
    check("ai_usage_actions_credential_source_check", sql`${table.credentialSource} in ('personal', 'jobclock')`),
    check("ai_usage_actions_status_check", sql`${table.status} in ('reserved', 'completed', 'failed')`),
    check("ai_usage_actions_funding_check", sql`${table.funding} in ('allowance', 'purchased')`),
    check("ai_usage_actions_credits_check", sql`${table.credits} >= 0`),
    check("ai_usage_actions_costs_check", sql`${table.estimatedCostMicrousd} >= 0 and ${table.actualCostMicrousd} >= 0`),
    check("ai_usage_actions_tokens_check", sql`${table.inputTokens} >= 0 and ${table.cachedInputTokens} >= 0 and ${table.outputTokens} >= 0`),
    index("ai_usage_actions_user_period_idx").on(table.userId, table.periodStart),
  ],
)

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actionId: uuid("action_id")
      .notNull()
      .references(() => aiUsageActions.id, { onDelete: "cascade" }),
    providerRequestId: text("provider_request_id").unique(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" }).default(0).notNull(),
    cachedInputTokens: bigint("cached_input_tokens", { mode: "number" }).default(0).notNull(),
    outputTokens: bigint("output_tokens", { mode: "number" }).default(0).notNull(),
    toolCostMicrousd: bigint("tool_cost_microusd", { mode: "number" }).default(0).notNull(),
    totalCostMicrousd: bigint("total_cost_microusd", { mode: "number" }).default(0).notNull(),
    priceVersion: text("price_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("ai_usage_events_provider_check", sql`${table.provider} in ('openai', 'anthropic')`),
    check("ai_usage_events_usage_check", sql`${table.inputTokens} >= 0 and ${table.cachedInputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.toolCostMicrousd} >= 0 and ${table.totalCostMicrousd} >= 0`),
    index("ai_usage_events_action_id_idx").on(table.actionId),
  ],
)

// Purchased top-up credits: they never expire and are spent only after the monthly allowance runs out.
export const aiCreditBalances = pgTable(
  "ai_credit_balances",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    credits: integer("credits").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("ai_credit_balances_credits_check", sql`${table.credits} >= 0`)],
)

// One row per paid Checkout Session; the unique session id makes webhook retries grant credits once.
export const aiCreditPurchases = pgTable(
  "ai_credit_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull().unique(),
    pack: text("pack").notNull(),
    credits: integer("credits").notNull(),
    amountPence: integer("amount_pence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("ai_credit_purchases_credits_check", sql`${table.credits} > 0`),
    check("ai_credit_purchases_amount_check", sql`${table.amountPence} > 0`),
    index("ai_credit_purchases_user_idx").on(table.userId),
  ],
)
