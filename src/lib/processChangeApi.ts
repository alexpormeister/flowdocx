import { supabase } from "@/integrations/supabase/client";
import { deleteProject, updateProject, type Project } from "@/lib/api";

export interface ProcessChangeRequest {
  id: string;
  organization_id: string;
  source_project_id: string;
  review_project_id: string | null;
  step_id: string;
  step_name: string;
  current_description: string | null;
  proposed_description: string;
  status: string;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProcessChangeRequest(input: {
  organizationId: string;
  sourceProjectId: string;
  stepId: string;
  stepName: string;
  currentDescription?: string | null;
  proposedDescription: string;
}): Promise<ProcessChangeRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Kirjaudu sisään lähettääksesi muutosehdotuksen.");

  const { data, error } = await supabase
    .from("process_change_requests")
    .insert({
      organization_id: input.organizationId,
      source_project_id: input.sourceProjectId,
      step_id: input.stepId,
      step_name: input.stepName,
      current_description: input.currentDescription || null,
      proposed_description: input.proposedDescription,
      submitted_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProcessChangeRequest;
}

export async function createProcessChangeDraft(input: {
  organizationId: string;
  sourceProjectId: string;
  projectName: string;
}): Promise<ProcessChangeRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Kirjaudu sisään luodaksesi muutosehdotuksen.");

  const { data, error } = await supabase
    .from("process_change_requests")
    .insert({
      organization_id: input.organizationId,
      source_project_id: input.sourceProjectId,
      step_id: "process",
      step_name: input.projectName,
      current_description: null,
      proposed_description: "",
      status: "draft",
      submitted_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProcessChangeRequest;
}

export async function getProcessChangeRequests(orgId: string): Promise<ProcessChangeRequest[]> {
  const { data, error } = await supabase
    .from("process_change_requests")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ProcessChangeRequest[];
}

export async function updateProcessChangeRequest(
  id: string,
  updates: Partial<Pick<ProcessChangeRequest, "status" | "review_comment" | "reviewed_by" | "reviewed_at">>,
): Promise<void> {
  const { error } = await supabase
    .from("process_change_requests")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function submitProcessChangeDraft(id: string): Promise<void> {
  await updateProcessChangeRequest(id, { status: "pending" });
}

export async function approveProcessChangeRequest(request: ProcessChangeRequest, projects: Project[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Kirjaudu sisään hyväksyäksesi muutoksen.");

  const sourceProject = projects.find((project) => project.id === request.source_project_id);
  const reviewProject = projects.find((project) => project.id === request.review_project_id);
  if (!sourceProject || !reviewProject) throw new Error("Prosessiversiota ei löytynyt.");

  await updateProject(sourceProject.id, {
    bpmn_xml: reviewProject.bpmn_xml,
    process_steps: reviewProject.process_steps,
    system_tags: reviewProject.system_tags,
    status: "published",
  });

  await updateProject(reviewProject.id, { status: "published" });

  await updateProcessChangeRequest(request.id, {
    status: "approved",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  });
}

export async function rejectProcessChangeRequest(id: string, comment?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Kirjaudu sisään käsitelläksesi ehdotuksen.");

  await updateProcessChangeRequest(id, {
    status: "rejected",
    review_comment: comment || null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  });
}

export async function closeProcessChangeRequest(request: ProcessChangeRequest, comment?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Kirjaudu sisään käsitelläksesi ehdotuksen.");

  if (request.review_project_id) {
    await deleteProject(request.review_project_id);
  }

  await updateProcessChangeRequest(request.id, {
    status: "approved",
    review_comment: comment || null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  });
}
