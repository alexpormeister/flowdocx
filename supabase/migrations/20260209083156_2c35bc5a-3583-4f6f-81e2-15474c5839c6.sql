-- Create organization/workspace tables
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_id text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create enum for organization roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- Create organization members table with roles
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  role org_role NOT NULL DEFAULT 'viewer',
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Organization-level system tags (global tags for organization)
CREATE TABLE public.organization_system_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(organization_id, tag_name)
);

ALTER TABLE public.organization_system_tags ENABLE ROW LEVEL SECURITY;

-- Add organization_id to folders and projects
ALTER TABLE public.folders ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Function to check organization membership
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _organization_id uuid, _min_role org_role DEFAULT 'viewer')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role org_role;
  role_order int;
  min_role_order int;
BEGIN
  SELECT role INTO user_role FROM organization_members
  WHERE organization_id = _organization_id 
  AND user_id = _user_id 
  AND accepted_at IS NOT NULL;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Role hierarchy: owner > admin > editor > viewer
  SELECT CASE user_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
  END INTO role_order;
  
  SELECT CASE _min_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
  END INTO min_role_order;
  
  RETURN role_order >= min_role_order;
END;
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organizations.id
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
  )
);

CREATE POLICY "Owners and admins can update organizations"
ON public.organizations FOR UPDATE
USING (has_org_role(auth.uid(), id, 'admin'));

CREATE POLICY "Any authenticated user can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS for organization_members
CREATE POLICY "Members can view their organization's members"
ON public.organization_members FOR SELECT
USING (
  has_org_role(auth.uid(), organization_id, 'viewer')
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Admins can insert members"
ON public.organization_members FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), organization_id, 'admin')
  OR (
    -- Allow user to add themselves as owner when creating org
    user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "Admins can update members"
ON public.organization_members FOR UPDATE
USING (has_org_role(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can delete members"
ON public.organization_members FOR DELETE
USING (has_org_role(auth.uid(), organization_id, 'admin'));

-- RLS for organization_system_tags
CREATE POLICY "Members can view org tags"
ON public.organization_system_tags FOR SELECT
USING (has_org_role(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Editors can manage org tags"
ON public.organization_system_tags FOR INSERT
WITH CHECK (has_org_role(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Editors can delete org tags"
ON public.organization_system_tags FOR DELETE
USING (has_org_role(auth.uid(), organization_id, 'editor'));

-- Trigger to auto-link member when user accepts invite
CREATE OR REPLACE FUNCTION public.accept_org_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a new user registers, link any pending org invites
  UPDATE organization_members
  SET user_id = NEW.id, accepted_at = now()
  WHERE email = NEW.email AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Update the existing new user trigger to also handle org invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  -- Link pending folder/project shares
  UPDATE folder_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  UPDATE project_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  -- Link pending org invites
  UPDATE organization_members
  SET user_id = NEW.id, accepted_at = now()
  WHERE email = NEW.email AND accepted_at IS NULL;
  
  RETURN NEW;
END;
$$;

-- Update timestamp trigger for organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();