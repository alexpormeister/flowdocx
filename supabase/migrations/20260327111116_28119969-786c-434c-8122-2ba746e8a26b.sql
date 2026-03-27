
-- Create customer_lifecycles table (multiple lifecycles per org)
CREATE TABLE public.customer_lifecycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Uusi elinkaari',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_lifecycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lifecycles" ON public.customer_lifecycles
  FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'viewer'::org_role));

CREATE POLICY "Editors can insert lifecycles" ON public.customer_lifecycles
  FOR INSERT TO authenticated
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'editor'::org_role));

CREATE POLICY "Editors can update lifecycles" ON public.customer_lifecycles
  FOR UPDATE TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'editor'::org_role));

CREATE POLICY "Editors can delete lifecycles" ON public.customer_lifecycles
  FOR DELETE TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'editor'::org_role));

-- Add lifecycle_id and position to existing stages table
ALTER TABLE public.customer_lifecycle_stages
  ADD COLUMN lifecycle_id UUID REFERENCES public.customer_lifecycles(id) ON DELETE CASCADE,
  ADD COLUMN position_x REAL NOT NULL DEFAULT 0,
  ADD COLUMN position_y REAL NOT NULL DEFAULT 0;

-- Create connections table for lines between stages
CREATE TABLE public.customer_lifecycle_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lifecycle_id UUID NOT NULL REFERENCES public.customer_lifecycles(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.customer_lifecycle_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.customer_lifecycle_stages(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_lifecycle_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view connections" ON public.customer_lifecycle_connections
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customer_lifecycles l
    WHERE l.id = customer_lifecycle_connections.lifecycle_id
    AND has_org_role(auth.uid(), l.organization_id, 'viewer'::org_role)
  ));

CREATE POLICY "Editors can insert connections" ON public.customer_lifecycle_connections
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM customer_lifecycles l
    WHERE l.id = customer_lifecycle_connections.lifecycle_id
    AND has_org_role(auth.uid(), l.organization_id, 'editor'::org_role)
  ));

CREATE POLICY "Editors can update connections" ON public.customer_lifecycle_connections
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customer_lifecycles l
    WHERE l.id = customer_lifecycle_connections.lifecycle_id
    AND has_org_role(auth.uid(), l.organization_id, 'editor'::org_role)
  ));

CREATE POLICY "Editors can delete connections" ON public.customer_lifecycle_connections
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customer_lifecycles l
    WHERE l.id = customer_lifecycle_connections.lifecycle_id
    AND has_org_role(auth.uid(), l.organization_id, 'editor'::org_role)
  ));
