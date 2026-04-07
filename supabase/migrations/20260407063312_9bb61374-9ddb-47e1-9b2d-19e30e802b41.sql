
-- Superadmins table
CREATE TABLE public.superadmins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid
);

ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check superadmin status
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.superadmins WHERE user_id = _user_id
  );
$$;

-- Only superadmins can view the superadmins table
CREATE POLICY "Superadmins can view superadmins" ON public.superadmins
FOR SELECT TO authenticated
USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert superadmins" ON public.superadmins
FOR INSERT TO authenticated
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete superadmins" ON public.superadmins
FOR DELETE TO authenticated
USING (public.is_superadmin(auth.uid()));

-- Seed the initial superadmin (pormeisteralex@gmail.com)
INSERT INTO public.superadmins (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'pormeisteralex@gmail.com'
ON CONFLICT DO NOTHING;
