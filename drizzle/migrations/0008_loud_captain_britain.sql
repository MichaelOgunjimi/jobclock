CREATE TABLE "cover_letter_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"slug" text,
	"label" text NOT NULL,
	"content" text NOT NULL,
	"default_tone" text DEFAULT 'professional' NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "structure_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cover_letter_tone" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_structure_id_cover_letter_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."cover_letter_structures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Remove old user-created base templates (no real users, clean slate)
DELETE FROM "cover_letters" WHERE "application_id" IS NULL;--> statement-breakpoint
-- Seed 3 built-in writing styles
INSERT INTO "cover_letter_structures" ("user_id", "slug", "label", "content", "default_tone", "is_built_in") VALUES
(NULL, 'professional', 'Professional', 'Dear [Hiring Manager / Hiring Team],

I am applying for the [Job Title] position at [Company Name]. My background in [degree, profession, or main area] and experience in [most relevant strengths] make this opportunity especially compelling. I am drawn to this role because [specific reason connected to the company, team, mission, or responsibilities].

In my background, I have developed experience in [relevant area 1] and [relevant area 2]. For example, I [describe one relevant piece of work, experience, or project], where I focused on [relevant responsibility, tool, or outcome]. This strengthened my ability to [tie directly to the role].

I also bring experience in [second relevant strength]. Through [another role, project, placement, academic work, or practical example], I developed [skills or qualities relevant to the job], which would allow me to contribute effectively in this position.

I am particularly interested in joining [Company Name] because [specific reason tied to the employer]. I would welcome the opportunity to contribute my background in [top matching strengths] and continue developing my impact in this role.

Sincerely,
[Your Name]', 'professional', true),
(NULL, 'motivated', 'Motivated', 'Dear [Hiring Manager / Hiring Team],

I am excited to apply for the [Job Title] position at [Company Name]. With a background in [degree, profession, or main area] and a strong interest in [relevant field or function], I am keen to bring my skills and motivation to a role where I can contribute and continue to grow. What stands out to me most about this opportunity is [specific reason related to the company or role].

I have built my experience through [education, work, self-study, projects, volunteering, or placements], which has helped me develop strengths in [relevant strengths]. For example, I [describe one practical example], which gave me hands-on experience in [relevant task, skill, responsibility, or tool]. This experience showed me the importance of [relevant lesson or quality tied to the role].

In addition, my experience in [second area] has strengthened my ability to [relevant capability]. I enjoy learning quickly, working through problems carefully, and applying feedback to improve. These qualities have helped me make progress in [relevant area], and I would bring the same approach to this role.

I am enthusiastic about the opportunity to join [Company Name] and contribute to [team, customers, service, product, or mission]. I would value the chance to bring my background, energy, and willingness to learn to your team.

Sincerely,
[Your Name]', 'enthusiastic', true),
(NULL, 'technical', 'Technical', 'Dear [Hiring Manager / Hiring Team],

I am applying for the [Job Title] position at [Company Name]. With a background in [degree, profession, or technical area] and experience in [key technical strengths], I am particularly interested in this opportunity because it aligns with my work in [relevant technologies, systems, or problem area].

In my recent work, I have focused on [technical domain such as backend development, data analysis, infrastructure, product engineering, or systems work]. For example, I [describe one relevant project, system, or implementation], using [tools, technologies, or stack], with a focus on [performance, reliability, scalability, maintainability, delivery, or user impact]. This strengthened my ability to [connect directly to the role requirements].

I have also worked on [second technical area]. Through [another project, role, or example], I gained experience in [relevant technologies, workflows, or engineering practices], and developed a practical understanding of [technical concept or responsibility relevant to the job].

I am drawn to [Company Name] because [specific reason tied to product, engineering challenges, users, or mission]. I would welcome the opportunity to contribute my experience in [top technical strengths] and help deliver reliable, effective work in this role.

Sincerely,
[Your Name]', 'professional', true);