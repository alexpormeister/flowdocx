import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Plus,
  FolderOpen,
  Trash2,
  ChevronRight,
  ChevronDown,
  LayoutTemplate,
  Folder as FolderIcon,
  Share2,
  Menu,
} from "lucide-react";
import { type Folder } from "@/lib/api";
import { FolderTagsManager } from "./FolderTagsManager";
import { ShareDialog, type ShareEntry } from "./ShareDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";

interface MobileFolderSheetProps {
  folders: Folder[];
  selectedFolderId: string | null;
  currentPath: Folder[];
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onUpdateFolderTags: (folderId: string, tags: string[]) => void;
  onNewProject: () => void;
  onOpenTemplateGallery: () => void;
  isCreatingFolder: boolean;
  folderShares: ShareEntry[];
  onShareFolder: (folderId: string, email: string, permission: "view" | "edit") => Promise<void>;
  onRemoveFolderShare: (shareId: string) => Promise<void>;
}

export function MobileFolderSheet({
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
}: MobileFolderSheetProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const { ownedRootFolders, sharedRootFolders } = useMemo(() => {
    const owned: Folder[] = [];
    const shared: Folder[] = [];
    
    const folderIds = new Set(folders.map(f => f.id));
    
    folders.forEach(folder => {
      const isOwned = folder.user_id === user?.id;
      
      if (isOwned) {
        if (!folder.parent_id) {
          owned.push(folder);
        }
      } else {
        if (!folder.parent_id || !folderIds.has(folder.parent_id)) {
          shared.push(folder);
        }
      }
    });
    
    return { ownedRootFolders: owned, sharedRootFolders: shared };
  }, [folders, user?.id]);

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
  const isOwnFolder = selectedFolder?.user_id === user?.id;

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

  const handleCreateFolder = (name: string, color: string) => {
    onCreateFolder(name, selectedFolderId, color);
    setNewFolderDialogOpen(false);
  };

  const handleSelectFolder = (folderId: string | null) => {
    onSelectFolder(folderId);
    setIsOpen(false);
  };

  const renderFolder = (folder: Folder, depth = 0) => {
    const canDelete = folder.user_id === user?.id;
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
            onClick={() => handleSelectFolder(folder.id)}
            className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              selectedFolderId === folder.id
                ? "bg-accent/10 text-accent"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <FolderIcon
              className="w-4 h-4 flex-shrink-0"
              style={{ color: folder.color || "#0891b2" }}
              fill={folder.color || "#0891b2"}
            />
            <span className="truncate">{folder.name}</span>
            {(folder.system_tags?.length || 0) > 0 && (
              <span className="text-[10px] bg-muted px-1 rounded">
                {folder.system_tags?.length}
              </span>
            )}
          </button>
          {canDelete && (
            <button
              onClick={() => onDeleteFolder(folder.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{t("dashboard.folders")}</SheetTitle>
        </SheetHeader>
        <div className="p-4 flex flex-col h-[calc(100%-60px)] overflow-auto">
          <div className="space-y-2 mb-6">
            <Button onClick={() => { onNewProject(); setIsOpen(false); }} className="w-full justify-start gap-2">
              <Plus className="w-4 h-4" />
              {t("dashboard.newProject")}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => { onOpenTemplateGallery(); setIsOpen(false); }}
            >
              <LayoutTemplate className="w-4 h-4" />
              {t("dashboard.newFromTemplate")}
            </Button>
          </div>

          {selectedFolder && (
            <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {selectedFolder.name}
              </p>
              <div className="flex gap-2 flex-wrap">
                {isOwnFolder && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("dashboard.folders")}
              </span>
              <CreateFolderDialog
                open={newFolderDialogOpen}
                onOpenChange={setNewFolderDialogOpen}
                onCreateFolder={handleCreateFolder}
                isCreating={isCreatingFolder}
                parentFolderName={selectedFolderId && currentPath.length > 0 ? currentPath[currentPath.length - 1]?.name : null}
              />
            </div>

            <div className="space-y-1">
              <button
                onClick={() => handleSelectFolder(null)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedFolderId === null
                    ? "bg-accent/10 text-accent"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                {t("dashboard.allProjects")}
              </button>
              {ownedRootFolders.map((folder) => renderFolder(folder))}
            </div>

            {sharedRootFolders.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("dashboard.sharedWithMe")}
                  </span>
                </div>
                <div className="space-y-1">
                  {sharedRootFolders.map((folder) => renderFolder(folder))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
