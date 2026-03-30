-- Add per-user custom description to applications table.
-- Replaces the previous approach of writing to jobs_cache.description,
-- which was shared across all users and allowed cross-user data corruption.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS custom_description text;
