-- Add label column to cover_letters for identifying template cover letters by role type
ALTER TABLE public.cover_letters ADD COLUMN IF NOT EXISTS label TEXT;

-- Fix tone column — it was created as application_status enum type, needs to be plain TEXT
ALTER TABLE public.cover_letters DROP COLUMN IF EXISTS tone;
ALTER TABLE public.cover_letters ADD COLUMN tone TEXT;
