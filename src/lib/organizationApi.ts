import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export interface Organization {
  id: string;
  name: string;
  business_id: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  role: OrgRole;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface OrganizationSystemTag {
  id: string;
  organization_id: string;
  tag_name: string;
  created_at: string;
  created_by: string | null;
}

// Organizations
export async function getOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createOrganization(name: string, businessId?: string): Promise<Organization> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, business_id: businessId || null })
    .select()
    .single();

  if (orgError) throw orgError;

  // Add creator as owner
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      email: user.email!,
      role: "owner",
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    });

  if (memberError) throw memberError;

  return org;
}

export async function updateOrganization(
  id: string,
  updates: { name?: string; business_id?: string; logo_url?: string }
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Organization Members
export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function inviteOrganizationMember(
  organizationId: string,
  email: string,
  role: OrgRole
): Promise<OrganizationMember> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: user.id, // temporary, will be updated when user accepts
      email,
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMemberRole(
  memberId: string,
  role: OrgRole
): Promise<OrganizationMember> {
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeOrganizationMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId);

  if (error) throw error;
}

// Organization System Tags
export async function getOrganizationTags(organizationId: string): Promise<OrganizationSystemTag[]> {
  const { data, error } = await supabase
    .from("organization_system_tags")
    .select("*")
    .eq("organization_id", organizationId)
    .order("tag_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addOrganizationTag(
  organizationId: string,
  tagName: string
): Promise<OrganizationSystemTag> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("organization_system_tags")
    .insert({
      organization_id: organizationId,
      tag_name: tagName,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeOrganizationTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_system_tags")
    .delete()
    .eq("id", tagId);

  if (error) throw error;
}

// Get user's current organization membership
export async function getCurrentUserMembership(
  organizationId: string
): Promise<OrganizationMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
