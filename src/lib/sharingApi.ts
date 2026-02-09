import { supabase } from "@/integrations/supabase/client";

export interface FolderShare {
  id: string;
  folder_id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  permission: "view" | "edit";
  created_at: string;
  created_by: string;
}

export interface ProjectShare {
  id: string;
  project_id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  permission: "view" | "edit";
  created_at: string;
  created_by: string;
}

// Folder Shares
export async function getFolderShares(folderId: string): Promise<FolderShare[]> {
  const { data, error } = await supabase
    .from("folder_shares")
    .select("*")
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as FolderShare[];
}

export async function createFolderShare(
  folderId: string,
  email: string,
  permission: "view" | "edit"
): Promise<FolderShare> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("folder_shares")
    .insert({
      folder_id: folderId,
      shared_with_email: email,
      shared_with_user_id: null, // Will be linked when user with this email logs in
      permission,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FolderShare;
}

export async function deleteFolderShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from("folder_shares")
    .delete()
    .eq("id", shareId);

  if (error) throw error;
}

// Project Shares
export async function getProjectShares(projectId: string): Promise<ProjectShare[]> {
  const { data, error } = await supabase
    .from("project_shares")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ProjectShare[];
}

export async function createProjectShare(
  projectId: string,
  email: string,
  permission: "view" | "edit"
): Promise<ProjectShare> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("project_shares")
    .insert({
      project_id: projectId,
      shared_with_email: email,
      shared_with_user_id: null, // Will be linked when user accepts
      permission,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectShare;
}

export async function deleteProjectShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from("project_shares")
    .delete()
    .eq("id", shareId);

  if (error) throw error;
}

// Get inherited system tags for a folder
export async function getFolderSystemTags(folderId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_folder_system_tags", {
    _folder_id: folderId,
  });

  if (error) throw error;
  return data || [];
}
