-- Table to store folder restrictions per org member
-- If a row exists, the member CANNOT see that folder (and its children)
CREATE TABLE public.member_folder_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(member_id, folder_id)
);

ALTER TABLE public.member_folder_restrictions ENABLE ROW LEVEL SECURITY;

-- Admins can manage restrictions
CREATE POLICY "Admins can view restrictions"
ON public.member_folder_restrictions FOR SELECT
TO authenticated
USING (has_org_role(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can insert restrictions"
ON public.member_folder_restrictions FOR INSERT
TO authenticated
WITH CHECK (has_org_role(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can delete restrictions"
ON public.member_folder_restrictions FOR DELETE
TO authenticated
USING (has_org_role(auth.uid(), organization_id, 'admin'));

-- Function to check if a folder is restricted for a user (including parent inheritance)
CREATE OR REPLACE FUNCTION public.is_folder_restricted_for_user(_user_id uuid, _folder_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_id uuid := _folder_id;
  member_record_id uuid;
BEGIN
  -- Get the member record for this user in this org
  SELECT id INTO member_record_id
  FROM organization_members
  WHERE organization_id = _organization_id
    AND user_id = _user_id
    AND accepted_at IS NOT NULL;
  
  -- If not a member, not restricted (other policies handle visibility)
  IF member_record_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Walk up the folder tree checking for restrictions
  WHILE current_id IS NOT NULL LOOP
    IF EXISTS (
      SELECT 1 FROM member_folder_restrictions
      WHERE member_id = member_record_id
        AND folder_id = current_id
    ) THEN
      RETURN true;
    END IF;
    
    SELECT parent_id INTO current_id FROM folders WHERE id = current_id;
  END LOOP;
  
  RETURN false;
END;
$$;