
-- 1. Add soft delete and suspension to organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suspended_reason text DEFAULT NULL;

-- 2. Organization quotas table
CREATE TABLE public.organization_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  max_projects integer DEFAULT 50,
  max_users integer DEFAULT 20,
  max_systems integer DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage quotas" ON public.organization_quotas
  FOR ALL TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Org members can view own quotas" ON public.organization_quotas
  FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'viewer'::org_role));

-- 3. Feature flags table
CREATE TABLE public.organization_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, feature_key)
);

ALTER TABLE public.organization_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage feature flags" ON public.organization_feature_flags
  FOR ALL TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Org members can view own feature flags" ON public.organization_feature_flags
  FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'viewer'::org_role));

-- 4. Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL,
  user_email text DEFAULT NULL,
  organization_id uuid DEFAULT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text DEFAULT NULL,
  entity_name text DEFAULT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin(auth.uid()));

-- 5. Soft-deleted orgs archive table
CREATE TABLE public.deleted_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_org_id uuid NOT NULL,
  org_data jsonb NOT NULL,
  projects_data jsonb DEFAULT '[]'::jsonb,
  members_data jsonb DEFAULT '[]'::jsonb,
  folders_data jsonb DEFAULT '[]'::jsonb,
  deleted_by uuid DEFAULT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz DEFAULT NULL
);

ALTER TABLE public.deleted_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage deleted orgs" ON public.deleted_organizations
  FOR ALL TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- 6. Add superadmin bypass policies for organizations
CREATE POLICY "Superadmins can view all organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can update all organizations" ON public.organizations
  FOR UPDATE TO authenticated
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete all organizations" ON public.organizations
  FOR DELETE TO authenticated
  USING (is_superadmin(auth.uid()));

-- 7. Superadmin bypass for profiles (to see all users)
CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_superadmin(auth.uid()));

-- 8. Superadmin bypass for org members
CREATE POLICY "Superadmins can view all org members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert org members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can update org members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete org members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (is_superadmin(auth.uid()));

-- 9. Superadmin bypass for projects
CREATE POLICY "Superadmins can view all projects" ON public.projects
  FOR SELECT TO authenticated
  USING (is_superadmin(auth.uid()));

-- 10. Superadmin bypass for folders
CREATE POLICY "Superadmins can view all folders" ON public.folders
  FOR SELECT TO authenticated
  USING (is_superadmin(auth.uid()));

-- 11. Update trigger for quotas
CREATE TRIGGER update_organization_quotas_updated_at
  BEFORE UPDATE ON public.organization_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_feature_flags_updated_at
  BEFORE UPDATE ON public.organization_feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Audit log trigger function for critical operations
CREATE OR REPLACE FUNCTION public.log_org_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, entity_name)
  VALUES (auth.uid(), OLD.id, 'delete', 'organization', OLD.id::text, OLD.name);
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_org_delete
  BEFORE DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION log_org_deletion();

CREATE OR REPLACE FUNCTION public.log_project_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, entity_name)
  VALUES (auth.uid(), OLD.organization_id, 'delete', 'project', OLD.id::text, OLD.name);
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_project_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION log_project_deletion();

CREATE OR REPLACE FUNCTION public.log_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, entity_name, details)
    VALUES (auth.uid(), OLD.organization_id, 'remove_member', 'organization_member', OLD.id::text, OLD.email,
      jsonb_build_object('role', OLD.role));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, entity_name, details)
      VALUES (auth.uid(), NEW.organization_id, 'change_role', 'organization_member', NEW.id::text, NEW.email,
        jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, entity_name, details)
    VALUES (auth.uid(), NEW.organization_id, 'add_member', 'organization_member', NEW.id::text, NEW.email,
      jsonb_build_object('role', NEW.role));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION log_member_change();
