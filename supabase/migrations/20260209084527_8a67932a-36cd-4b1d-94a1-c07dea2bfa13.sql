-- Fix: Make user_id nullable for pending invites and fix RLS policies

-- 1. Make user_id nullable for pending invites
ALTER TABLE public.organization_members ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the old RLS policy that accesses auth.users directly
DROP POLICY IF EXISTS "Members can view their organization's members" ON public.organization_members;

-- 3. Create a security definer function to get current user email
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- 4. Create new RLS policy without direct auth.users access
CREATE POLICY "Members can view their organization's members" 
ON public.organization_members 
FOR SELECT 
USING (
  has_org_role(auth.uid(), organization_id, 'viewer'::org_role) 
  OR email = get_current_user_email()
);

-- 5. Add notes column to folders
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS notes text;

-- 6. Add notes column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS notes text;

-- 7. Add notes column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS notes text;

-- 8. Create organization_positions table for org structure
CREATE TABLE IF NOT EXISTS public.organization_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_position_id uuid REFERENCES public.organization_positions(id) ON DELETE SET NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Link members to positions
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.organization_positions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS send_email_invite boolean DEFAULT false;

-- 10. Enable RLS on positions table
ALTER TABLE public.organization_positions ENABLE ROW LEVEL SECURITY;

-- 11. RLS policies for positions
CREATE POLICY "Members can view org positions"
ON public.organization_positions
FOR SELECT
USING (has_org_role(auth.uid(), organization_id, 'viewer'::org_role));

CREATE POLICY "Admins can manage org positions"
ON public.organization_positions
FOR INSERT
WITH CHECK (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

CREATE POLICY "Admins can update org positions"
ON public.organization_positions
FOR UPDATE
USING (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

CREATE POLICY "Admins can delete org positions"
ON public.organization_positions
FOR DELETE
USING (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

-- 12. Add trigger for updated_at on positions
CREATE TRIGGER update_organization_positions_updated_at
BEFORE UPDATE ON public.organization_positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();