
-- Allow org editors+ to update folders within their organization
CREATE POLICY "Org editors can update org folders"
ON public.folders
FOR UPDATE
TO public
USING (
  organization_id IS NOT NULL 
  AND has_org_role(auth.uid(), organization_id, 'editor'::org_role)
);
