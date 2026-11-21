CREATE TABLE "profile_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_audit_events" ADD CONSTRAINT "profile_audit_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_audit_events_user_created_idx" ON "profile_audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "profile_audit_events" ENABLE ROW LEVEL SECURITY;
