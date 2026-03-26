import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export interface Organization {
  id: string;
  name: string;
  business_id: string | null;
  logo_url: string | null;
  notes: string | null;
  primary_color: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationPosition {
  id: string;
  organization_id: string;
  name: string;
  parent_position_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  role: OrgRole;
  invited_by: string | null;
  accepted_at: string | null;
  position_id: string | null;
  title: string | null;
  send_email_invite: boolean;
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
  const { data, error } = await supabase
    .rpc('create_organization_with_owner', {
      org_name: name,
      org_business_id: businessId || null
    });

  if (error) throw error;
  return data as Organization;
}

export async function updateOrganization(
  id: string,
  updates: { name?: string; business_id?: string; logo_url?: string; primary_color?: string; accent_color?: string }
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
  role: OrgRole,
  options?: { title?: string; positionId?: string; sendEmailInvite?: boolean }
): Promise<OrganizationMember> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if a user with this email already exists by looking up profiles
  // We use the admin-safe approach: insert with email, then auto-accept via trigger if user exists
  const { data, error } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: null,
      email,
      role,
      invited_by: user.id,
      title: options?.title || null,
      position_id: options?.positionId || null,
      send_email_invite: options?.sendEmailInvite ?? false,
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

// Organization Positions
export async function getOrganizationPositions(organizationId: string): Promise<OrganizationPosition[]> {
  const { data, error } = await supabase
    .from("organization_positions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createOrganizationPosition(
  organizationId: string,
  name: string,
  parentPositionId?: string
): Promise<OrganizationPosition> {
  const { data, error } = await supabase
    .from("organization_positions")
    .insert({
      organization_id: organizationId,
      name,
      parent_position_id: parentPositionId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrganizationPosition(
  positionId: string,
  updates: { name?: string; parent_position_id?: string | null; order_index?: number }
): Promise<OrganizationPosition> {
  const { data, error } = await supabase
    .from("organization_positions")
    .update(updates)
    .eq("id", positionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrganizationPosition(positionId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_positions")
    .delete()
    .eq("id", positionId);

  if (error) throw error;
}

export async function updateMemberDetails(
  memberId: string,
  updates: { title?: string; position_id?: string | null }
): Promise<OrganizationMember> {
  const { data, error } = await supabase
    .from("organization_members")
    .update(updates)
    .eq("id", memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrganizationNotes(
  organizationId: string,
  notes: string
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update({ notes })
    .eq("id", organizationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Folder Restrictions
export interface MemberFolderRestriction {
  id: string;
  organization_id: string;
  member_id: string;
  folder_id: string;
  created_at: string;
  created_by: string | null;
}

export async function getMemberFolderRestrictions(
  organizationId: string
): Promise<MemberFolderRestriction[]> {
  const { data, error } = await supabase
    .from("member_folder_restrictions")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) throw error;
  return data || [];
}

export async function getMyFolderRestrictions(
  organizationId: string
): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get current user's member record
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return [];

  const { data, error } = await supabase
    .from("member_folder_restrictions")
    .select("folder_id")
    .eq("member_id", member.id);

  if (error) {
    // Non-admins can't read restrictions directly, use RPC
    return [];
  }
  return (data || []).map(r => r.folder_id);
}

export async function addFolderRestriction(
  organizationId: string,
  memberId: string,
  folderId: string
): Promise<MemberFolderRestriction> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("member_folder_restrictions")
    .insert({
      organization_id: organizationId,
      member_id: memberId,
      folder_id: folderId,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFolderRestriction(restrictionId: string): Promise<void> {
  const { error } = await supabase
    .from("member_folder_restrictions")
    .delete()
    .eq("id", restrictionId);

  if (error) throw error;
}

export async function removeFolderRestrictionByMemberAndFolder(
  memberId: string,
  folderId: string
): Promise<void> {
  const { error } = await supabase
    .from("member_folder_restrictions")
    .delete()
    .eq("member_id", memberId)
    .eq("folder_id", folderId);

  if (error) throw error;
}

// Organization Groups
export interface OrganizationGroup {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationGroupPosition {
  id: string;
  group_id: string;
  position_id: string;
  created_at: string;
}

export async function getOrganizationGroups(organizationId: string): Promise<OrganizationGroup[]> {
  const { data, error } = await supabase
    .from("organization_groups")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createOrganizationGroup(
  organizationId: string,
  name: string
): Promise<OrganizationGroup> {
  const { data, error } = await supabase
    .from("organization_groups")
    .insert({ organization_id: organizationId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrganizationGroup(
  groupId: string,
  updates: { name?: string }
): Promise<OrganizationGroup> {
  const { data, error } = await supabase
    .from("organization_groups")
    .update(updates)
    .eq("id", groupId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrganizationGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_groups")
    .delete()
    .eq("id", groupId);

  if (error) throw error;
}

export async function getGroupPositions(groupId: string): Promise<OrganizationGroupPosition[]> {
  const { data, error } = await supabase
    .from("organization_group_positions")
    .select("*")
    .eq("group_id", groupId);

  if (error) throw error;
  return data || [];
}

export async function getOrganizationGroupsWithPositions(
  organizationId: string
): Promise<(OrganizationGroup & { position_ids: string[] })[]> {
  const groups = await getOrganizationGroups(organizationId);
  if (groups.length === 0) return [];

  const { data: allGroupPositions, error } = await supabase
    .from("organization_group_positions")
    .select("*")
    .in("group_id", groups.map(g => g.id));

  if (error) throw error;

  return groups.map(g => ({
    ...g,
    position_ids: (allGroupPositions || []).filter(gp => gp.group_id === g.id).map(gp => gp.position_id),
  }));
}

export async function addPositionToGroup(groupId: string, positionId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_group_positions")
    .insert({ group_id: groupId, position_id: positionId });

  if (error) throw error;
}

export async function removePositionFromGroup(groupId: string, positionId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_group_positions")
    .delete()
    .eq("group_id", groupId)
    .eq("position_id", positionId);

  if (error) throw error;
}
