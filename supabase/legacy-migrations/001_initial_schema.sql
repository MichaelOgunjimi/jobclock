-- ============================================================
-- Job Assistant (Clock) - Supabase Schema Migration
-- Run this in your Supabase SQL editor or via supabase db push
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',
  right_to_work_uk BOOLEAN,
  location_uk TEXT,
  desired_roles TEXT[],
  target_salary_min NUMERIC
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- USER CVS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_cvs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_file_path TEXT,
  parsed_json JSONB,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_primary BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own CVs" ON public.user_cvs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own CVs" ON public.user_cvs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own CVs" ON public.user_cvs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own CVs" ON public.user_cvs FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- JOBS CACHE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jobs_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  description TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'GBP',
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  is_easy_apply BOOLEAN DEFAULT FALSE,
  apply_deadline DATE
);

ALTER TABLE public.jobs_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view jobs" ON public.jobs_cache FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert jobs" ON public.jobs_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update jobs" ON public.jobs_cache FOR UPDATE USING (auth.role() = 'authenticated');

-- Index for search
CREATE INDEX IF NOT EXISTS idx_jobs_cache_title ON public.jobs_cache USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_jobs_cache_company ON public.jobs_cache (company);
CREATE INDEX IF NOT EXISTS idx_jobs_cache_location ON public.jobs_cache (location);

-- ============================================================
-- APPLICATIONS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'application_status'
  ) THEN
    CREATE TYPE application_status AS ENUM (
      'saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs_cache(id) ON DELETE SET NULL,
  status application_status DEFAULT 'saved',
  applied_at TIMESTAMPTZ,
  cover_letter_id UUID,
  customized_cv_id UUID,
  source TEXT,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_status_update TIMESTAMPTZ DEFAULT NOW(),
  auto_apply_attempted BOOLEAN DEFAULT FALSE,
  auto_apply_success BOOLEAN,
  application_quality_score INTEGER,
  right_to_work_confirmed BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications" ON public.applications FOR DELETE USING (auth.uid() = user_id);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON public.applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications (user_id, created_at DESC);

-- ============================================================
-- COVER LETTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cover_letters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  tone application_status,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cover letters" ON public.cover_letters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cover letters" ON public.cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cover letters" ON public.cover_letters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cover letters" ON public.cover_letters FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- CUSTOMIZED CVS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customized_cvs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  cv_json JSONB,
  pdf_path TEXT,
  ats_score INTEGER,
  skills_gap JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customized_cvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own customized CVs" ON public.customized_cvs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customized CVs" ON public.customized_cvs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customized CVs" ON public.customized_cvs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customized CVs" ON public.customized_cvs FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INTERVIEW PREP
-- ============================================================
CREATE TABLE IF NOT EXISTS public.interview_prep (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  questions TEXT[],
  suggested_answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.interview_prep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own interview prep" ON public.interview_prep FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));
CREATE POLICY "Users can insert own interview prep" ON public.interview_prep FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));
CREATE POLICY "Users can update own interview prep" ON public.interview_prep FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  base_salary NUMERIC,
  bonus TEXT,
  equity TEXT,
  benefits JSONB,
  remote_policy TEXT,
  start_date DATE,
  negotiation_notes TEXT
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own offers" ON public.offers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own offers" ON public.offers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own offers" ON public.offers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own offers" ON public.offers FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own CV" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own CVs" ON storage.objects
  FOR SELECT USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own CVs" ON storage.objects
  FOR DELETE USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
