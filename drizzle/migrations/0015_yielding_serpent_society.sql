-- Migration 0015 was originally generated containing five statements, but four
-- of them target changes that were already applied to the live DB out-of-band
-- (applications.customized_cv_id dropped + selected_cv_id added with its FK).
-- Drizzle's snapshot was stale relative to the live DB. Only the new column for
-- the CV review feature is unapplied; the other statements have been removed
-- here so this migration can run cleanly. The meta snapshot will resync on the
-- next db:generate.

ALTER TABLE "user_cvs" ADD COLUMN "review_findings" jsonb;
