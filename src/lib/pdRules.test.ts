import { describe, it, expect } from 'vitest';
import { initialSteps, canEditPd, PD_STATUSES, isOverdue, reorderSteps, validateSteps } from './pdRules';
describe('PD handbook rules', () => {
  it('creates five empty rows', () => { const rows = initialSteps(); expect(rows).toHaveLength(5); expect(rows.map(r => r.task)).toEqual(['','','','','']); });
  it('never allows viewers to edit', () => { expect(canEditPd('viewer')).toBe(false); expect(canEditPd(null)).toBe(false); });
  it('allows editors, admins and owners to edit', () => { for (const role of ['editor','admin','owner']) expect(canEditPd(role)).toBe(true); });
  it('supports the four requested statuses', () => expect(PD_STATUSES).toEqual(['draft','active','review','archived']));
  it('marks acknowledgements older than twelve months overdue', () => { expect(isOverdue('2025-10-27T00:00:00Z', new Date('2026-10-27T00:00:00Z'))).toBe(false); expect(isOverdue('2025-10-27T00:00:00Z', new Date('2026-10-28T00:00:00Z'))).toBe(true); });
  it('keeps stable step codes when reordering rows', () => { const rows = initialSteps(); const reordered = reorderSteps(rows, 0, 3); expect(reordered.map(r => r.step_code)).toEqual(['2','3','4','1','5']); expect(reordered.map(r => r.sort_order)).toEqual([0,1,2,3,4]); });
  it('rejects duplicate step codes and nonexistent branches', () => { const rows = initialSteps(); rows[1].step_code = '1'; expect(validateSteps(rows)).toBe('codes'); rows[1].step_code = '2'; rows[0].next_step_codes = ['3a']; expect(validateSteps(rows)).toBe('branches'); rows[2].step_code = '3a'; expect(validateSteps(rows)).toBe(null); });
});