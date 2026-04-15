-- Enable RLS on cover_letter_structures (was missing from Drizzle migration 0008)
ALTER TABLE public.cover_letter_structures ENABLE ROW LEVEL SECURITY;

-- Built-in structures (user_id IS NULL) are readable by all authenticated users
DROP POLICY IF EXISTS "Anyone can view built-in structures" ON public.cover_letter_structures;
CREATE POLICY "Anyone can view built-in structures" ON public.cover_letter_structures FOR SELECT
  USING (is_built_in = true);

-- Users can view their own custom structures
DROP POLICY IF EXISTS "Users can view own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can view own structures" ON public.cover_letter_structures FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own structures
DROP POLICY IF EXISTS "Users can insert own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can insert own structures" ON public.cover_letter_structures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own structures
DROP POLICY IF EXISTS "Users can update own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can update own structures" ON public.cover_letter_structures FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own structures
DROP POLICY IF EXISTS "Users can delete own structures" ON public.cover_letter_structures;
CREATE POLICY "Users can delete own structures" ON public.cover_letter_structures FOR DELETE
  USING (auth.uid() = user_id);

-- Add missing DELETE policy on interview_prep
DROP POLICY IF EXISTS "Users can delete own interview prep" ON public.interview_prep;
CREATE POLICY "Users can delete own interview prep" ON public.interview_prep FOR DELETE
  USING (auth.uid() = user_id);
