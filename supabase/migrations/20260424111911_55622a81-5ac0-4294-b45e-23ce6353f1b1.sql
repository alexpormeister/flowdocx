DROP POLICY IF EXISTS "Org admins can delete review projects" ON public.projects;
CREATE POLICY "Org admins can delete review projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.process_change_requests pcr
    WHERE pcr.review_project_id = projects.id
      AND has_org_role(auth.uid(), pcr.organization_id, 'admin'::org_role)
  )
);