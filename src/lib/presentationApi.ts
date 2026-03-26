import { supabase } from "@/integrations/supabase/client";

export interface PresentationToken {
  id: string;
  organization_id: string;
  token: string;
  name: string;
  created_by: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getPresentationTokens(orgId: string): Promise<PresentationToken[]> {
  const { data, error } = await supabase
    .from("presentation_tokens")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as PresentationToken[];
}

export async function createPresentationToken(
  orgId: string,
  name: string,
  expiresAt?: string
): Promise<PresentationToken> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("presentation_tokens")
    .insert({
      organization_id: orgId,
      name,
      created_by: user.id,
      expires_at: expiresAt || null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as PresentationToken;
}

export async function deletePresentationToken(id: string): Promise<void> {
  const { error } = await supabase
    .from("presentation_tokens")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function togglePresentationToken(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("presentation_tokens")
    .update({ is_active: isActive } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function lookupPresentationToken(token: string): Promise<PresentationToken | null> {
  const { data, error } = await supabase
    .from("presentation_tokens")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as PresentationToken | null;
}

// System tag groups junction
export async function getSystemTagGroups(systemTagId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("system_tag_groups")
    .select("group_id")
    .eq("system_tag_id", systemTagId);
  if (error) throw error;
  return (data || []).map((r: any) => r.group_id);
}

export async function getAllSystemTagGroups(orgId: string): Promise<Record<string, string[]>> {
  // Get all system tags for org, then their groups
  const { data: tags } = await supabase
    .from("organization_system_tags")
    .select("id")
    .eq("organization_id", orgId);
  if (!tags?.length) return {};

  const tagIds = tags.map((t: any) => t.id);
  const { data, error } = await supabase
    .from("system_tag_groups")
    .select("system_tag_id, group_id")
    .in("system_tag_id", tagIds);
  if (error) throw error;

  const result: Record<string, string[]> = {};
  for (const row of data || []) {
    const r = row as any;
    if (!result[r.system_tag_id]) result[r.system_tag_id] = [];
    result[r.system_tag_id].push(r.group_id);
  }
  return result;
}

export async function setSystemTagGroups(systemTagId: string, groupIds: string[]): Promise<void> {
  // Get current groups
  const { data: current } = await supabase
    .from("system_tag_groups")
    .select("id, group_id")
    .eq("system_tag_id", systemTagId);

  const currentIds = (current || []).map((r: any) => r.group_id);
  const toAdd = groupIds.filter((id) => !currentIds.includes(id));
  const toRemove = (current || []).filter((r: any) => !groupIds.includes(r.group_id));

  if (toRemove.length) {
    await supabase
      .from("system_tag_groups")
      .delete()
      .in("id", toRemove.map((r: any) => r.id));
  }

  if (toAdd.length) {
    await supabase
      .from("system_tag_groups")
      .insert(toAdd.map((gid) => ({ system_tag_id: systemTagId, group_id: gid })));
  }
}
