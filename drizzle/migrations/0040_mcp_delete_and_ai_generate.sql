ALTER TABLE "api_tokens" ADD COLUMN "daily_delete_cap" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "daily_credit_cap" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "requested_by_kind" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "requested_by_id" uuid;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD COLUMN "daily_delete_cap" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD COLUMN "daily_credit_cap" integer DEFAULT 20;--> statement-breakpoint
CREATE INDEX "generation_jobs_requested_by_idx" ON "generation_jobs" USING btree ("requested_by_id","created_at") WHERE "generation_jobs"."requested_by_id" is not null;