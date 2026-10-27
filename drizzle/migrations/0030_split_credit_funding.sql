ALTER TABLE "ai_usage_actions" ADD COLUMN "purchased_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "ai_usage_actions" SET "purchased_credits" = "credits" WHERE "funding" = 'purchased';--> statement-breakpoint
ALTER TABLE "ai_usage_actions" ADD CONSTRAINT "ai_usage_actions_purchased_credits_check" CHECK ("ai_usage_actions"."purchased_credits" >= 0 and "ai_usage_actions"."purchased_credits" <= "ai_usage_actions"."credits");
