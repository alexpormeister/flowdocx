import { BookOpen, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Folder as NexusFolder } from '@/lib/api';
import type { PdProcess } from '@/lib/pdApi';
interface Props { folders: NexusFolder[]; processes: PdProcess[]; folderId: string | null; processId: string | null; expanded: Set<string>; onToggle: (id: string) => void; onNavigate: (folderId: string | null, processId?: string) => void; rootLabel: string; }
export default function PdFolderTree({ folders, processes, folderId, processId, expanded, onToggle, onNavigate, rootLabel }: Props) {
  const renderFolder = (folder: NexusFolder, ancestors: Set<string>) => {
    if (ancestors.has(folder.id)) return null;
    const visited = new Set([...ancestors, folder.id]);
    const children = folders.filter(f => f.parent_id === folder.id);
    const entries = processes.filter(p => p.folder_id === folder.id);
    const open = expanded.has(folder.id);
    return <div key={folder.id}>
      <div className="flex min-w-0 items-center">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onToggle(folder.id)} aria-label={`${open ? '−' : '+'} ${folder.name}`} aria-expanded={open}>{open ? <ChevronDown /> : <ChevronRight />}</Button>
        <Button variant="ghost" className={`h-auto min-h-9 min-w-0 flex-1 justify-start px-2 ${folderId === folder.id && !processId ? 'bg-accent/10 text-primary' : ''}`} onClick={() => onNavigate(folder.id)} title={folder.name}><Folder className="text-accent" /><span className="truncate">{folder.name}</span><span className="ml-auto text-xs text-muted-foreground">{entries.length}</span></Button>
      </div>
      {open && <div className="ml-3 border-l pl-2">{children.map(f => renderFolder(f, visited))}{entries.map(p => <Button key={p.id} variant="ghost" className={`h-auto min-h-9 w-full justify-start px-2 ${processId === p.id ? 'bg-primary/10 text-primary' : ''}`} title={p.name} onClick={() => onNavigate(p.folder_id, p.id)}><BookOpen className="text-muted-foreground" /><span className="truncate">{p.name}</span></Button>)}</div>}
    </div>;
  };
  return <nav className="space-y-1" aria-label={rootLabel}><Button variant="ghost" className={`w-full justify-start ${!folderId ? 'bg-primary/10 text-primary' : ''}`} onClick={() => onNavigate(null)}><BookOpen />{rootLabel}</Button>{folders.filter(f => !f.parent_id || !folders.some(p => p.id === f.parent_id)).map(f => renderFolder(f, new Set()))}</nav>;
}