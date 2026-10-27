CREATE TABLE "ai_credit_balances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_balances_credits_check" CHECK ("ai_credit_balances"."credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"pack" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_pence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_purchases_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "ai_credit_purchases_credits_check" CHECK ("ai_credit_purchases"."credits" > 0),
	CONSTRAINT "ai_credit_purchases_amount_check" CHECK ("ai_credit_purchases"."amount_pence" > 0)
);
--> statement-breakpoint
ALTER TABLE "ai_usage_actions" ADD COLUMN "funding" text DEFAULT 'allowance' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_credit_balances" ADD CONSTRAINT "ai_credit_balances_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_purchases" ADD CONSTRAINT "ai_credit_purchases_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_credit_purchases_user_idx" ON "ai_credit_purchases" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "ai_usage_actions" ADD CONSTRAINT "ai_usage_actions_funding_check" CHECK ("ai_usage_actions"."funding" in ('allowance', 'purchased'));
--> statement-breakpoint
ALTER TABLE "ai_credit_balances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_credit_purchases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "ai_credit_balances", "ai_credit_purchases" FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE "ai_credit_balances", "ai_credit_purchases" TO authenticated;
--> statement-breakpoint
CREATE POLICY "Users can view own AI credit balance" ON "ai_credit_balances"
	FOR SELECT TO authenticated USING ((select auth.uid()) = "user_id");
--> statement-breakpoint
CREATE POLICY "Users can view own AI credit purchases" ON "ai_credit_purchases"
	FOR SELECT TO authenticated USING ((select auth.uid()) = "user_id");
