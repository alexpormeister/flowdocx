
CREATE TABLE element_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  element_id text NOT NULL,
  linked_project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, element_id)
);

ALTER TABLE element_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_element_links" ON element_links
  FOR SELECT TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
    OR can_access_org_project(auth.uid(), project_id, 'view')
    OR has_project_access(auth.uid(), project_id, 'view')
  );

CREATE POLICY "insert_element_links" ON element_links
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
    OR can_access_org_project(auth.uid(), project_id, 'edit')
    OR has_project_access(auth.uid(), project_id, 'edit')
  );

CREATE POLICY "delete_element_links" ON element_links
  FOR DELETE TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
    OR can_access_org_project(auth.uid(), project_id, 'edit')
    OR has_project_access(auth.uid(), project_id, 'edit')
  );
