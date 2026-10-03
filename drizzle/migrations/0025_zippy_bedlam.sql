ALTER TABLE "telegram_connections" ADD COLUMN "chat_id_encrypted" text;--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD COLUMN "digest_enabled" boolean DEFAULT false NOT NULL;