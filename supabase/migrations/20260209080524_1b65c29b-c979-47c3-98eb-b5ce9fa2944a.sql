-- Add system_tags to folders for custom tags per folder
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS system_tags text[] DEFAULT ARRAY[]::text[];

-- Create folder_shares table for folder-level sharing
CREATE TABLE public.folder_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(folder_id, shared_with_email)
);

-- Create project_shares table for project-level sharing
CREATE TABLE public.project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(project_id, shared_with_email)
);

-- Enable RLS
ALTER TABLE public.folder_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- Security definer function to check folder access
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid, _permission text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.folders WHERE id = _folder_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.folder_shares 
    WHERE folder_id = _folder_id 
      AND shared_with_user_id = _user_id
      AND (permission = _permission OR permission = 'edit')
  )
$$;

-- Security definer function to check project access
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid, _permission text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_shares 
    WHERE project_id = _project_id 
      AND shared_with_user_id = _user_id
      AND (permission = _permission OR permission = 'edit')
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.folder_shares fs ON fs.folder_id = p.folder_id
    WHERE p.id = _project_id 
      AND fs.shared_with_user_id = _user_id
      AND (fs.permission = _permission OR fs.permission = 'edit')
  )
$$;

-- RLS policies for folder_shares
CREATE POLICY "Users can view shares for their folders" ON public.folder_shares
FOR SELECT USING (
  public.has_folder_access(auth.uid(), folder_id, 'view') OR created_by = auth.uid()
);

CREATE POLICY "Users can create shares for their own folders" ON public.folder_shares
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.folders WHERE id = folder_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete shares they created" ON public.folder_shares
FOR DELETE USING (created_by = auth.uid());

-- RLS policies for project_shares
CREATE POLICY "Users can view shares for their projects" ON public.project_shares
FOR SELECT USING (
  public.has_project_access(auth.uid(), project_id, 'view') OR created_by = auth.uid()
);

CREATE POLICY "Users can create shares for their own projects" ON public.project_shares
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete shares they created" ON public.project_shares
FOR DELETE USING (created_by = auth.uid());

-- Update folders RLS to include shared access
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
CREATE POLICY "Users can view own or shared folders" ON public.folders
FOR SELECT USING (
  auth.uid() = user_id OR public.has_folder_access(auth.uid(), id, 'view')
);

-- Update projects RLS to include shared access
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own or shared projects" ON public.projects
FOR SELECT USING (
  auth.uid() = user_id OR is_template = true OR public.has_project_access(auth.uid(), id, 'view')
);

-- Function to get inherited system tags from folder hierarchy
CREATE OR REPLACE FUNCTION public.get_folder_system_tags(_folder_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[] := ARRAY[]::text[];
  current_id uuid := _folder_id;
  folder_tags text[];
BEGIN
  WHILE current_id IS NOT NULL LOOP
    SELECT system_tags, parent_id INTO folder_tags, current_id
    FROM public.folders WHERE id = current_id;
    
    IF folder_tags IS NOT NULL THEN
      result := result || folder_tags;
    END IF;
  END LOOP;
  
  RETURN ARRAY(SELECT DISTINCT unnest(result));
END;
$$;