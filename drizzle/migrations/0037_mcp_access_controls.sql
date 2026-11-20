ALTER TABLE "api_tokens" ADD COLUMN "scopes" text[] DEFAULT ARRAY['applications:read', 'applications:write']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "daily_create_cap" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD COLUMN "grant_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD COLUMN "daily_create_cap" integer DEFAULT 100 NOT NULL;