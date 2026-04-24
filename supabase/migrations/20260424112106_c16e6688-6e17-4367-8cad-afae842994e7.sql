DROP POLICY IF EXISTS "Users can update own or shared projects" ON public.projects;
CREATE POLICY "Users can update own or shared projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  (organization_id IS NULL AND auth.uid() = user_id)
  OR has_project_access(auth.uid(), id, 'edit'::text)
  OR can_access_org_project(auth.uid(), id, 'edit'::text)
  OR is_process_change_review_project(auth.uid(), id)
);