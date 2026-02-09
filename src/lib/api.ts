import { supabase } from "@/integrations/supabase/client";
import { ProcessStep } from "@/components/ProcessDataPanel";
import { Json } from "@/integrations/supabase/types";

export interface Project {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  bpmn_xml: string;
  process_steps: ProcessStep[];
  system_tags: string[];
  thumbnail_url: string | null;
  is_template: boolean;
  template_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  parent_id: string | null;
  system_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to safely parse process_steps
function parseProcessSteps(data: Json | null): ProcessStep[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data as unknown as ProcessStep[];
  }
  return [];
}

// Projects
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("is_template", false)
    .order("updated_at", { ascending: false });
  
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    process_steps: parseProcessSteps(p.process_steps),
  }));
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    process_steps: parseProcessSteps(data.process_steps),
  };
}

export async function createProject(project: {
  name: string;
  bpmn_xml: string;
  process_steps?: ProcessStep[];
  system_tags?: string[];
  folder_id?: string | null;
  description?: string;
}): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: project.name,
      bpmn_xml: project.bpmn_xml,
      process_steps: (project.process_steps || []) as unknown as Json,
      system_tags: project.system_tags || [],
      folder_id: project.folder_id || null,
      description: project.description || null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    process_steps: parseProcessSteps(data.process_steps),
  };
}

export async function updateProject(id: string, updates: {
  name?: string;
  bpmn_xml?: string;
  process_steps?: ProcessStep[];
  system_tags?: string[];
  folder_id?: string | null;
  description?: string;
}): Promise<Project> {
  const updatePayload: Record<string, unknown> = {};
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.bpmn_xml !== undefined) updatePayload.bpmn_xml = updates.bpmn_xml;
  if (updates.process_steps !== undefined) updatePayload.process_steps = updates.process_steps as unknown as Json;
  if (updates.system_tags !== undefined) updatePayload.system_tags = updates.system_tags;
  if (updates.folder_id !== undefined) updatePayload.folder_id = updates.folder_id;
  if (updates.description !== undefined) updatePayload.description = updates.description;

  const { data, error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    process_steps: parseProcessSteps(data.process_steps),
  };
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}

// Folders
export async function getFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .order("name", { ascending: true });
  
  if (error) throw error;
  return (data || []).map(f => ({
    ...f,
    system_tags: f.system_tags || [],
  }));
}

export async function createFolder(name: string, color?: string, parentId?: string | null, systemTags?: string[]): Promise<Folder> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: user.id,
      name,
      color: color || "#0891b2",
      parent_id: parentId || null,
      system_tags: systemTags || [],
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    system_tags: data.system_tags || [],
  };
}

export async function updateFolder(id: string, updates: { name?: string; color?: string; system_tags?: string[] }): Promise<Folder> {
  const { data, error } = await supabase
    .from("folders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    system_tags: data.system_tags || [],
  };
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}

// Profile
export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  
  if (error) throw error;
  return data;
}

export async function updateProfile(updates: { 
  display_name?: string; 
  avatar_url?: string;
  phone_number?: string;
  address?: string;
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
