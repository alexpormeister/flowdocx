
-- When a member is inserted, auto-link if the user already exists
CREATE OR REPLACE FUNCTION public.auto_link_existing_user_to_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_user_id uuid;
BEGIN
  -- If user_id is already set, skip
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Look up existing user by email
  SELECT id INTO existing_user_id FROM auth.users WHERE email = NEW.email;
  
  IF existing_user_id IS NOT NULL THEN
    NEW.user_id := existing_user_id;
    NEW.accepted_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to organization_members
DROP TRIGGER IF EXISTS auto_link_org_member ON public.organization_members;
CREATE TRIGGER auto_link_org_member
BEFORE INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_existing_user_to_org();
