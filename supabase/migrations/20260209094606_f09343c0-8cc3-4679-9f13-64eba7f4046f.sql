-- The issue is that INSERT returns data via SELECT, but the SELECT policy
-- requires an organization_member to exist, which doesn't exist yet during INSERT.
-- Solution: Create a database function that does both operations atomically.

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_business_id TEXT DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org public.organizations;
  current_user_id UUID;
  current_user_email TEXT;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get user email
  SELECT email INTO current_user_email FROM auth.users WHERE id = current_user_id;
  
  -- Create organization
  INSERT INTO public.organizations (name, business_id)
  VALUES (org_name, org_business_id)
  RETURNING * INTO new_org;
  
  -- Create owner membership (accepted immediately)
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    email,
    role,
    invited_by,
    accepted_at
  ) VALUES (
    new_org.id,
    current_user_id,
    current_user_email,
    'owner',
    current_user_id,
    NOW()
  );
  
  RETURN new_org;
END;
$$;