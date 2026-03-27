
-- Customer lifecycle stages
CREATE TABLE public.customer_lifecycle_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  color text DEFAULT '#0891b2',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_lifecycle_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lifecycle stages" ON public.customer_lifecycle_stages
  FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Editors can insert lifecycle stages" ON public.customer_lifecycle_stages
  FOR INSERT TO authenticated
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Editors can update lifecycle stages" ON public.customer_lifecycle_stages
  FOR UPDATE TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Editors can delete lifecycle stages" ON public.customer_lifecycle_stages
  FOR DELETE TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'editor'));

-- Junction table: link processes to lifecycle stages
CREATE TABLE public.customer_lifecycle_stage_processes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id uuid NOT NULL REFERENCES public.customer_lifecycle_stages(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(stage_id, project_id)
);

ALTER TABLE public.customer_lifecycle_stage_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stage processes" ON public.customer_lifecycle_stage_processes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_lifecycle_stages s
    WHERE s.id = stage_id AND has_org_role(auth.uid(), s.organization_id, 'viewer')
  ));

CREATE POLICY "Editors can insert stage processes" ON public.customer_lifecycle_stage_processes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customer_lifecycle_stages s
    WHERE s.id = stage_id AND has_org_role(auth.uid(), s.organization_id, 'editor')
  ));

CREATE POLICY "Editors can delete stage processes" ON public.customer_lifecycle_stage_processes
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_lifecycle_stages s
    WHERE s.id = stage_id AND has_org_role(auth.uid(), s.organization_id, 'editor')
  ));
