-- Fix: Allow shared/org users to update projects they have edit access to
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own or shared projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_project_access(auth.uid(), id, 'edit')
  OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'editor'))
);

-- Also ensure SELECT covers org members
DROP POLICY IF EXISTS "Users can view own or shared projects" ON public.projects;
CREATE POLICY "Users can view own or shared projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_template = true
  OR has_project_access(auth.uid(), id, 'view')
  OR (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'viewer'))
);