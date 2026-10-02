CREATE TABLE "telegram_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_user_id_hash" text NOT NULL,
	"telegram_user_last_four" text NOT NULL,
	"username" text,
	"display_name" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "telegram_pairing_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_update_receipts" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wa_id_hash" text NOT NULL,
	"phone_last_four" text NOT NULL,
	"display_name" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message_receipts" (
	"message_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_pairing_tokens" ADD CONSTRAINT "telegram_pairing_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_pairing_codes" ADD CONSTRAINT "whatsapp_pairing_codes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_connections_user_id_unique" ON "telegram_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_connections_user_id_hash_unique" ON "telegram_connections" USING btree ("telegram_user_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_pairing_tokens_user_id_unique" ON "telegram_pairing_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_pairing_tokens_token_hash_unique" ON "telegram_pairing_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "telegram_pairing_tokens_expires_at_idx" ON "telegram_pairing_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_user_id_unique" ON "whatsapp_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_wa_id_hash_unique" ON "whatsapp_connections" USING btree ("wa_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_pairing_codes_user_id_unique" ON "whatsapp_pairing_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_pairing_codes_code_hash_unique" ON "whatsapp_pairing_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "whatsapp_pairing_codes_expires_at_idx" ON "whatsapp_pairing_codes" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "telegram_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "telegram_pairing_tokens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "telegram_update_receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "whatsapp_pairing_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "whatsapp_message_receipts" ENABLE ROW LEVEL SECURITY;
