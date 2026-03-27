ALTER TABLE "profiles" ALTER COLUMN "experience_level" SET DATA TYPE text[]
USING CASE WHEN "experience_level" IS NULL THEN NULL ELSE ARRAY["experience_level"] END;