ALTER TABLE "applications" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "applications" AS application
SET "slug" = concat(
	coalesce(
		nullif(
			trim(both '-' from left(regexp_replace(lower(coalesce(nullif(application."custom_title", ''), nullif(job."title", ''), 'application')), '[^a-z0-9]+', '-', 'g'), 72)),
			''
		),
		'application'
	),
	'-',
	left(md5(application."id"::text), 16)
)
FROM "jobs_cache" AS job
WHERE application."job_id" = job."id";--> statement-breakpoint
UPDATE "applications" AS application
SET "slug" = concat(
	coalesce(
		nullif(
			trim(both '-' from left(regexp_replace(lower(coalesce(nullif(application."custom_title", ''), 'application')), '[^a-z0-9]+', '-', 'g'), 72)),
			''
		),
		'application'
	),
	'-',
	left(md5(application."id"::text), 16)
)
WHERE application."slug" IS NULL;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_slug_unique" ON "applications" USING btree ("slug");
