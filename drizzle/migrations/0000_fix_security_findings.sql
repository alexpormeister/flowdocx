CREATE OR REPLACE FUNCTION public.org_has_members(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.org_has_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.org_has_members(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can insert members" ON public.organization_members;
CREATE POLICY "Admins can insert members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, 'admin'::org_role)
  OR (
    user_id = auth.uid()
    AND role = 'owner'::org_role
    AND NOT public.org_has_members(organization_id)
  )
);

DROP POLICY IF EXISTS "Backgrounds are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own backgrounds" ON storage.objects;
CREATE POLICY "Users can read their own backgrounds"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backgrounds'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_pending_shares() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_org_invite() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_accept_owner_membership() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_existing_user_to_org() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_member_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_org_deletion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_project_deletion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_process_change_review_copy() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_folder_access(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_org_project(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_org_folder(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_folder_restricted_for_user(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_process_change_review_project(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_restricted_folders(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_folder_system_tags(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_email() FROM anon;