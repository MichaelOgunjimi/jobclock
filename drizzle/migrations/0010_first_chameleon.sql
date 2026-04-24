ALTER TABLE "personal_api_tokens" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "personal_api_tokens"
SET "expires_at" = "created_at" + interval '90 days'
WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "personal_api_tokens" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
WITH ranked_applications AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "user_id", "job_id"
			ORDER BY "created_at" DESC NULLS LAST, "id" DESC
		) AS row_number
	FROM "applications"
	WHERE "job_id" IS NOT NULL
)
DELETE FROM "applications"
WHERE "id" IN (
	SELECT "id"
	FROM ranked_applications
	WHERE row_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_id_job_id_unique" ON "applications" USING btree ("user_id","job_id");
