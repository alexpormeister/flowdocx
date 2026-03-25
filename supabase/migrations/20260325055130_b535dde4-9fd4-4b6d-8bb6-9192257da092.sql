ALTER TABLE public.projects 
  ADD COLUMN owner_name text,
  ADD COLUMN owner_email text,
  ADD COLUMN status text NOT NULL DEFAULT 'draft';