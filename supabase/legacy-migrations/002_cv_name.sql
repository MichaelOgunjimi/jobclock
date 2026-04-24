-- Add name field to user_cvs so users can label their CVs
ALTER TABLE public.user_cvs ADD COLUMN IF NOT EXISTS name TEXT;
