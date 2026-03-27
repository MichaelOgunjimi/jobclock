-- Replace HTML columns with storage path columns for DOCX templates
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cv_template_html;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cover_letter_template_html;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_template_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_letter_template_path TEXT;

-- Create templates storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for templates bucket
CREATE POLICY "Users can upload their own templates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'templates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own templates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'templates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own templates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'templates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own templates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'templates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
