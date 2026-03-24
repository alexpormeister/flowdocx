ALTER TABLE public.organizations
  ADD COLUMN primary_color text DEFAULT '#0f172a',
  ADD COLUMN accent_color text DEFAULT '#0891b2';