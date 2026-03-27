CREATE TYPE "public"."application_status" AS ENUM('saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"status" "application_status" DEFAULT 'saved',
	"applied_at" timestamp with time zone,
	"cover_letter_id" uuid,
	"customized_cv_id" uuid,
	"source" text,
	"notes" text,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"last_status_update" timestamp with time zone DEFAULT now(),
	"auto_apply_attempted" boolean DEFAULT false,
	"auto_apply_success" boolean,
	"application_quality_score" integer,
	"right_to_work_confirmed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "cover_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"reviewed" boolean DEFAULT false,
	"label" text,
	"tone" text
);
--> statement-breakpoint
CREATE TABLE "customized_cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"cv_json" jsonb,
	"pdf_path" text,
	"ats_score" integer,
	"skills_gap" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interview_prep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"questions" text[],
	"suggested_answers" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"description" text,
	"salary_min" numeric,
	"salary_max" numeric,
	"salary_currency" text DEFAULT 'GBP',
	"posted_at" timestamp with time zone,
	"scraped_at" timestamp with time zone DEFAULT now(),
	"is_easy_apply" boolean DEFAULT false,
	"apply_deadline" date,
	CONSTRAINT "jobs_cache_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"base_salary" numeric,
	"bonus" text,
	"equity" text,
	"benefits" jsonb,
	"remote_policy" text,
	"start_date" date,
	"negotiation_notes" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"right_to_work_uk" boolean,
	"location_uk" text,
	"desired_roles" text[],
	"target_salary_min" numeric,
	"cv_template_path" text,
	"cover_letter_template_path" text
);
--> statement-breakpoint
CREATE TABLE "user_cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_file_path" text,
	"parsed_json" jsonb,
	"file_path" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_primary" boolean DEFAULT false,
	"name" text
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_cache_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs_cache"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customized_cvs" ADD CONSTRAINT "customized_cvs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_prep" ADD CONSTRAINT "interview_prep_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;