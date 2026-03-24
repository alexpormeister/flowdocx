CREATE OR REPLACE FUNCTION public.can_view_org_folder(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  folder_org_id uuid;
BEGIN
  SELECT organization_id INTO folder_org_id
  FROM public.folders
  WHERE id = _folder_id;

  IF folder_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_org_role(_user_id, folder_org_id, 'admin'::org_role) THEN
    RETURN true;
  END IF;

  IF NOT public.has_org_role(_user_id, folder_org_id, 'viewer'::org_role) THEN
    RETURN false;
  END IF;

  RETURN NOT public.is_folder_restricted_for_user(_user_id, _folder_id, folder_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_org_project(
  _user_id uuid,
  _project_id uuid,
  _permission text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_org_id uuid;
  project_folder_id uuid;
  min_role org_role;
BEGIN
  SELECT organization_id, folder_id
  INTO project_org_id, project_folder_id
  FROM public.projects
  WHERE id = _project_id;

  IF project_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_org_role(_user_id, project_org_id, 'admin'::org_role) THEN
    RETURN true;
  END IF;

  min_role := CASE
    WHEN _permission = 'edit' THEN 'editor'::org_role
    ELSE 'viewer'::org_role
  END;

  IF NOT public.has_org_role(_user_id, project_org_id, min_role) THEN
    RETURN false;
  END IF;

  IF project_folder_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT public.is_folder_restricted_for_user(_user_id, project_folder_id, project_org_id);
END;
$$;

DROP POLICY IF EXISTS "Users can view own or shared folders" ON public.folders;
CREATE POLICY "Users can view own or shared folders"
ON public.folders
FOR SELECT
TO public
USING (
  (auth.uid() = user_id)
  OR public.has_folder_access(auth.uid(), id, 'view'::text)
  OR public.can_view_org_folder(auth.uid(), id)
);

DROP POLICY IF EXISTS "Users can view own or shared projects" ON public.projects;
CREATE POLICY "Users can view own or shared projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR (is_template = true)
  OR public.has_project_access(auth.uid(), id, 'view'::text)
  OR public.can_access_org_project(auth.uid(), id, 'view')
);

DROP POLICY IF EXISTS "Users can update own or shared projects" ON public.projects;
CREATE POLICY "Users can update own or shared projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR public.has_project_access(auth.uid(), id, 'edit'::text)
  OR public.can_access_org_project(auth.uid(), id, 'edit')
);