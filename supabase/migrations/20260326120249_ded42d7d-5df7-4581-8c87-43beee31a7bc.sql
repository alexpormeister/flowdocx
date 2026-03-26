
-- Add description, admin_position_id and group_id columns to organization_system_tags
ALTER TABLE public.organization_system_tags 
  ADD COLUMN description text DEFAULT NULL,
  ADD COLUMN admin_position_id uuid DEFAULT NULL REFERENCES public.organization_positions(id) ON DELETE SET NULL,
  ADD COLUMN group_id uuid DEFAULT NULL REFERENCES public.organization_groups(id) ON DELETE SET NULL;

-- Add UPDATE policy for editors
CREATE POLICY "Editors can update org tags"
  ON public.organization_system_tags
  FOR UPDATE
  TO public
  USING (has_org_role(auth.uid(), organization_id, 'editor'::org_role));
