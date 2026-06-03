ALTER TYPE "public"."application_status" ADD VALUE 'ghosted';--> statement-breakpoint
CREATE TABLE "application_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "application_status_events" ("user_id", "application_id", "from_status", "to_status", "created_at")
SELECT "user_id", "id", NULL, "status", COALESCE("created_at", now())
FROM "applications"
WHERE "status" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "application_status_events_application_id_idx" ON "application_status_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_status_events_user_id_created_at_idx" ON "application_status_events" USING btree ("user_id","created_at");
