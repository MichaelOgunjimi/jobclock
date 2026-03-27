-- Store converted HTML templates for CV and cover letter PDF generation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_template_html TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_letter_template_html TEXT;
