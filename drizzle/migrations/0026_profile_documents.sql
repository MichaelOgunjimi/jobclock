CREATE TABLE "profile_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"issued_at" date,
	"expires_at" date,
	"credential_id" text,
	"credential_url" text,
	"original_file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_profile_facts" ADD COLUMN "source_document_id" uuid;--> statement-breakpoint
ALTER TABLE "profile_documents" ADD CONSTRAINT "profile_documents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_documents_user_id_idx" ON "profile_documents" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "interview_profile_facts" ADD CONSTRAINT "interview_profile_facts_source_document_id_profile_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."profile_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_profile_facts_source_document_id_idx" ON "interview_profile_facts" USING btree ("source_document_id");