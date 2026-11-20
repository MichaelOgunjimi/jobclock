CREATE TABLE "email_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"weekly_digest" boolean DEFAULT false NOT NULL,
	"follow_up_reminders" boolean DEFAULT false NOT NULL,
	"deadline_reminders" boolean DEFAULT false NOT NULL,
	"interview_reminders" boolean DEFAULT false NOT NULL,
	"job_alerts" boolean DEFAULT false NOT NULL,
	"stale_application_nudges" boolean DEFAULT false NOT NULL,
	"credit_alerts" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_sends_user_id_category_dedupe_key_pk" PRIMARY KEY("user_id","category","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_sends" ENABLE ROW LEVEL SECURITY;
