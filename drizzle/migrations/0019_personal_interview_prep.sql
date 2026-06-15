CREATE TABLE "interview_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"application_id" uuid,
	"content" text NOT NULL,
	"evidence_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_profile_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"detail" text NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"text" text NOT NULL,
	"category" text NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_bank" ADD COLUMN "source_type" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "story_bank" ADD COLUMN "source_ref" text;--> statement-breakpoint
ALTER TABLE "story_bank" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_interview_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_answers_user_id_idx" ON "interview_answers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_answers_saved_general_unique" ON "interview_answers" USING btree ("user_id","question_id") WHERE "interview_answers"."application_id" is null and "interview_answers"."status" = 'saved';--> statement-breakpoint
CREATE UNIQUE INDEX "interview_answers_saved_tailored_unique" ON "interview_answers" USING btree ("user_id","question_id","application_id") WHERE "interview_answers"."application_id" is not null and "interview_answers"."status" = 'saved';--> statement-breakpoint
CREATE INDEX "interview_profile_facts_user_id_idx" ON "interview_profile_facts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_profile_facts_user_source_unique" ON "interview_profile_facts" USING btree ("user_id","source_type","source_ref");--> statement-breakpoint
CREATE INDEX "interview_questions_user_id_idx" ON "interview_questions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_questions_application_id_idx" ON "interview_questions" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_questions_user_source_unique" ON "interview_questions" USING btree ("user_id","source_type","source_ref") WHERE "interview_questions"."source_ref" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "story_bank_user_source_unique" ON "story_bank" USING btree ("user_id","source_type","source_ref") WHERE "story_bank"."source_ref" is not null;