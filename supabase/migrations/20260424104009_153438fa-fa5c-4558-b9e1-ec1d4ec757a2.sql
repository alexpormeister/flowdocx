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
  SET status = 'review', updated_at = now()
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
    'review'
  ) RETURNING id INTO new_project_id;

  NEW.review_project_id := new_project_id;
  RETURN NEW;
END;
$$;