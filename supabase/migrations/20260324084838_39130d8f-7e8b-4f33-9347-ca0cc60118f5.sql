-- Allow members to check their own restrictions
CREATE OR REPLACE FUNCTION public.get_my_restricted_folders(_organization_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_record_id uuid;
  result text[];
BEGIN
  SELECT id INTO member_record_id
  FROM organization_members
  WHERE organization_id = _organization_id
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL;
  
  IF member_record_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;
  
  SELECT ARRAY_AGG(folder_id::text)
  INTO result
  FROM member_folder_restrictions
  WHERE member_id = member_record_id;
  
  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;