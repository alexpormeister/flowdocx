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
              className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 ${
                isInherited ? "opacity-50" : ""
              }`}
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
              {children.length > 0 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: folder.color || "#0891b2" }}
              />
              <span className="text-sm flex-1 truncate">{folder.name}</span>
              <Checkbox
                checked={isVisible}
                disabled={isInherited || loading === folder.id || disabled}
                onCheckedChange={() => handleToggle(folder.id, isDirectlyRestricted)}
                className="flex-shrink-0"
              />
              {isVisible ? (
                <Eye className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )}
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
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="w-4 h-4" />
            Folder Access — {member.email}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Uncheck folders to hide them from this member. Hiding a parent folder also hides all subfolders.
        </p>
        <ScrollArea className="h-[400px] border rounded-md p-2">
          {buildTree(null, 0)}
          {folders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No folders in this organization
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
