
-- Allow owners to delete their organizations
CREATE POLICY "Owners can delete organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (has_org_role(auth.uid(), id, 'owner'::org_role));

-- Cascade delete: when org is deleted, clean up related data
-- Add ON DELETE CASCADE to organization_members
ALTER TABLE public.organization_members
DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
ADD CONSTRAINT organization_members_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to organization_positions
ALTER TABLE public.organization_positions
DROP CONSTRAINT IF EXISTS organization_positions_organization_id_fkey,
ADD CONSTRAINT organization_positions_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to organization_system_tags
ALTER TABLE public.organization_system_tags
DROP CONSTRAINT IF EXISTS organization_system_tags_organization_id_fkey,
ADD CONSTRAINT organization_system_tags_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to organization_groups
ALTER TABLE public.organization_groups
DROP CONSTRAINT IF EXISTS organization_groups_organization_id_fkey,
ADD CONSTRAINT organization_groups_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to presentation_tokens
ALTER TABLE public.presentation_tokens
DROP CONSTRAINT IF EXISTS presentation_tokens_organization_id_fkey,
ADD CONSTRAINT presentation_tokens_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to member_folder_restrictions
ALTER TABLE public.member_folder_restrictions
DROP CONSTRAINT IF EXISTS member_folder_restrictions_organization_id_fkey,
ADD CONSTRAINT member_folder_restrictions_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to customer_lifecycles
ALTER TABLE public.customer_lifecycles
DROP CONSTRAINT IF EXISTS customer_lifecycles_organization_id_fkey,
ADD CONSTRAINT customer_lifecycles_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Nullify org reference on folders/projects when org is deleted
ALTER TABLE public.folders
DROP CONSTRAINT IF EXISTS folders_organization_id_fkey,
ADD CONSTRAINT folders_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_organization_id_fkey,
ADD CONSTRAINT projects_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
