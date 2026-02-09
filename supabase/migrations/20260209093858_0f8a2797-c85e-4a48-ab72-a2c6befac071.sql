
-- Fix: The issue is that when creating an organization, the SELECT policy requires
-- an organization_member with accepted_at NOT NULL, but that doesn't exist yet when
-- the .select() is called after INSERT.

-- Solution: Update the INSERT policy for organization_members to auto-set accepted_at for owners
-- and modify the organizations SELECT policy to allow creators to see their org immediately

-- First, let's add a trigger to auto-set accepted_at for owner memberships
CREATE OR REPLACE FUNCTION public.auto_accept_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'owner' AND NEW.user_id = auth.uid() THEN
    NEW.accepted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_accept_owner_membership_trigger
BEFORE INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.auto_accept_owner_membership();

-- Drop the existing SELECT policy on organizations that's too restrictive
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- Create a new SELECT policy that allows:
-- 1. Members who have accepted (existing behavior)
-- 2. Users who are about to become owners (for the brief moment during creation)
CREATE POLICY "Users can view their organizations" ON public.organizations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND (
      (organization_members.user_id = auth.uid() AND organization_members.accepted_at IS NOT NULL)
      OR
      (organization_members.user_id = auth.uid() AND organization_members.role = 'owner')
    )
  )
);
