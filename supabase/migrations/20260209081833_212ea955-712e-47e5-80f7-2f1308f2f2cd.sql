-- Update has_folder_access function to check by email as well as user_id
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid, _permission text DEFAULT 'view'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get the user's email
  SELECT email INTO user_email FROM auth.users WHERE id = _user_id;
  
  -- Check if user has direct access to this folder via share (by user_id or email)
  IF EXISTS (
    SELECT 1 FROM folder_shares
    WHERE folder_id = _folder_id
    AND (shared_with_user_id = _user_id OR shared_with_email = user_email)
    AND (permission = _permission OR permission = 'edit')
  ) THEN
    RETURN true;
  END IF;

  -- Check parent folders recursively for inherited access
  RETURN EXISTS (
    WITH RECURSIVE folder_tree AS (
      SELECT id, parent_id FROM folders WHERE id = _folder_id
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      INNER JOIN folder_tree ft ON f.id = ft.parent_id
    )
    SELECT 1 FROM folder_tree ft
    INNER JOIN folder_shares fs ON fs.folder_id = ft.id
    WHERE (fs.shared_with_user_id = _user_id OR fs.shared_with_email = user_email)
    AND (fs.permission = _permission OR fs.permission = 'edit')
  );
END;
$$;

-- Update has_project_access function similarly
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid, _permission text DEFAULT 'view'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  project_folder_id uuid;
BEGIN
  -- Get the user's email
  SELECT email INTO user_email FROM auth.users WHERE id = _user_id;
  
  -- Check direct project share
  IF EXISTS (
    SELECT 1 FROM project_shares
    WHERE project_id = _project_id
    AND (shared_with_user_id = _user_id OR shared_with_email = user_email)
    AND (permission = _permission OR permission = 'edit')
  ) THEN
    RETURN true;
  END IF;

  -- Get the project's folder and check folder access
  SELECT folder_id INTO project_folder_id FROM projects WHERE id = _project_id;
  
  IF project_folder_id IS NOT NULL AND has_folder_access(_user_id, project_folder_id, _permission) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Create trigger to link shares when a user signs up with an email that has pending shares
CREATE OR REPLACE FUNCTION public.link_pending_shares()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any folder shares for this email
  UPDATE folder_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  -- Link any project shares for this email
  UPDATE project_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_link_shares ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created_link_shares
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_pending_shares();

-- Also run the linking for existing users (one-time fix)
UPDATE folder_shares fs
SET shared_with_user_id = u.id
FROM auth.users u
WHERE fs.shared_with_email = u.email AND fs.shared_with_user_id IS NULL;

UPDATE project_shares ps
SET shared_with_user_id = u.id
FROM auth.users u
WHERE ps.shared_with_email = u.email AND ps.shared_with_user_id IS NULL;