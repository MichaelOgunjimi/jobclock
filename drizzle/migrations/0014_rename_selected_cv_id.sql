-- Drop the old FK (was incorrectly pointing to customized_cvs)
ALTER TABLE "applications" DROP CONSTRAINT IF EXISTS "applications_customized_cv_id_customized_cvs_id_fk";

-- Rename the column to reflect its actual purpose
ALTER TABLE "applications" RENAME COLUMN "customized_cv_id" TO "selected_cv_id";

-- Add correct FK to user_cvs
ALTER TABLE "applications" ADD CONSTRAINT "applications_selected_cv_id_user_cvs_id_fk"
  FOREIGN KEY ("selected_cv_id") REFERENCES "public"."user_cvs"("id") ON DELETE set null ON UPDATE no action;
