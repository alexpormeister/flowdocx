
-- 1. Junction table for multiple groups per system tag
CREATE TABLE public.system_tag_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_tag_id uuid NOT NULL REFERENCES public.organization_system_tags(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.organization_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(system_tag_id, group_id)
);

ALTER TABLE public.system_tag_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view system tag groups" ON public.system_tag_groups
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM organization_system_tags t
    WHERE t.id = system_tag_groups.system_tag_id
    AND has_org_role(auth.uid(), t.organization_id, 'viewer'::org_role)
  ));

CREATE POLICY "Editors can insert system tag groups" ON public.system_tag_groups
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_system_tags t
    WHERE t.id = system_tag_groups.system_tag_id
    AND has_org_role(auth.uid(), t.organization_id, 'editor'::org_role)
  ));

CREATE POLICY "Editors can delete system tag groups" ON public.system_tag_groups
  FOR DELETE TO public
  USING (EXISTS (
    SELECT 1 FROM organization_system_tags t
    WHERE t.id = system_tag_groups.system_tag_id
    AND has_org_role(auth.uid(), t.organization_id, 'editor'::org_role)
  ));

-- 2. Add link_url column to organization_system_tags
ALTER TABLE public.organization_system_tags ADD COLUMN link_url text;

-- 3. Presentation share tokens table for public links
CREATE TABLE public.presentation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  name text NOT NULL DEFAULT 'Share Link',
  created_by uuid NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.presentation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage presentation tokens" ON public.presentation_tokens
  FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'admin'::org_role))
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

-- Public read policy for token lookup (anon users need to verify token)
CREATE POLICY "Anyone can look up active tokens" ON public.presentation_tokens
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- 4. Migrate existing group_id data to junction table
INSERT INTO public.system_tag_groups (system_tag_id, group_id)
SELECT id, group_id FROM public.organization_system_tags WHERE group_id IS NOT NULL;
