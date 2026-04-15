-- Drizzle-first Supabase platform setup
-- Run this AFTER the Drizzle schema migrations have been applied.
-- This file intentionally avoids creating app tables. It only adds
-- Supabase-specific behavior and cross-schema auth/storage setup.

-- ============================================================
-- AUTH-RELATED FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_cvs_user_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.user_cvs
      ADD CONSTRAINT user_cvs_user_id_auth_users_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_user_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_user_id_auth_users_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cover_letters_user_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.cover_letters
      ADD CONSTRAINT cover_letters_user_id_auth_users_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customized_cvs_user_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.customized_cvs
      ADD CONSTRAINT customized_cvs_user_id_auth_users_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_user_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_user_id_auth_users_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customized_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_prep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letter_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own CVs" ON public.user_cvs;
CREATE POLICY "Users can view own CVs" ON public.user_cvs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own CVs" ON public.user_cvs;
CREATE POLICY "Users can insert own CVs" ON public.user_cvs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own CVs" ON public.user_cvs;
CREATE POLICY "Users can update own CVs" ON public.user_cvs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own CVs" ON public.user_cvs;
CREATE POLICY "Users can delete own CVs" ON public.user_cvs FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view jobs" ON public.jobs_cache;
CREATE POLICY "Public can view jobs" ON public.jobs_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON public.jobs_cache;
CREATE POLICY "Authenticated users can insert jobs" ON public.jobs_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update jobs" ON public.jobs_cache;
CREATE POLICY "Authenticated users can update jobs" ON public.jobs_cache FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own applications" ON public.applications;
CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own applications" ON public.applications;
CREATE POLICY "Users can delete own applications" ON public.applications FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own cover letters" ON public.cover_letters;
CREATE POLICY "Users can view own cover letters" ON public.cover_letters FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cover letters" ON public.cover_letters;
CREATE POLICY "Users can insert own cover letters" ON public.cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cover letters" ON public.cover_letters;
CREATE POLICY "Users can update own cover letters" ON public.cover_letters FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cover letters" ON public.cover_letters;
CREATE POLICY "Users can delete own cover letters" ON public.cover_letters FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own customized CVs" ON public.customized_cvs;
CREATE POLICY "Users can view own customized CVs" ON public.customized_cvs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own customized CVs" ON public.customized_cvs;
CREATE POLICY "Users can insert own customized CVs" ON public.customized_cvs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own customized CVs" ON public.customized_cvs;
CREATE POLICY "Users can update own customized CVs" ON public.customized_cvs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own customized CVs" ON public.customized_cvs;
CREATE POLICY "Users can delete own customized CVs" ON public.customized_cvs FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own interview prep" ON public.interview_prep;
CREATE POLICY "Users can view own interview prep" ON public.interview_prep FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));

DROP POLICY IF EXISTS "Users can insert own interview prep" ON public.interview_prep;
CREATE POLICY "Users can insert own interview prep" ON public.interview_prep FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));

DROP POLICY IF EXISTS "Users can update own interview prep" ON public.interview_prep;
CREATE POLICY "Users can update own interview prep" ON public.interview_prep FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));

DROP POLICY IF EXISTS "Users can view own offers" ON public.offers;
CREATE POLICY "Users can view own offers" ON public.offers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own offers" ON public.offers;
CREATE POLICY "Users can insert own offers" ON public.offers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own offers" ON public.offers;
CREATE POLICY "Users can update own offers" ON public.offers FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own offers" ON public.offers;
CREATE POLICY "Users can delete own offers" ON public.offers FOR DELETE USING (auth.uid() = user_id);

-- cover_letter_structures: built-in visible to all, user-created scoped to owner
DROP POLICY IF EXISTS "Anyone can view built-in structures" ON public.cover_letter_structures;
CREATE POLICY "Anyone can view built-in structures" ON public.cover_letter_structures FOR SELECT
  USING (is_built_in = true);

DROP POLICY IF EXISTS "Users can view own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can view own structures" ON public.cover_letter_structures FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can insert own structures" ON public.cover_letter_structures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can update own structures" ON public.cover_letter_structures FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can delete own structures" ON public.cover_letter_structures FOR DELETE
  USING (auth.uid() = user_id);

-- interview_prep: add missing DELETE policy
DROP POLICY IF EXISTS "Users can delete own interview prep" ON public.interview_prep;
CREATE POLICY "Users can delete own interview prep" ON public.interview_prep FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM public.applications WHERE id = application_id));

-- ============================================================
-- SIGNUP PROFILE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SUPPORTING INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_cache_title ON public.jobs_cache USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_jobs_cache_company ON public.jobs_cache (company);
CREATE INDEX IF NOT EXISTS idx_jobs_cache_location ON public.jobs_cache (location);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON public.applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications (user_id, created_at DESC);

-- ============================================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own CV" ON storage.objects;
CREATE POLICY "Users can upload own CV" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view own CVs" ON storage.objects;
CREATE POLICY "Users can view own CVs" ON storage.objects
  FOR SELECT USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own CVs" ON storage.objects;
CREATE POLICY "Users can delete own CVs" ON storage.objects
  FOR DELETE USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own templates" ON storage.objects;
CREATE POLICY "Users can upload their own templates" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can read their own templates" ON storage.objects;
CREATE POLICY "Users can read their own templates" ON storage.objects
  FOR SELECT USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own templates" ON storage.objects;
CREATE POLICY "Users can update their own templates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own templates" ON storage.objects;
CREATE POLICY "Users can delete their own templates" ON storage.objects
  FOR DELETE USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);