import { useState } from 'react';
import { ArrowDown, ArrowUp, Diamond, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type PdStep, emptyStep, reorderSteps } from '@/lib/pdRules';
import type { PdListItem } from '@/lib/pdApi';

interface Props {
  steps: PdStep[]; onChange: (steps: PdStep[]) => void; readOnly: boolean;
  roles: PdListItem[]; systems: PdListItem[];
  onAddItem: (kind: 'roles' | 'systems', stepId: string) => void;
  text: (fi: string, en: string) => string;
}
export default function PdStepTable({ steps, onChange, readOnly, roles, systems, onAddItem, text }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const update = (id: string, values: Partial<PdStep>) => onChange(steps.map(s => s.id === id ? { ...s, ...values } : s));
  return <section className="space-y-3">
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table className="min-w-[1120px] table-fixed">
        <TableHeader><TableRow>
          <TableHead className="w-20" />
          <TableHead className="w-24">{text('Vaihe','Step')}</TableHead>
          <TableHead className="w-56">{text('Tehtävä','Task')}</TableHead>
          <TableHead className="w-44">{text('Tekijä','Performer')}</TableHead>
          <TableHead className="w-44">{text('Järjestelmä','System')}</TableHead>
          <TableHead className="w-48">{text('Tulos','Output')}</TableHead>
          <TableHead className="w-48">{text('Päätöspiste','Decision')}</TableHead>
          <TableHead className="w-12" />
        </TableRow></TableHeader>
        <TableBody>{steps.map((step, index) => <TableRow key={step.id}
          onDragOver={e => { if (!readOnly) e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); if (!readOnly && dragIndex !== null) onChange(reorderSteps(steps, dragIndex, index)); setDragIndex(null); }}
          className={step.is_decision ? 'bg-accent/10' : ''}>
          <TableCell className="align-top">
            {!readOnly && <div className="flex items-center gap-0.5">
              <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', step.id); setDragIndex(index); }} onDragEnd={() => setDragIndex(null)} className="cursor-grab text-muted-foreground" title={text('Siirrä riviä','Drag row')}><GripVertical className="h-4 w-4" /></span>
              <div className="flex flex-col"><Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} title={text('Siirrä ylös','Move up')} onClick={() => onChange(reorderSteps(steps, index, index - 1))}><ArrowUp /></Button><Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === steps.length - 1} title={text('Siirrä alas','Move down')} onClick={() => onChange(reorderSteps(steps, index, index + 1))}><ArrowDown /></Button></div>
            </div>}
          </TableCell>
          <TableCell className={`align-top ${/^\d+[a-z]/i.test(step.step_code) ? 'pl-5' : ''}`}><Input aria-label={text(`Vaihe ${index + 1}`,`Step ${index + 1}`)} value={step.step_code} disabled={readOnly} onChange={e => update(step.id, { step_code: e.target.value })} /></TableCell>
          <TableCell className="align-top"><Textarea aria-label={text(`Tehtävä ${index + 1}`,`Task ${index + 1}`)} value={step.task} disabled={readOnly} onChange={e => update(step.id, { task: e.target.value })} className="min-h-20 resize-y" /></TableCell>
          {(['roles','systems'] as const).map(kind => {
            const field = kind === 'roles' ? 'performer_role_id' : 'system_id'; const items = kind === 'roles' ? roles : systems;
            return <TableCell className="align-top" key={kind}><Select disabled={readOnly} value={step[field] || 'none'} onValueChange={value => value === 'add' ? onAddItem(kind, step.id) : update(step.id, { [field]: value === 'none' ? null : value })}>
              <SelectTrigger className="w-full [&>span]:truncate" aria-label={text(`${kind === 'roles' ? 'Tekijä' : 'Järjestelmä'} ${index + 1}`,`${kind === 'roles' ? 'Performer' : 'System'} ${index + 1}`)}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}<SelectItem value="add">+ {text('Lisää uusi','Add new')}</SelectItem></SelectContent>
            </Select></TableCell>;
          })}
          <TableCell className="align-top"><Textarea aria-label={text(`Tulos ${index + 1}`,`Output ${index + 1}`)} value={step.output} disabled={readOnly} onChange={e => update(step.id, { output: e.target.value })} className="min-h-20 resize-y" /></TableCell>
          <TableCell className="align-top"><label className="flex items-center gap-2"><Checkbox checked={step.is_decision} disabled={readOnly} onCheckedChange={value => update(step.id, { is_decision: value === true, next_step_codes: value === true ? step.next_step_codes : [] })} aria-label={text(`Päätöspiste ${index + 1}`,`Decision ${index + 1}`)} /><Diamond className="h-4 w-4 text-accent" /></label>
            {step.is_decision && <div className="mt-3 space-y-1"><span className="text-xs text-muted-foreground">{text('Jatkovaiheet','Next steps')}</span><Input aria-label={text(`Jatkovaiheet ${index + 1}`,`Next steps ${index + 1}`)} placeholder="3a, 3b" disabled={readOnly} value={step.next_step_codes.join(', ')} onChange={e => update(step.id, { next_step_codes: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></div>}
          </TableCell>
          <TableCell className="align-top">{!readOnly && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title={text('Poista rivi','Delete row')} aria-label={text(`Poista rivi ${index + 1}`,`Delete row ${index + 1}`)} onClick={() => onChange(steps.filter(s => s.id !== step.id).map((s, sort_order) => ({ ...s, sort_order })))}><Trash2 /></Button>}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
    {!readOnly && <Button variant="outline" onClick={() => { let code = steps.length + 1; while (steps.some(s => s.step_code === String(code))) code++; onChange([...steps, { ...emptyStep(steps.length), step_code: String(code) }]); }}><Plus />{text('Lisää vaihe','Add step')}</Button>}
  </section>;
}