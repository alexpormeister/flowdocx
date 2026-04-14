
CREATE TABLE public.customer_lifecycle_stage_lifecycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.customer_lifecycle_stages(id) ON DELETE CASCADE,
  linked_lifecycle_id UUID NOT NULL REFERENCES public.customer_lifecycles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_id, linked_lifecycle_id)
);

ALTER TABLE public.customer_lifecycle_stage_lifecycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stage lifecycles"
  ON public.customer_lifecycle_stage_lifecycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_lifecycle_stages s
      JOIN public.organization_members m ON m.organization_id = s.organization_id
      WHERE s.id = stage_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can manage stage lifecycles"
  ON public.customer_lifecycle_stage_lifecycles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_lifecycle_stages s
      JOIN public.organization_members m ON m.organization_id = s.organization_id
      WHERE s.id = stage_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin','editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_lifecycle_stages s
      JOIN public.organization_members m ON m.organization_id = s.organization_id
      WHERE s.id = stage_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin','editor')
    )
  );
