ALTER TABLE "profiles" ADD COLUMN "welcome_sent_at" timestamp with time zone;
--> statement-breakpoint
-- Everyone who already has an account has been welcomed in effect; only accounts created from now on get the email.
UPDATE "profiles" SET "welcome_sent_at" = now() WHERE "welcome_sent_at" IS NULL;
