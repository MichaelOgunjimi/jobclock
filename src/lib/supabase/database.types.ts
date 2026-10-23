export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			billing_customers: {
				Row: { user_id: string; stripe_customer_id: string; created_at: string; updated_at: string };
				Insert: { user_id: string; stripe_customer_id: string; created_at?: string; updated_at?: string };
				Update: { user_id?: string; stripe_customer_id?: string; created_at?: string; updated_at?: string };
				Relationships: [];
			};
			billing_grants: {
				Row: { user_id: string; kind: string; credit_limit: number | null; expires_at: string | null; note: string | null; granted_by: string | null; created_at: string };
				Insert: { user_id: string; kind: string; credit_limit?: number | null; expires_at?: string | null; note?: string | null; granted_by?: string | null; created_at?: string };
				Update: Partial<Database["public"]["Tables"]["billing_grants"]["Insert"]>;
				Relationships: [];
			};
			billing_subscriptions: {
				Row: {
					user_id: string; stripe_subscription_id: string; stripe_product_id: string;
					stripe_price_id: string; status: string; billing_interval: string;
					current_period_start: string; current_period_end: string; cancel_at_period_end: boolean;
					canceled_at: string | null; past_due_at: string | null; grace_ends_at: string | null;
					stripe_updated_at: string; created_at: string; updated_at: string;
				};
				Insert: {
					user_id: string; stripe_subscription_id: string; stripe_product_id: string;
					stripe_price_id: string; status: string; billing_interval: string;
					current_period_start: string; current_period_end: string; cancel_at_period_end?: boolean;
					canceled_at?: string | null; past_due_at?: string | null; grace_ends_at?: string | null;
					stripe_updated_at: string; created_at?: string; updated_at?: string;
				};
				Update: Partial<Database["public"]["Tables"]["billing_subscriptions"]["Insert"]>;
				Relationships: [];
			};
			billing_webhook_events: {
				Row: { stripe_event_id: string; type: string; stripe_object_id: string | null; stripe_created_at: string; processed_at: string | null; status: string; error: string | null; created_at: string };
				Insert: { stripe_event_id: string; type: string; stripe_object_id?: string | null; stripe_created_at: string; processed_at?: string | null; status: string; error?: string | null; created_at?: string };
				Update: Partial<Database["public"]["Tables"]["billing_webhook_events"]["Insert"]>;
				Relationships: [];
			};
			ai_usage_periods: {
				Row: { user_id: string; period_start: string; period_end: string; credit_limit: number; credits_reserved: number; credits_used: number; cost_limit_microusd: number; cost_reserved_microusd: number; cost_used_microusd: number; updated_at: string };
				Insert: { user_id: string; period_start: string; period_end: string; credit_limit: number; credits_reserved?: number; credits_used?: number; cost_limit_microusd: number; cost_reserved_microusd?: number; cost_used_microusd?: number; updated_at?: string };
				Update: Partial<Database["public"]["Tables"]["ai_usage_periods"]["Insert"]>;
				Relationships: [];
			};
			ai_usage_actions: {
				Row: { id: string; idempotency_key: string; user_id: string; period_start: string; feature: string; credential_source: string; status: string; credits: number; funding: string; estimated_cost_microusd: number; actual_cost_microusd: number; input_tokens: number; cached_input_tokens: number; output_tokens: number; created_at: string; settled_at: string | null };
				Insert: { id?: string; idempotency_key: string; user_id: string; period_start: string; feature: string; credential_source: string; status: string; credits: number; funding?: string; estimated_cost_microusd?: number; actual_cost_microusd?: number; input_tokens?: number; cached_input_tokens?: number; output_tokens?: number; created_at?: string; settled_at?: string | null };
				Update: Partial<Database["public"]["Tables"]["ai_usage_actions"]["Insert"]>;
				Relationships: [];
			};
			ai_credit_balances: {
				Row: { user_id: string; credits: number; updated_at: string };
				Insert: { user_id: string; credits?: number; updated_at?: string };
				Update: Partial<Database["public"]["Tables"]["ai_credit_balances"]["Insert"]>;
				Relationships: [];
			};
			ai_credit_purchases: {
				Row: { id: string; user_id: string; stripe_checkout_session_id: string; pack: string; credits: number; amount_pence: number; created_at: string };
				Insert: { id?: string; user_id: string; stripe_checkout_session_id: string; pack: string; credits: number; amount_pence: number; created_at?: string };
				Update: Partial<Database["public"]["Tables"]["ai_credit_purchases"]["Insert"]>;
				Relationships: [];
			};
			ai_usage_events: {
				Row: { id: string; action_id: string; provider_request_id: string | null; provider: string; model: string; input_tokens: number; cached_input_tokens: number; output_tokens: number; tool_cost_microusd: number; total_cost_microusd: number; price_version: string; created_at: string };
				Insert: { id?: string; action_id: string; provider_request_id?: string | null; provider: string; model: string; input_tokens?: number; cached_input_tokens?: number; output_tokens?: number; tool_cost_microusd?: number; total_cost_microusd?: number; price_version: string; created_at?: string };
				Update: Partial<Database["public"]["Tables"]["ai_usage_events"]["Insert"]>;
				Relationships: [];
			};
			profiles: {
				Row: {
					id: string;
					email: string;
					created_at: string;
					preferences: Json;
					allow_platform_ai_key: boolean;
					right_to_work_uk: boolean | null;
					locations_uk: string[] | null;
					desired_roles: string[] | null;
					target_salary_min: number | null;
					cv_template_path: string | null;
					cover_letter_template_path: string | null;
					experience_level: string[] | null;
					full_name: string | null;
					phone: string | null;
					linkedin_url: string | null;
					github_url: string | null;
					portfolio_url: string | null;
					avatar_url: string | null;
				};
				Insert: {
					id: string;
					email: string;
					created_at?: string;
					preferences?: Json;
					allow_platform_ai_key?: boolean;
					right_to_work_uk?: boolean | null;
					locations_uk?: string[] | null;
					desired_roles?: string[] | null;
					target_salary_min?: number | null;
					cv_template_path?: string | null;
					cover_letter_template_path?: string | null;
					experience_level?: string[] | null;
					full_name?: string | null;
					phone?: string | null;
					linkedin_url?: string | null;
					github_url?: string | null;
					portfolio_url?: string | null;
					avatar_url?: string | null;
				};
				Update: {
					id?: string;
					email?: string;
					created_at?: string;
					preferences?: Json;
					allow_platform_ai_key?: boolean;
					right_to_work_uk?: boolean | null;
					locations_uk?: string[] | null;
					desired_roles?: string[] | null;
					target_salary_min?: number | null;
					cv_template_path?: string | null;
					cover_letter_template_path?: string | null;
					experience_level?: string[] | null;
					full_name?: string | null;
					phone?: string | null;
					linkedin_url?: string | null;
					github_url?: string | null;
					portfolio_url?: string | null;
					avatar_url?: string | null;
				};
				Relationships: [];
			};
			user_cvs: {
				Row: {
					id: string;
					user_id: string;
					name: string | null;
					original_file_path: string | null;
					parsed_json: Json | null;
					review_findings: Json | null;
					file_path: string | null;
					created_at: string;
					is_primary: boolean | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					name?: string | null;
					original_file_path?: string | null;
					parsed_json?: Json | null;
					review_findings?: Json | null;
					file_path?: string | null;
					created_at?: string;
					is_primary?: boolean | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					name?: string | null;
					original_file_path?: string | null;
					parsed_json?: Json | null;
					review_findings?: Json | null;
					file_path?: string | null;
					created_at?: string;
					is_primary?: boolean | null;
				};
				Relationships: [];
			};
			profile_documents: {
				Row: {
					id: string;
					user_id: string;
					type: string;
					name: string;
					issuer: string | null;
					issued_at: string | null;
					expires_at: string | null;
					credential_id: string | null;
					credential_url: string | null;
					original_file_path: string;
					mime_type: string;
					file_size: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					type: string;
					name: string;
					issuer?: string | null;
					issued_at?: string | null;
					expires_at?: string | null;
					credential_id?: string | null;
					credential_url?: string | null;
					original_file_path: string;
					mime_type: string;
					file_size: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					type?: string;
					name?: string;
					issuer?: string | null;
					issued_at?: string | null;
					expires_at?: string | null;
					credential_id?: string | null;
					credential_url?: string | null;
					original_file_path?: string;
					mime_type?: string;
					file_size?: number;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			interview_profile_facts: {
				Row: {
					id: string;
					user_id: string;
					category: string;
					label: string;
					detail: string;
					source_type: string;
					source_ref: string | null;
					source_document_id: string | null;
					confirmed_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					category: string;
					label: string;
					detail: string;
					source_type: string;
					source_ref?: string | null;
					source_document_id?: string | null;
					confirmed_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					category?: string;
					label?: string;
					detail?: string;
					source_type?: string;
					source_ref?: string | null;
					source_document_id?: string | null;
					confirmed_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			jobs_cache: {
				Row: {
					id: string;
					url: string;
					source: string;
					title: string;
					company: string;
					location: string | null;
					description: string | null;
					salary_min: number | null;
					salary_max: number | null;
					salary_currency: string | null;
					posted_at: string | null;
					scraped_at: string;
					is_easy_apply: boolean | null;
					apply_deadline: string | null;
				};
				Insert: {
					id?: string;
					url: string;
					source: string;
					title: string;
					company: string;
					location?: string | null;
					description?: string | null;
					salary_min?: number | null;
					salary_max?: number | null;
					salary_currency?: string | null;
					posted_at?: string | null;
					scraped_at?: string;
					is_easy_apply?: boolean | null;
					apply_deadline?: string | null;
				};
				Update: {
					id?: string;
					url?: string;
					source?: string;
					title?: string;
					company?: string;
					location?: string | null;
					description?: string | null;
					salary_min?: number | null;
					salary_max?: number | null;
					salary_currency?: string | null;
					posted_at?: string | null;
					scraped_at?: string;
					is_easy_apply?: boolean | null;
					apply_deadline?: string | null;
				};
				Relationships: [];
			};
			cover_letter_structures: {
				Row: {
					id: string;
					user_id: string | null;
					slug: string | null;
					label: string;
					content: string;
					default_tone: "professional" | "enthusiastic" | "conservative" | "story";
					is_built_in: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id?: string | null;
					slug?: string | null;
					label: string;
					content: string;
					default_tone?: "professional" | "enthusiastic" | "conservative" | "story";
					is_built_in?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string | null;
					slug?: string | null;
					label?: string;
					content?: string;
					default_tone?: "professional" | "enthusiastic" | "conservative" | "story";
					is_built_in?: boolean;
					created_at?: string;
				};
				Relationships: [];
			};
			applications: {
				Row: {
					id: string;
					slug: string;
					user_id: string;
					job_id: string | null;
					status: ApplicationStatus;
					applied_at: string | null;
					cover_letter_id: string | null;
					selected_cv_id: string | null;
					structure_id: string | null;
					cover_letter_tone: "professional" | "enthusiastic" | "conservative" | "story" | null;
					source: string | null;
					notes: string | null;
					tags: string[] | null;
					created_at: string;
					last_status_update: string;
					auto_apply_attempted: boolean | null;
					auto_apply_success: boolean | null;
					application_quality_score: number | null;
					right_to_work_confirmed: boolean | null;
					custom_title: string | null;
					custom_company: string | null;
					custom_location: string | null;
					custom_salary_text: string | null;
					custom_description: string | null;
				};
				Insert: {
					id?: string;
					slug: string;
					user_id: string;
					job_id?: string | null;
					status?: ApplicationStatus;
					applied_at?: string | null;
					cover_letter_id?: string | null;
					selected_cv_id?: string | null;
					structure_id?: string | null;
					cover_letter_tone?: "professional" | "enthusiastic" | "conservative" | "story" | null;
					source?: string | null;
					notes?: string | null;
					tags?: string[] | null;
					created_at?: string;
					last_status_update?: string;
					auto_apply_attempted?: boolean | null;
					auto_apply_success?: boolean | null;
					application_quality_score?: number | null;
					right_to_work_confirmed?: boolean | null;
					custom_title?: string | null;
					custom_company?: string | null;
					custom_location?: string | null;
					custom_salary_text?: string | null;
					custom_description?: string | null;
				};
				Update: {
					id?: string;
					slug?: string;
					user_id?: string;
					job_id?: string | null;
					status?: ApplicationStatus;
					applied_at?: string | null;
					cover_letter_id?: string | null;
					selected_cv_id?: string | null;
					structure_id?: string | null;
					cover_letter_tone?: "professional" | "enthusiastic" | "conservative" | "story" | null;
					source?: string | null;
					notes?: string | null;
					tags?: string[] | null;
					created_at?: string;
					last_status_update?: string;
					auto_apply_attempted?: boolean | null;
					auto_apply_success?: boolean | null;
					application_quality_score?: number | null;
					right_to_work_confirmed?: boolean | null;
					custom_title?: string | null;
					custom_company?: string | null;
					custom_location?: string | null;
					custom_salary_text?: string | null;
					custom_description?: string | null;
				};
				Relationships: [];
			};
			application_status_events: {
				Row: {
					id: string;
					user_id: string;
					application_id: string;
					from_status: ApplicationStatus | null;
					to_status: ApplicationStatus;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					application_id: string;
					from_status?: ApplicationStatus | null;
					to_status: ApplicationStatus;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					application_id?: string;
					from_status?: ApplicationStatus | null;
					to_status?: ApplicationStatus;
					created_at?: string;
				};
				Relationships: [];
			};
			cover_letters: {
				Row: {
					id: string;
					user_id: string;
					application_id: string | null;
					label: string | null;
					content: string;
					tone:
						| "professional"
						| "enthusiastic"
						| "conservative"
						| "story"
						| null;
					created_at: string;
					reviewed: boolean | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					application_id?: string | null;
					label?: string | null;
					content: string;
					tone?:
						| "professional"
						| "enthusiastic"
						| "conservative"
						| "story"
						| null;
					created_at?: string;
					reviewed?: boolean | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					application_id?: string | null;
					label?: string | null;
					content?: string;
					tone?:
						| "professional"
						| "enthusiastic"
						| "conservative"
						| "story"
						| null;
					created_at?: string;
					reviewed?: boolean | null;
				};
				Relationships: [];
			};
			customized_cvs: {
				Row: {
					id: string;
					user_id: string;
					application_id: string | null;
					cv_json: Json | null;
					pdf_path: string | null;
					ats_score: number | null;
					skills_gap: Json | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					application_id?: string | null;
					cv_json?: Json | null;
					pdf_path?: string | null;
					ats_score?: number | null;
					skills_gap?: Json | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					application_id?: string | null;
					cv_json?: Json | null;
					pdf_path?: string | null;
					ats_score?: number | null;
					skills_gap?: Json | null;
					created_at?: string;
				};
				Relationships: [];
			};
			interview_prep: {
				Row: {
					id: string;
					application_id: string;
					questions: string[] | null;
					suggested_answers: Json | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					application_id: string;
					questions?: string[] | null;
					suggested_answers?: Json | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					application_id?: string;
					questions?: string[] | null;
					suggested_answers?: Json | null;
					created_at?: string;
				};
				Relationships: [];
			};
			offers: {
				Row: {
					id: string;
					user_id: string;
					application_id: string | null;
					company: string;
					role: string;
					base_salary: number | null;
					bonus: string | null;
					equity: string | null;
					benefits: Json | null;
					remote_policy: string | null;
					start_date: string | null;
					negotiation_notes: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					application_id?: string | null;
					company: string;
					role: string;
					base_salary?: number | null;
					bonus?: string | null;
					equity?: string | null;
					benefits?: Json | null;
					remote_policy?: string | null;
					start_date?: string | null;
					negotiation_notes?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					application_id?: string | null;
					company?: string;
					role?: string;
					base_salary?: number | null;
					bonus?: string | null;
					equity?: string | null;
					benefits?: Json | null;
					remote_policy?: string | null;
					start_date?: string | null;
					negotiation_notes?: string | null;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: {
			application_status: ApplicationStatus;
		};
		CompositeTypes: Record<string, never>;
	};
};

// Application status enum
export type ApplicationStatus =
	| "saved"
	| "applied"
	| "screening"
	| "interview"
	| "offer"
	| "rejected"
	| "withdrawn"
	| "ghosted";

export type CoverLetterTone = Database["public"]["Tables"]["cover_letters"]["Row"]["tone"];

export type CoverLetterTemplate = Pick<
	Database["public"]["Tables"]["cover_letters"]["Row"],
	"id" | "label" | "content" | "tone"
>;

export type WritingStyleTone = Database["public"]["Tables"]["cover_letter_structures"]["Row"]["default_tone"];

export type WritingStyle = Database["public"]["Tables"]["cover_letter_structures"]["Row"];

// Parsed CV data structure
export interface CvData {
	name?: string;
	/** Role-specific headline injected during tailoring (e.g. "Graduate Software Engineer") */
	headline?: string;
	email?: string;
	phone?: string;
	location?: string;
	linkedin?: string;
	website?: string;
	summary?: string;
	experience?: CvExperience[];
	education: CvEducation[];
	projects?: CvProject[];
	skills: string[];
	languages?: string[];
	certifications?: string[];
	activities?: CvExperience[];
}

export interface CvExperience {
	company: string;
	title: string;
	start_date?: string;
	end_date?: string;
	description: string;
	highlights?: string[];
	location?: string;
}

export interface CvEducation {
	institution: string;
	degree: string;
	field?: string;
	start_date?: string;
	end_date?: string;
	grade?: string;
	location?: string;
	gpa?: string;
	honors?: string;
	relevant_modules?: string[];
}

export interface CvProject {
	name: string;
	description: string;
	highlights?: string[];
	technologies?: string[];
	url?: string;
	code_url?: string;
	start_date?: string;
	end_date?: string;
}

// Cover letter render data (composed at render time from CV + job data)
export interface CoverLetterRenderData {
	content: string;
	sender: {
		name?: string;
		email?: string;
		phone?: string;
		location?: string;
		linkedin?: string;
		website?: string;
	};
	recipient: {
		name?: string;
		company?: string;
		jobTitle?: string;
	};
	date: string;
}

// Skills gap analysis result
export interface SkillsGap {
	matched: string[];
	missing: string[];
	suggestions: string[];
}

export type AppWithJob = Database["public"]["Tables"]["applications"]["Row"] & {
	jobs_cache: Database["public"]["Tables"]["jobs_cache"]["Row"] | null;
};
