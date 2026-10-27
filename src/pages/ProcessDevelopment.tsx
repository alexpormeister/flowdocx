import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ChevronRight, FolderOpen, Plus, Save, Menu, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getFolders } from '@/lib/api';
import { getOrganizations, getCurrentUserMembership, getOrganizationMembers } from '@/lib/organizationApi';
import { getPdData, getPdSteps, savePdProcess, addPdListItem, type PdProcess } from '@/lib/pdApi';
import { initialSteps, canEditPd, isOverdue, PD_STATUSES, validateSteps, type PdStep } from '@/lib/pdRules';
import { hexToHslString, hexToContrastHslString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import PdStepTable from '@/components/pd/PdStepTable';
import PdFolderTree from '@/components/pd/PdFolderTree';

const statusLabels: Record<string, [string, string]> = { draft: ['Luonnos','Draft'], active: ['Käytössä','Active'], review: ['Katselmoitavana','In review'], archived: ['Arkistoitu','Archived'] };
const statusClasses: Record<string, string> = { draft: 'bg-muted text-muted-foreground', active: 'pd-status-active', review: 'pd-status-review', archived: 'bg-secondary text-secondary-foreground' };

export default function ProcessDevelopment() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const text = (fi: string, en: string) => language === 'fi' ? fi : en;
  const navigate = useNavigate(); const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const orgId = params.get('org'); const folderId = params.get('folder'); const processId = params.get('process');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mobileTree, setMobileTree] = useState(false);
  const [draft, setDraft] = useState<PdProcess | null>(null);
  const [steps, setSteps] = useState<PdStep[]>([]);
  const [isNew, setIsNew] = useState(false); const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState(''); const [newDialog, setNewDialog] = useState(false);
  const [listDialog, setListDialog] = useState<{ kind: 'roles' | 'systems'; stepId: string } | null>(null);
  const [itemName, setItemName] = useState(''); const [addingItem, setAddingItem] = useState(false);
  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [authLoading, user, navigate]);
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: getOrganizations, enabled: !!user });
  const folderQuery = useQuery({ queryKey: ['folders'], queryFn: getFolders, enabled: !!user });
  const membership = useQuery({ queryKey: ['org-membership', orgId], queryFn: () => orgId ? getCurrentUserMembership(orgId) : Promise.resolve(null), enabled: !!user && !!orgId });
  const members = useQuery({ queryKey: ['org-members', orgId], queryFn: () => orgId ? getOrganizationMembers(orgId) : Promise.resolve([]), enabled: !!user && !!orgId });
  const dataQuery = useQuery({ queryKey: ['pd', orgId], queryFn: () => getPdData(orgId || ''), enabled: !!user && !!orgId });
  const stepQuery = useQuery({ queryKey: ['pd-steps', processId], queryFn: () => getPdSteps(processId || ''), enabled: !!user && !!processId });
  const org = organizations.data?.find(o => o.id === orgId);
  const folders = useMemo(() => (folderQuery.data || []).filter(f => f.organization_id === orgId), [folderQuery.data, orgId]);
  const data = dataQuery.data;
  const processes = data?.processes || [];
  const folder = folders.find(f => f.id === folderId);
  const process = processes.find(p => p.id === processId);
  const editable = canEditPd(membership.data?.role);
  const path = useMemo(() => {
    const result: typeof folders = []; const seen = new Set<string>(); let id = folderId;
    while (id && !seen.has(id)) { seen.add(id); const found = folders.find(f => f.id === id); if (!found) break; result.unshift(found); id = found.parent_id; }
    return result;
  }, [folders, folderId]);
  useEffect(() => { setExpanded(prev => new Set([...prev, ...path.map(f => f.id)])); }, [path]);
  useEffect(() => {
    if (process && stepQuery.data && !dirty) { setDraft(process); setSteps(stepQuery.data); setIsNew(false); }
  }, [process, stepQuery.data, dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const theme = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [token, color] of [['primary', org?.primary_color], ['accent', org?.accent_color]]) {
      if (!color) continue; const hsl = hexToHslString(color); if (!hsl) continue;
      result[`--${token}`] = hsl; result[`--${token}-foreground`] = hexToContrastHslString(color);
      if (token === 'primary') result['--ring'] = hsl;
    }
    return result as CSSProperties;
  }, [org]);
  const go = (nextFolder: string | null, nextProcess?: string) => {
    if (dirty && !window.confirm(text('Hylätäänkö tallentamattomat muutokset?','Discard unsaved changes?'))) return;
    setDirty(false); setDraft(null); setIsNew(false); setMobileTree(false);
    const next = new URLSearchParams(); if (orgId) next.set('org', orgId); if (nextFolder) next.set('folder', nextFolder); if (nextProcess) next.set('process', nextProcess); setParams(next);
  };
  const updateDraft = (values: Partial<PdProcess>) => { if (!draft) return; setDraft({ ...draft, ...values }); setDirty(true); };
  const latestAck = (id: string) => data?.acknowledgements.find(a => a.process_id === id)?.acknowledged_at || null;
  const memberName = (id: string | null) => members.data?.find(m => m.user_id === id)?.email || '—';
  const statusBadge = (status: string) => { const labels = statusLabels[status] || statusLabels.draft; return <Badge variant="outline" className={statusClasses[status]}>{text(labels[0], labels[1])}</Badge>; };
  const descendants = (id: string) => {
    const result = new Set([id]); let changed = true;
    while (changed) { changed = false; for (const f of folders) if (f.parent_id && result.has(f.parent_id) && !result.has(f.id)) { result.add(f.id); changed = true; } }
    return result;
  };
  const save = async () => {
    if (!draft || !editable || saving) return;
    if (!draft.name.trim()) { toast.error(text('Anna prosessille nimi','Enter a process name')); return; }
    const invalid = validateSteps(steps);
    if (invalid) { toast.error(invalid === 'codes' ? text('Vaihekoodien pitää olla yksilöllisiä ja täytettyjä.','Step codes must be unique and nonempty.') : text('Jatkovaiheen koodin täytyy löytyä taulukosta.','Next step codes must exist in the table.')); return; }
    setSaving(true);
    try {
      const saved = await savePdProcess(draft, steps, isNew);
      setDirty(false); setIsNew(false); setDraft(saved);
      await Promise.all([cache.invalidateQueries({ queryKey: ['pd', orgId] }), cache.invalidateQueries({ queryKey: ['pd-steps', draft.id] })]);
      const next = new URLSearchParams(params); next.set('process', saved.id); next.set('folder', saved.folder_id); setParams(next, { replace: true });
      toast.success(text('Prosessi tallennettu','Process saved'));
    } catch (error) { toast.error(text('Tallennus epäonnistui: ','Save failed: ') + (error instanceof Error ? error.message : (error as { message?: string }).message || '')); }
    finally { setSaving(false); }
  };
  const create = () => {
    if (!orgId || !folder || !newName.trim() || !editable) return;
    if (dirty && !window.confirm(text('Hylätäänkö tallentamattomat muutokset?','Discard unsaved changes?'))) return;
    const now = new Date().toISOString();
    setDraft({ id: crypto.randomUUID(), organization_id: orgId, folder_id: folder.id, name: newName.trim(), description: '', owner_user_id: user?.id || null, status: 'draft', version: 1, bpmn_model_id: null, created_at: now, updated_at: now });
    setSteps(initialSteps()); setIsNew(true); setDirty(true); setNewDialog(false); setNewName('');
  };
  const addItem = async () => {
    if (!listDialog || !orgId || !itemName.trim() || !editable) return;
    setAddingItem(true);
    try {
      const item = await addPdListItem(listDialog.kind, orgId, itemName);
      const field = listDialog.kind === 'roles' ? 'performer_role_id' : 'system_id';
      setSteps(prev => prev.map(s => s.id === listDialog.stepId ? { ...s, [field]: item.id } : s)); setDirty(true);
      await cache.invalidateQueries({ queryKey: ['pd', orgId] }); setListDialog(null); setItemName('');
    } catch { toast.error(text('Lisääminen epäonnistui','Could not add item')); } finally { setAddingItem(false); }
  };
  const tree = <PdFolderTree folders={folders} processes={processes} folderId={folderId} processId={processId} expanded={expanded} onToggle={id => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onNavigate={go} rootLabel={text('Osastot','Departments')} />;
  if (authLoading || !user) return <div className="p-8 text-muted-foreground">{text('Ladataan…','Loading…')}</div>;
  const loading = organizations.isLoading || folderQuery.isLoading || dataQuery.isLoading || membership.isLoading;
  const error = organizations.error || folderQuery.error || dataQuery.error || membership.error;
  return <div className="min-h-screen bg-background" style={theme}>
    <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-primary px-3 py-2 text-primary-foreground md:px-6">
      <Button variant="ghost" size="icon" aria-label={text('Takaisin työpöydälle','Back to dashboard')} onClick={() => { if (!dirty || window.confirm(text('Hylätäänkö tallentamattomat muutokset?','Discard unsaved changes?'))) navigate(`/dashboard?${new URLSearchParams({ ...(orgId ? { org: orgId } : {}), ...(folderId ? { folder: folderId } : {}) })}`); }}><ArrowLeft /></Button>
      <BookOpen className="h-5 w-5 shrink-0" /><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">PD <span className="font-normal opacity-80">— {org?.name || 'Nexus'}</span></h1>
      <span className="hidden text-sm sm:block">{text('Prosessikäsikirja','Process handbook')}</span>
    </header>
    {!orgId ? <main className="mx-auto max-w-5xl p-6"><h2 className="mb-5 text-2xl font-semibold">{text('Valitse organisaatio','Choose organization')}</h2><div className="grid gap-3 sm:grid-cols-2">{organizations.data?.map(o => <Button key={o.id} variant="outline" className="h-auto justify-between p-5" onClick={() => setParams({ org: o.id })}>{o.name}<ChevronRight /></Button>)}</div></main>
      : loading ? <div className="p-8 text-muted-foreground">{text('Ladataan…','Loading…')}</div>
      : error ? <div role="alert" className="p-8"><AlertCircle className="mb-3 text-destructive" /><p>{text('Prosessikäsikirjaa ei voitu ladata.','The handbook could not be loaded.')}</p><Button variant="outline" className="mt-4" onClick={() => { void dataQuery.refetch(); void folderQuery.refetch(); void membership.refetch(); }}>{text('Yritä uudelleen','Retry')}</Button></div>
      : !org || !membership.data?.accepted_at ? <div className="p-8">{text('Sinulla ei ole pääsyä tähän organisaatioon.','You do not have access to this organization.')}</div>
      : <div className="flex">
        <aside className="sticky top-0 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-auto border-r bg-card p-3 lg:block">{tree}</aside>
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          <div className="mb-6 flex items-start gap-2">
            <Sheet open={mobileTree} onOpenChange={setMobileTree}><SheetTrigger asChild><Button variant="outline" size="icon" className="shrink-0 lg:hidden" aria-label={text('Avaa kansiopuu','Open folder tree')}><Menu /></Button></SheetTrigger><SheetContent side="left" className="overflow-auto"><SheetHeader><SheetTitle>PD</SheetTitle></SheetHeader><div className="mt-6">{tree}</div></SheetContent></Sheet>
            <nav aria-label={text('Murupolku','Breadcrumb')} className="flex min-w-0 flex-wrap items-center gap-1 text-sm"><Button variant="link" className="h-auto px-1" onClick={() => go(null)}>{text('Osastot','Departments')}</Button>{path.map(f => <span key={f.id} className="flex min-w-0 items-center"><ChevronRight className="h-3 w-3 shrink-0" /><Button variant="link" className="h-auto max-w-60 truncate px-1" onClick={() => go(f.id)} title={f.name}>{f.name}</Button></span>)}{draft && <span className="flex min-w-0 items-center gap-2"><ChevronRight className="h-3 w-3 shrink-0" /><span className="max-w-64 truncate">{draft.name}</span></span>}</nav>
          </div>
          {processId && !process ? <p>{text('Prosessia ei löydy tai sen kansioon ei ole pääsyä.','Process not found or its folder is inaccessible.')}</p>
          : folderId && !folder ? <p>{text('Kansiota ei löydy tai siihen ei ole pääsyä.','Folder not found or inaccessible.')}</p>
          : draft ? <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3">{statusBadge(draft.status)}<span className="text-sm text-muted-foreground">{text('Versio','Version')} {draft.version}</span>{dirty && <span className="text-sm text-muted-foreground">{text('Tallentamatta','Unsaved')}</span>}{!editable && <Badge variant="outline">{text('Vain luku','Read only')}</Badge>}</div>{editable && <Button onClick={save} disabled={!dirty || saving}><Save />{saving ? text('Tallennetaan…','Saving…') : text('Tallenna','Save')}</Button>}</div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label htmlFor="pd-name">{text('Prosessin nimi','Process name')}</Label><Input id="pd-name" value={draft.name} disabled={!editable || saving} onChange={e => updateDraft({ name: e.target.value })} className="h-12 text-xl font-semibold" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="pd-description">{text('Kuvaus','Description')}</Label><Textarea id="pd-description" value={draft.description} disabled={!editable || saving} onChange={e => updateDraft({ description: e.target.value })} /></div>
              <div className="space-y-2"><Label>{text('Omistaja','Owner')}</Label><Select value={draft.owner_user_id || 'none'} disabled={!editable || saving} onValueChange={value => updateDraft({ owner_user_id: value === 'none' ? null : value })}><SelectTrigger aria-label={text('Omistaja','Owner')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{members.data?.filter(m => m.user_id && m.accepted_at).map(m => <SelectItem key={m.id} value={m.user_id || 'none'}>{m.email}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{text('Tila','Status')}</Label><Select value={draft.status} disabled={!editable || saving} onValueChange={status => updateDraft({ status })}><SelectTrigger aria-label={text('Tila','Status')}><SelectValue /></SelectTrigger><SelectContent>{PD_STATUSES.map(status => <SelectItem key={status} value={status}>{text(...statusLabels[status])}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="border-b pb-3"><h2 className="font-semibold">{text('Vaiheet','Steps')} <span className="ml-2 text-sm font-normal text-muted-foreground">{steps.length}</span></h2></div>
            {stepQuery.isLoading && !isNew ? <p>{text('Ladataan vaiheita…','Loading steps…')}</p> : stepQuery.error && !isNew ? <p role="alert">{text('Vaiheiden lataus epäonnistui','Failed to load steps')}</p> : <PdStepTable steps={steps} onChange={next => { setSteps(next); setDirty(true); }} roles={data?.roles || []} systems={data?.systems || []} readOnly={!editable || saving} onAddItem={(kind, stepId) => { setItemName(''); setListDialog({ kind, stepId }); }} text={text} />}
          </div> : <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="break-words text-2xl font-semibold">{folder?.name || text('Prosessikäsikirja','Process handbook')}</h2><p className="mt-1 text-sm text-muted-foreground">{folder ? text('Osaston prosessit','Department processes') : text('Osastot','Departments')}</p></div>{folder && editable && <Button onClick={() => setNewDialog(true)}><Plus />{text('Uusi prosessi','New process')}</Button>}</div>
            <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{folders.filter(f => folderId ? f.parent_id === folderId : !f.parent_id || !folders.some(p => p.id === f.parent_id)).map(f => {
              const ids = descendants(f.id); const entries = processes.filter(p => ids.has(p.folder_id)); const overdue = entries.filter(p => isOverdue(latestAck(p.id))).length;
              return <Button key={f.id} variant="outline" className="h-auto min-w-0 flex-col items-start gap-4 whitespace-normal p-5 text-left" onClick={() => go(f.id)}><div className="flex w-full items-center justify-between"><FolderOpen className="h-6 w-6 text-accent" /><ChevronRight className="text-muted-foreground" /></div><span className="w-full break-words text-base font-semibold">{f.name}</span><span className="flex w-full flex-wrap gap-x-4 gap-y-1 text-xs font-normal text-muted-foreground"><span>{entries.length} {text('prosessia','processes')}</span>{overdue > 0 && <span>{overdue} {text('kuittaamatta / vanhentunut','unacknowledged / overdue')}</span>}</span></Button>;
            })}</div>
            {folder && <div className="space-y-2"><h3 className="mb-3 font-semibold">{text('Prosessit','Processes')}</h3>{processes.filter(p => p.folder_id === folderId).map(p => <Button key={p.id} variant="outline" className="h-auto w-full justify-start gap-4 whitespace-normal p-4 text-left" onClick={() => go(p.folder_id, p.id)}><BookOpen className="text-accent" /><div className="min-w-0 flex-1"><div className="break-words font-semibold">{p.name}</div><p className="mt-1 line-clamp-2 text-sm font-normal text-muted-foreground">{p.description}</p><p className="mt-2 break-all text-xs font-normal text-muted-foreground">{memberName(p.owner_user_id)} · {text('Viimeksi kuitattu','Last acknowledged')}: {latestAck(p.id) ? new Date(latestAck(p.id) || '').toLocaleDateString(language === 'fi' ? 'fi-FI' : 'en-GB') : '—'}</p></div><div className="shrink-0">{statusBadge(p.status)}</div></Button>)}{!processes.some(p => p.folder_id === folderId) && <p className="py-8 text-sm text-muted-foreground">{text('Ei prosesseja vielä','No processes yet')}</p>}</div>}
            {!folders.length && <div className="border-t py-8"><p className="text-muted-foreground">{text('Organisaatiolla ei ole vielä kansioita.','This organization has no folders yet.')}</p><Button variant="outline" className="mt-4" onClick={() => navigate(`/dashboard?org=${orgId}`)}><FolderOpen />{text('Avaa työpöytä','Open dashboard')}</Button></div>}
          </>}
        </main>
      </div>}
    <Dialog open={newDialog} onOpenChange={setNewDialog}><DialogContent><DialogHeader><DialogTitle>{text('Uusi prosessi','New process')}</DialogTitle></DialogHeader><Label htmlFor="new-pd-name">{text('Nimi','Name')}</Label><Input id="new-pd-name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} /><DialogFooter><Button variant="outline" onClick={() => setNewDialog(false)}>{text('Peruuta','Cancel')}</Button><Button disabled={!newName.trim()} onClick={create}><Plus />{text('Luo prosessi','Create process')}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!listDialog} onOpenChange={open => { if (!open) setListDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{listDialog?.kind === 'roles' ? text('Lisää tekijärooli','Add performer role') : text('Lisää järjestelmä','Add system')}</DialogTitle></DialogHeader><Label htmlFor="pd-item-name">{text('Nimi','Name')}</Label><Input id="pd-item-name" value={itemName} disabled={addingItem} onChange={e => setItemName(e.target.value)} /><DialogFooter><Button variant="outline" disabled={addingItem} onClick={() => setListDialog(null)}>{text('Peruuta','Cancel')}</Button><Button disabled={!itemName.trim() || addingItem} onClick={addItem}><Plus />{text('Lisää','Add')}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}