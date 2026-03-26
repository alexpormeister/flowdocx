
-- Organization groups table
CREATE TABLE public.organization_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Group-position junction table
CREATE TABLE public.organization_group_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.organization_groups(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.organization_positions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, position_id)
);

-- Enable RLS
ALTER TABLE public.organization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_group_positions ENABLE ROW LEVEL SECURITY;

-- RLS for organization_groups
CREATE POLICY "Members can view org groups" ON public.organization_groups
  FOR SELECT TO public
  USING (has_org_role(auth.uid(), organization_id, 'viewer'::org_role));

CREATE POLICY "Admins can insert org groups" ON public.organization_groups
  FOR INSERT TO public
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

CREATE POLICY "Admins can update org groups" ON public.organization_groups
  FOR UPDATE TO public
  USING (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

CREATE POLICY "Admins can delete org groups" ON public.organization_groups
  FOR DELETE TO public
  USING (has_org_role(auth.uid(), organization_id, 'admin'::org_role));

-- RLS for organization_group_positions (derive from parent group's org)
CREATE POLICY "Members can view group positions" ON public.organization_group_positions
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.organization_groups g
    WHERE g.id = group_id AND has_org_role(auth.uid(), g.organization_id, 'viewer'::org_role)
  ));

CREATE POLICY "Admins can insert group positions" ON public.organization_group_positions
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_groups g
    WHERE g.id = group_id AND has_org_role(auth.uid(), g.organization_id, 'admin'::org_role)
  ));

CREATE POLICY "Admins can delete group positions" ON public.organization_group_positions
  FOR DELETE TO public
  USING (EXISTS (
    SELECT 1 FROM public.organization_groups g
    WHERE g.id = group_id AND has_org_role(auth.uid(), g.organization_id, 'admin'::org_role)
  ));

-- Updated_at trigger for groups
CREATE TRIGGER update_organization_groups_updated_at
  BEFORE UPDATE ON public.organization_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
