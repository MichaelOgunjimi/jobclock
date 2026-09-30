CREATE TABLE "application_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "application_audit_events_owner_timeline_idx" ON "application_audit_events" USING btree ("user_id","application_id","created_at","id");--> statement-breakpoint
INSERT INTO "application_audit_events" ("application_id", "user_id", "event_type", "metadata", "created_at")
SELECT
	"id",
	"user_id",
	'application.created',
	jsonb_build_object('source', "source", 'backfilled', true),
	COALESCE("created_at", now())
FROM "applications";--> statement-breakpoint
INSERT INTO "application_audit_events" ("application_id", "user_id", "event_type", "metadata", "created_at")
SELECT
	"application_id",
	"user_id",
	'application.status_changed',
	jsonb_build_object(
		'fromStatus', "from_status",
		'toStatus', "to_status",
		'intent', 'backfill'
	),
	"created_at"
FROM "application_status_events";
