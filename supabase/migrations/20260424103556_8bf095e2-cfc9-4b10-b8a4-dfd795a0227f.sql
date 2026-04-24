CREATE TABLE public.process_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  source_project_id UUID NOT NULL,
  review_project_id UUID,
  step_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  current_description TEXT,
  proposed_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.process_change_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_process_change_requests_org_status ON public.process_change_requests (organization_id, status);
CREATE INDEX idx_process_change_requests_source_project ON public.process_change_requests (source_project_id);
CREATE INDEX idx_process_change_requests_review_project ON public.process_change_requests (review_project_id);

CREATE POLICY "Org members can view process change requests"
ON public.process_change_requests
FOR SELECT
TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, 'viewer'::org_role));

CREATE POLICY "Org members can create process change requests"
ON public.process_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = submitted_by
  AND public.has_org_role(auth.uid(), organization_id, 'viewer'::org_role)
  AND public.can_access_org_project(auth.uid(), source_project_id, 'view'::text)
);

CREATE POLICY "Org admins can update process change requests"
ON public.process_change_requests
FOR UPDATE
TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, 'admin'::org_role))
WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'::org_role));

CREATE OR REPLACE FUNCTION public.set_process_change_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_process_change_requests_updated_at
BEFORE UPDATE ON public.process_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_process_change_request_updated_at();

CREATE OR REPLACE FUNCTION public.create_process_change_review_copy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_project public.projects;
  new_steps jsonb;
  new_project_id uuid;
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

  new_steps := COALESCE(source_project.process_steps, '[]'::jsonb);
  new_steps := (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN step->>'id' = NEW.step_id THEN
          jsonb_set(
            jsonb_set(step, '{description}', to_jsonb(NEW.proposed_description), true),
            '{changeRequestId}', to_jsonb(NEW.id::text), true
          )
        ELSE step
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(new_steps) AS step
  );

  UPDATE public.projects
  SET status = 'under_review', updated_at = now()
  WHERE id = source_project.id;

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
    source_project.user_id,
    source_project.folder_id,
    source_project.name || ' — muutosehdotus',
    source_project.description,
    source_project.bpmn_xml,
    new_steps,
    source_project.system_tags,
    source_project.thumbnail_url,
    false,
    source_project.template_category,
    source_project.organization_id,
    source_project.notes,
    source_project.owner_name,
    source_project.owner_email,
    'under_review'
  ) RETURNING id INTO new_project_id;

  NEW.review_project_id := new_project_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_process_change_review_copy_before_insert
BEFORE INSERT ON public.process_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_process_change_review_copy();