import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Plus,
  FolderPlus,
  FolderOpen,
  Trash2,
  ChevronRight,
  ChevronDown,
  LayoutTemplate,
} from "lucide-react";
import { type Folder } from "@/lib/api";
import { FolderTagsManager } from "./FolderTagsManager";
import { ShareDialog, type ShareEntry } from "./ShareDialog";

interface FolderSidebarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  currentPath: Folder[];
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onUpdateFolderTags: (folderId: string, tags: string[]) => void;
  onNewProject: () => void;
  onOpenTemplateGallery: () => void;
  isCreatingFolder: boolean;
  folderShares: ShareEntry[];
  onShareFolder: (folderId: string, email: string, permission: "view" | "edit") => Promise<void>;
  onRemoveFolderShare: (shareId: string) => Promise<void>;
}

export function FolderSidebar({
  folders,
  selectedFolderId,
  currentPath,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onUpdateFolderTags,
  onNewProject,
  onOpenTemplateGallery,
  isCreatingFolder,
  folderShares,
  onShareFolder,
  onRemoveFolderShare,
}: FolderSidebarProps) {
  const { t } = useLanguage();
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const rootFolders = folders.filter((f) => !f.parent_id);

  const getChildFolders = (parentId: string) =>
    folders.filter((f) => f.parent_id === parentId);

  const getInheritedTags = (folderId: string): string[] => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder || !folder.parent_id) return [];
    
    const parentTags: string[] = [];
    let current = folders.find(f => f.id === folder.parent_id);
    while (current) {
      parentTags.push(...(current.system_tags || []));
      current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
    }
    return [...new Set(parentTags)];
  };

  const selectedFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  const toggleExpanded = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), selectedFolderId);
      setNewFolderDialogOpen(false);
      setNewFolderName("");
    }
  };

  const renderFolder = (folder: Folder, depth = 0) => {
    const children = getChildFolders(folder.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className="flex items-center group"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpanded(folder.id, e)}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <button
            onClick={() => onSelectFolder(folder.id)}
            className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              selectedFolderId === folder.id
                ? "bg-accent/10 text-accent"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: folder.color || "#0891b2" }}
            />
            <span className="truncate">{folder.name}</span>
            {(folder.system_tags?.length || 0) > 0 && (
              <span className="text-[10px] bg-muted px-1 rounded">
                {folder.system_tags?.length}
              </span>
            )}
          </button>
          <button
            onClick={() => onDeleteFolder(folder.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 border-r bg-card p-4 flex flex-col">
      <div className="space-y-2 mb-6">
        <Button onClick={onNewProject} className="w-full justify-start gap-2">
          <Plus className="w-4 h-4" />
          {t("dashboard.newProject")}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onOpenTemplateGallery}
        >
          <LayoutTemplate className="w-4 h-4" />
          {t("dashboard.newFromTemplate")}
        </Button>
      </div>

      {/* Folder actions when a folder is selected */}
      {selectedFolder && (
        <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
          <p className="text-xs font-medium text-muted-foreground truncate">
            {selectedFolder.name}
          </p>
          <div className="flex gap-2 flex-wrap">
            <FolderTagsManager
              tags={selectedFolder.system_tags || []}
              onTagsChange={(tags) => onUpdateFolderTags(selectedFolder.id, tags)}
              inheritedTags={getInheritedTags(selectedFolder.id)}
            />
            <ShareDialog
              type="folder"
              name={selectedFolder.name}
              shares={folderShares}
              onShare={(email, permission) => onShareFolder(selectedFolder.id, email, permission)}
              onRemoveShare={onRemoveFolderShare}
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("dashboard.folders")}
          </span>
          <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
            <DialogTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <FolderPlus className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dashboard.createFolder")}</DialogTitle>
              </DialogHeader>
              <Input
                placeholder={t("dashboard.folderName")}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                }}
              />
              {selectedFolderId && currentPath.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.creatingIn")}: {currentPath[currentPath.length - 1]?.name}
                </p>
              )}
              <DialogFooter>
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || isCreatingFolder}
                >
                  {t("common.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              selectedFolderId === null
                ? "bg-accent/10 text-accent"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            {t("dashboard.allProjects")}
          </button>
          {rootFolders.map((folder) => renderFolder(folder))}
        </div>
      </div>
    </aside>
  );
}
