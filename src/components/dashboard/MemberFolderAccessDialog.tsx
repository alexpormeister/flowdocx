import { useState, useMemo } from "react";
import { FolderOpen, Eye, EyeOff, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Folder } from "@/lib/api";
import type { OrganizationMember, MemberFolderRestriction } from "@/lib/organizationApi";

interface MemberFolderAccessDialogProps {
  member: OrganizationMember;
  folders: Folder[];
  restrictions: MemberFolderRestriction[];
  onAddRestriction: (memberId: string, folderId: string) => Promise<void>;
  onRemoveRestriction: (memberId: string, folderId: string) => Promise<void>;
  disabled?: boolean;
}

export function MemberFolderAccessDialog({
  member,
  folders,
  restrictions,
  onAddRestriction,
  onRemoveRestriction,
  disabled,
}: MemberFolderAccessDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const memberRestrictions = useMemo(
    () => restrictions.filter((r) => r.member_id === member.id),
    [restrictions, member.id]
  );

  const restrictedFolderIds = useMemo(
    () => new Set(memberRestrictions.map((r) => r.folder_id)),
    [memberRestrictions]
  );

  // Check if a folder is restricted due to parent being restricted
  const isInheritedRestriction = (folderId: string): boolean => {
    let current = folders.find((f) => f.id === folderId);
    while (current?.parent_id) {
      if (restrictedFolderIds.has(current.parent_id)) return true;
      current = folders.find((f) => f.id === current!.parent_id);
    }
    return false;
  };

  const handleToggle = async (folderId: string, currentlyRestricted: boolean) => {
    setLoading(folderId);
    try {
      if (currentlyRestricted) {
        await onRemoveRestriction(member.id, folderId);
      } else {
        await onAddRestriction(member.id, folderId);
      }
    } finally {
      setLoading(null);
    }
  };

  const buildTree = (parentId: string | null, depth: number): React.ReactNode[] => {
    return folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => {
        const isDirectlyRestricted = restrictedFolderIds.has(folder.id);
        const isInherited = isInheritedRestriction(folder.id);
        const isVisible = !isDirectlyRestricted && !isInherited;
        const children = buildTree(folder.id, depth + 1);

        return (
          <div key={folder.id}>
            <div
              className={`flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 ${
                isInherited ? "opacity-50" : ""
              }`}
            >
              <div
                className="flex min-w-0 flex-1 items-center gap-2"
                style={{ paddingLeft: `${depth * 16 + 4}px` }}
              >
                {children.length > 0 ? (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <span className="h-3 w-3 flex-shrink-0" />
                )}
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: folder.color || "#0891b2" }}
                />
                <span className="truncate text-sm">{folder.name}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 pl-2">
                <Checkbox
                  checked={isVisible}
                  disabled={isInherited || loading === folder.id || disabled}
                  onCheckedChange={() => handleToggle(folder.id, isDirectlyRestricted)}
                  className="flex-shrink-0"
                />
                {isVisible ? (
                  <Eye className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                )}
              </div>
            </div>
            {children}
          </div>
        );
      });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled} title="Manage folder access">
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Folders</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] w-[min(92vw,42rem)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="w-4 h-4" />
            Folder Access — {member.email}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Uncheck folders to hide them from this member. Hiding a parent folder also hides all subfolders.
        </p>
        <ScrollArea className="h-[400px] w-full rounded-md border p-2">
          <div className="min-w-0">
            {buildTree(null, 0)}
            {folders.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No folders in this organization
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
