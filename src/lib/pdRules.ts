export const PD_STATUSES = ['draft', 'active', 'review', 'archived'] as const;
export type PdStatus = typeof PD_STATUSES[number];
export interface PdStep {
  id: string; sort_order: number; step_code: string; task: string;
  performer_role_id: string | null; system_id: string | null;
  output: string; is_decision: boolean; next_step_codes: string[]; notes: string;
}
export function emptyStep(index: number): PdStep {
  return { id: crypto.randomUUID(), sort_order: index, step_code: String(index + 1), task: '', performer_role_id: null, system_id: null, output: '', is_decision: false, next_step_codes: [], notes: '' };
}
export function initialSteps(): PdStep[] { return Array.from({ length: 5 }, (_, i) => emptyStep(i)); }
export function canEditPd(role?: string | null): boolean { return ['owner', 'admin', 'editor'].includes(role || ''); }
export function isOverdue(acknowledgedAt: string | null, now = new Date()): boolean {
  if (!acknowledgedAt) return true;
  const limit = new Date(acknowledgedAt);
  limit.setFullYear(limit.getFullYear() + 1);
  return now > limit;
}
export function reorderSteps(steps: PdStep[], from: number, to: number): PdStep[] {
  if (from < 0 || to < 0 || from >= steps.length || to >= steps.length) return steps;
  const result = [...steps]; const [moved] = result.splice(from, 1);
  if (!moved) return steps;
  result.splice(to, 0, moved);
  return result.map((step, sort_order) => ({ ...step, sort_order }));
}
export function validateSteps(steps: PdStep[]): string | null {
  const codes = steps.map(s => s.step_code.trim());
  if (codes.some(code => !code) || new Set(codes).size !== codes.length) return 'codes';
  if (steps.some(s => s.next_step_codes.some(code => !codes.includes(code)))) return 'branches';
  return null;
}