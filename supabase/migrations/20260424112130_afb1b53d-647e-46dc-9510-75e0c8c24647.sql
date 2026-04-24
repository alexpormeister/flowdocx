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
      AND pcr.status = 'draft'
  );
$$;