ALTER TABLE public.process_change_requests
  ALTER COLUMN step_id DROP NOT NULL,
  ALTER COLUMN step_name DROP NOT NULL,
  ALTER COLUMN proposed_description SET DEFAULT '';

CREATE OR REPLACE FUNCTION public.is_process_change_review_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.process_change_requests pcr
    WHERE pcr.review_project_id = _project_id
      AND pcr.submitted_by = _user_id
      AND pcr.status IN ('draft', 'pending')
  );
$$;

CREATE OR REPLACE FUNCTION public.create_process_change_review_copy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  source_project public.projects;
  new_project_id uuid;
  source_name text;
BEGIN
  SELECT * INTO source_project
  FROM public.projects
  WHERE id = NEW.source_project_id;

  IF source_project.id IS NULL THEN
    RAISE EXCEPTION 'Source project not found';
  END IF;

  IF source_project.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Project does not belong to organization';
  END IF;

  UPDATE public.projects
  SET status = 'review', updated_at = now()
  WHERE id = source_project.id;

  source_name := CASE
    WHEN NEW.step_name IS NULL OR length(trim(NEW.step_name)) = 0 THEN source_project.name
    ELSE NEW.step_name
  END;

  INSERT INTO public.projects (
    user_id,
    folder_id,
    name,
    description,
    bpmn_xml,
    process_steps,
    system_tags,
    thumbnail_url,
    is_template,
    template_category,
    organization_id,
    notes,
    owner_name,
    owner_email,
    status
  ) VALUES (
    NEW.submitted_by,
    source_project.folder_id,
    source_project.name || ' — muutosehdotus',
    source_project.description,
    source_project.bpmn_xml,
    source_project.process_steps,
    source_project.system_tags,
    source_project.thumbnail_url,
    false,
    source_project.template_category,
    source_project.organization_id,
    source_project.notes,
    source_project.owner_name,
    source_project.owner_email,
    'review'
  ) RETURNING id INTO new_project_id;

  NEW.review_project_id := new_project_id;
  NEW.step_name := source_name;
  NEW.step_id := COALESCE(NEW.step_id, 'process');
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can update own or shared projects" ON public.projects;
CREATE POLICY "Users can update own or shared projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_project_access(auth.uid(), id, 'edit'::text)
  OR can_access_org_project(auth.uid(), id, 'edit'::text)
  OR is_process_change_review_project(auth.uid(), id)
);

CREATE POLICY "Review owners can delete own draft review projects"
ON public.projects
FOR DELETE
TO authenticated
USING (public.is_process_change_review_project(auth.uid(), id));

DROP POLICY IF EXISTS "Org members can create process change requests" ON public.process_change_requests;
CREATE POLICY "Org members can create process change requests"
ON public.process_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = submitted_by
  AND has_org_role(auth.uid(), organization_id, 'viewer'::org_role)
  AND can_access_org_project(auth.uid(), source_project_id, 'view'::text)
);

CREATE POLICY "Submitters can update own draft change requests"
ON public.process_change_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = submitted_by AND status IN ('draft', 'pending'))
WITH CHECK (auth.uid() = submitted_by AND status IN ('draft', 'pending'));

CREATE POLICY "Org admins can delete process change requests"
ON public.process_change_requests
FOR DELETE
TO authenticated
USING (has_org_role(auth.uid(), organization_id, 'admin'::org_role));