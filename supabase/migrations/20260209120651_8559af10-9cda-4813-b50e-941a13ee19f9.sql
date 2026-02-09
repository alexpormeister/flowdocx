
-- Fix: Allow invited members (matched by email) to also see the organization
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

CREATE POLICY "Users can view their organizations"
ON public.organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = organizations.id
    AND (
      (organization_members.user_id = auth.uid() AND organization_members.accepted_at IS NOT NULL)
      OR (organization_members.user_id = auth.uid() AND organization_members.role = 'owner'::org_role)
      OR (organization_members.email = get_current_user_email() AND organization_members.user_id IS NULL)
    )
  )
);
