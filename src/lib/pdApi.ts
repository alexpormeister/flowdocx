import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import type { PdStep } from './pdRules';
export type PdProcess = Tables<'pd_processes'>;
export type PdListItem = Tables<'pd_roles'>;
export type PdAcknowledgement = Tables<'pd_acknowledgements'>;
export async function getPdData(organizationId: string) {
  const [processes, roles, systems, acknowledgements] = await Promise.all([
    supabase.from('pd_processes').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('pd_roles').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('pd_systems').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('pd_acknowledgements').select('*, pd_processes!inner(organization_id)').eq('pd_processes.organization_id', organizationId).order('acknowledged_at', { ascending: false }),
  ]);
  for (const result of [processes, roles, systems, acknowledgements]) if (result.error) throw result.error;
  return { processes: processes.data || [], roles: roles.data || [], systems: systems.data || [], acknowledgements: acknowledgements.data || [] };
}
export async function getPdSteps(processId: string): Promise<PdStep[]> {
  const { data, error } = await supabase.from('pd_process_steps').select('*').eq('process_id', processId).order('sort_order');
  if (error) throw error;
  return data || [];
}
export async function savePdProcess(process: PdProcess, steps: PdStep[], isNew: boolean) {
  const { data, error } = await supabase.rpc('save_pd_process', {
    _process: process as unknown as Json, _steps: steps as unknown as Json,
    _expected_version: isNew ? undefined : process.version,
  });
  if (error) throw error;
  return data;
}
export async function addPdListItem(kind: 'roles' | 'systems', organizationId: string, name: string): Promise<PdListItem> {
  const table = kind === 'roles' ? 'pd_roles' : 'pd_systems';
  const normalized = name.trim();
  if (!normalized) throw new Error('Name required');
  const { data, error } = await supabase.from(table).insert({ organization_id: organizationId, name: normalized }).select().single();
  if (error?.code === '23505') {
    const { data: existing, error: lookupError } = await supabase.from(table).select('*').eq('organization_id', organizationId);
    if (lookupError) throw lookupError;
    const match = existing?.find(item => item.name.trim().toLowerCase() === normalized.toLowerCase());
    if (match) return match;
  }
  if (error) throw error;
  return data;
}