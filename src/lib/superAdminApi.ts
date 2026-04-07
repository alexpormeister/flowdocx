import { supabase } from "@/integrations/supabase/client";

// --- Types ---
export interface AdminOrg {
  id: string;
  name: string;
  business_id: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  deleted_at: string | null;
  member_count?: number;
  project_count?: number;
}

export interface OrgQuota {
  id: string;
  organization_id: string;
  max_projects: number;
  max_users: number;
  max_systems: number;
}

export interface FeatureFlag {
  id: string;
  organization_id: string;
  feature_key: string;
  enabled: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  organization_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface DeletedOrg {
  id: string;
  original_org_id: string;
  org_data: any;
  projects_data: any[];
  members_data: any[];
  folders_data: any[];
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
}

// Available features
export const AVAILABLE_FEATURES = [
  { key: "system_mapping", label: "System Mapping" },
  { key: "dependency_graph", label: "Dependency Graph" },
  { key: "customer_lifecycle", label: "Customer Lifecycle Builder" },
  { key: "capability_map", label: "Business Capability Map" },
  { key: "role_inventory", label: "Role Inventory" },
  { key: "presentations", label: "Presentations" },
  { key: "export_org", label: "Export Organization" },
] as const;

// --- Organizations ---
export async function getAdminOrganizations(): Promise<AdminOrg[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data || []) as any[];
}

export async function suspendOrganization(orgId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ suspended_at: new Date().toISOString(), suspended_reason: reason } as any)
    .eq("id", orgId);
  if (error) throw error;
}

export async function unsuspendOrganization(orgId: string): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ suspended_at: null, suspended_reason: null } as any)
    .eq("id", orgId);
  if (error) throw error;
}

// --- Quotas ---
export async function getOrgQuotas(orgId: string): Promise<OrgQuota | null> {
  const { data, error } = await supabase
    .from("organization_quotas")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function upsertOrgQuotas(orgId: string, quotas: { max_projects: number; max_users: number; max_systems: number }): Promise<void> {
  const { error } = await supabase
    .from("organization_quotas")
    .upsert({ organization_id: orgId, ...quotas } as any, { onConflict: "organization_id" });
  if (error) throw error;
}

// --- Feature Flags ---
export async function getOrgFeatureFlags(orgId: string): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("organization_feature_flags")
    .select("*")
    .eq("organization_id", orgId);
  if (error) throw error;
  return (data || []) as any[];
}

export async function toggleFeatureFlag(orgId: string, featureKey: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("organization_feature_flags")
    .upsert({ organization_id: orgId, feature_key: featureKey, enabled } as any, { onConflict: "organization_id,feature_key" });
  if (error) throw error;
}

// --- Audit Logs ---
export async function getAuditLogs(filters?: { org_id?: string; action?: string; limit?: number }): Promise<AuditLog[]> {
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 100);

  if (filters?.org_id) query = query.eq("organization_id", filters.org_id);
  if (filters?.action) query = query.eq("action", filters.action);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as any[];
}

// --- Deleted Orgs ---
export async function getDeletedOrganizations(): Promise<DeletedOrg[]> {
  const { data, error } = await supabase
    .from("deleted_organizations")
    .select("*")
    .is("restored_at", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any[];
}

export async function archiveOrganization(orgId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-archive-org", {
    body: { action: "archive", org_id: orgId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function restoreOrganization(archiveId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-archive-org", {
    body: { action: "restore", archive_id: archiveId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// --- Analytics ---
export async function getUsageMetrics(): Promise<{
  total_projects: number;
  total_users: number;
  total_orgs: number;
  recent_projects_30d: number;
  org_stats: { org_id: string; org_name: string; project_count: number; member_count: number; last_activity: string }[];
}> {
  const [orgsRes, projectsRes, profilesRes, membersRes] = await Promise.all([
    supabase.from("organizations").select("id, name, created_at"),
    supabase.from("projects").select("id, organization_id, created_at, updated_at"),
    supabase.from("profiles").select("id"),
    supabase.from("organization_members").select("organization_id, user_id"),
  ]);

  const orgs = orgsRes.data || [];
  const projects = projectsRes.data || [];
  const profiles = profilesRes.data || [];
  const members = membersRes.data || [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentProjects = projects.filter(p => new Date(p.created_at) > thirtyDaysAgo);

  const orgStats = orgs.map(org => {
    const orgProjects = projects.filter(p => p.organization_id === org.id);
    const orgMembers = members.filter(m => m.organization_id === org.id);
    const lastActivity = orgProjects.length > 0
      ? orgProjects.reduce((latest, p) => p.updated_at > latest ? p.updated_at : latest, orgProjects[0].updated_at)
      : org.created_at;

    return {
      org_id: org.id,
      org_name: org.name,
      project_count: orgProjects.length,
      member_count: orgMembers.length,
      last_activity: lastActivity,
    };
  }).sort((a, b) => b.project_count - a.project_count);

  return {
    total_projects: projects.length,
    total_users: profiles.length,
    total_orgs: orgs.length,
    recent_projects_30d: recentProjects.length,
    org_stats: orgStats,
  };
}
