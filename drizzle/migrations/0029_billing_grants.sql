CREATE TABLE "billing_grants" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"credit_limit" integer,
	"expires_at" timestamp with time zone,
	"note" text,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_grants_kind_check" CHECK ("billing_grants"."kind" in ('lifetime', 'comp')),
	CONSTRAINT "billing_grants_credit_limit_check" CHECK ("billing_grants"."credit_limit" is null or "billing_grants"."credit_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "billing_grants" ADD CONSTRAINT "billing_grants_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_grants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "billing_grants" FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE "billing_grants" TO authenticated;
--> statement-breakpoint
CREATE POLICY "Users can view own billing grant" ON "billing_grants"
	FOR SELECT TO authenticated USING ((select auth.uid()) = "user_id");
