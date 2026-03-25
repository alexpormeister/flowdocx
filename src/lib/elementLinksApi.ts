import { supabase } from "@/integrations/supabase/client";

export interface ElementLink {
  id: string;
  project_id: string;
  element_id: string;
  linked_project_id: string;
  created_at: string;
}

export async function getElementLinks(projectId: string): Promise<ElementLink[]> {
  const { data, error } = await (supabase as any)
    .from("element_links")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw error;
  return data || [];
}

export async function createElementLink(
  projectId: string,
  elementId: string,
  linkedProjectId: string
): Promise<ElementLink> {
  const { data, error } = await (supabase as any)
    .from("element_links")
    .upsert(
      { project_id: projectId, element_id: elementId, linked_project_id: linkedProjectId },
      { onConflict: "project_id,element_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteElementLink(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("element_links")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
