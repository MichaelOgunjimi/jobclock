CREATE TABLE "ignored_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "story_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"situation" text,
	"task" text,
	"action" text,
	"result" text,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracked_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"careers_url" text NOT NULL,
	"ats_type" text,
	"ats_board_identifier" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "follow_up_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "follow_up_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "follow_up_notes" text;--> statement-breakpoint
ALTER TABLE "jobs_cache" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "jobs_cache" ADD COLUMN "is_remote" boolean;--> statement-breakpoint
ALTER TABLE "jobs_cache" ADD COLUMN "remote_type" text;--> statement-breakpoint
ALTER TABLE "ignored_jobs" ADD CONSTRAINT "ignored_jobs_job_id_jobs_cache_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs_cache"("id") ON DELETE cascade ON UPDATE no action;