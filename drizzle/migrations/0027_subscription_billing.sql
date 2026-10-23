CREATE TABLE "ai_usage_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"feature" text NOT NULL,
	"credential_source" text NOT NULL,
	"status" text NOT NULL,
	"credits" integer NOT NULL,
	"estimated_cost_microusd" bigint DEFAULT 0 NOT NULL,
	"actual_cost_microusd" bigint DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "ai_usage_actions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "ai_usage_actions_feature_check" CHECK ("ai_usage_actions"."feature" in ('job_import', 'qualification_document_extraction', 'cv_parse_review', 'application_chat', 'interview_answer', 'interview_preparation', 'cover_letter', 'company_research', 'cv_tailoring')),
	CONSTRAINT "ai_usage_actions_credential_source_check" CHECK ("ai_usage_actions"."credential_source" in ('personal', 'jobclock')),
	CONSTRAINT "ai_usage_actions_status_check" CHECK ("ai_usage_actions"."status" in ('reserved', 'completed', 'failed')),
	CONSTRAINT "ai_usage_actions_credits_check" CHECK ("ai_usage_actions"."credits" >= 0),
	CONSTRAINT "ai_usage_actions_costs_check" CHECK ("ai_usage_actions"."estimated_cost_microusd" >= 0 and "ai_usage_actions"."actual_cost_microusd" >= 0),
	CONSTRAINT "ai_usage_actions_tokens_check" CHECK ("ai_usage_actions"."input_tokens" >= 0 and "ai_usage_actions"."cached_input_tokens" >= 0 and "ai_usage_actions"."output_tokens" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"provider_request_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"tool_cost_microusd" bigint DEFAULT 0 NOT NULL,
	"total_cost_microusd" bigint DEFAULT 0 NOT NULL,
	"price_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_events_provider_request_id_unique" UNIQUE("provider_request_id"),
	CONSTRAINT "ai_usage_events_provider_check" CHECK ("ai_usage_events"."provider" in ('openai', 'anthropic')),
	CONSTRAINT "ai_usage_events_usage_check" CHECK ("ai_usage_events"."input_tokens" >= 0 and "ai_usage_events"."cached_input_tokens" >= 0 and "ai_usage_events"."output_tokens" >= 0 and "ai_usage_events"."tool_cost_microusd" >= 0 and "ai_usage_events"."total_cost_microusd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_usage_periods" (
	"user_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"credit_limit" integer NOT NULL,
	"credits_reserved" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"cost_limit_microusd" bigint NOT NULL,
	"cost_reserved_microusd" bigint DEFAULT 0 NOT NULL,
	"cost_used_microusd" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_periods_user_id_period_start_pk" PRIMARY KEY("user_id","period_start"),
	CONSTRAINT "ai_usage_periods_period_check" CHECK ("ai_usage_periods"."period_end" > "ai_usage_periods"."period_start"),
	CONSTRAINT "ai_usage_periods_credit_limit_check" CHECK ("ai_usage_periods"."credit_limit" >= 0),
	CONSTRAINT "ai_usage_periods_credits_reserved_check" CHECK ("ai_usage_periods"."credits_reserved" >= 0),
	CONSTRAINT "ai_usage_periods_credits_used_check" CHECK ("ai_usage_periods"."credits_used" >= 0),
	CONSTRAINT "ai_usage_periods_credits_total_check" CHECK ("ai_usage_periods"."credits_reserved" + "ai_usage_periods"."credits_used" <= "ai_usage_periods"."credit_limit"),
	CONSTRAINT "ai_usage_periods_cost_limit_check" CHECK ("ai_usage_periods"."cost_limit_microusd" >= 0),
	CONSTRAINT "ai_usage_periods_cost_reserved_check" CHECK ("ai_usage_periods"."cost_reserved_microusd" >= 0),
	CONSTRAINT "ai_usage_periods_cost_used_check" CHECK ("ai_usage_periods"."cost_used_microusd" >= 0),
	CONSTRAINT "ai_usage_periods_cost_total_check" CHECK ("ai_usage_periods"."cost_reserved_microusd" + "ai_usage_periods"."cost_used_microusd" <= "ai_usage_periods"."cost_limit_microusd")
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_product_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" text NOT NULL,
	"billing_interval" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"past_due_at" timestamp with time zone,
	"grace_ends_at" timestamp with time zone,
	"stripe_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "billing_subscriptions_status_check" CHECK ("billing_subscriptions"."status" in ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete', 'incomplete_expired', 'canceled')),
	CONSTRAINT "billing_subscriptions_interval_check" CHECK ("billing_subscriptions"."billing_interval" in ('month', 'year'))
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"stripe_object_id" text,
	"stripe_created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_status_check" CHECK ("billing_webhook_events"."status" in ('processing', 'processed', 'failed', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "ai_usage_actions" ADD CONSTRAINT "ai_usage_actions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_actions" ADD CONSTRAINT "ai_usage_actions_user_id_period_start_ai_usage_periods_user_id_period_start_fk" FOREIGN KEY ("user_id","period_start") REFERENCES "public"."ai_usage_periods"("user_id","period_start") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_action_id_ai_usage_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."ai_usage_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_periods" ADD CONSTRAINT "ai_usage_periods_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_actions_user_period_idx" ON "ai_usage_actions" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "ai_usage_events_action_id_idx" ON "ai_usage_events" USING btree ("action_id");
--> statement-breakpoint
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_usage_periods" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_usage_actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "billing_customers", "billing_subscriptions", "billing_webhook_events", "ai_usage_periods", "ai_usage_actions", "ai_usage_events" FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE "billing_subscriptions", "ai_usage_periods", "ai_usage_actions" TO authenticated;
--> statement-breakpoint
CREATE POLICY "Users can view own subscription" ON "billing_subscriptions"
	FOR SELECT TO authenticated USING ((select auth.uid()) = "user_id");
--> statement-breakpoint
CREATE POLICY "Users can view own AI usage periods" ON "ai_usage_periods"
	FOR SELECT TO authenticated USING ((select auth.uid()) = "user_id");
--> statement-breakpoint
CREATE POLICY "Users can view own AI usage actions" ON "ai_usage_actions"
	FOR SELECT TO authenticated USING ((select auth.uid()) = "user_id");
