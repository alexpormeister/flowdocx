import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, FolderInput, Clock, Copy } from "lucide-react";
import { format } from "date-fns";
import { type Project, type Folder } from "@/lib/api";

interface ProjectCardProps {
  project: Project;
  folders: Folder[];
  onOpen: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onMoveToFolder: (projectId: string, folderId: string | null) => void;
}

export function ProjectCard({
  project,
  folders,
  onOpen,
  onDelete,
  onDuplicate,
  onMoveToFolder,
}: ProjectCardProps) {
  const { t } = useLanguage();

  return (
    <Card
      className="group cursor-pointer hover:border-accent transition-colors"
      onClick={() => onOpen(project.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("projectId", project.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium truncate pr-2">
            {project.name}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-50">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                  <FolderInput className="w-4 h-4 mr-2" />
                  {t("dashboard.moveToFolder")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToFolder(project.id, null);
                    }}
                    className="cursor-pointer"
                  >
                    {t("dashboard.noFolder")}
                  </DropdownMenuItem>
                  {folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToFolder(project.id, folder.id);
                      }}
                      className="cursor-pointer"
                    >
                      <div
                        className="w-2 h-2 rounded-sm mr-2"
                        style={{ backgroundColor: folder.color || "#0891b2" }}
                      />
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(project.id);
                }}
                className="cursor-pointer"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                }}
                className="text-destructive cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {project.description && (
          <CardDescription className="text-xs line-clamp-1">
            {project.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {format(new Date(project.updated_at), "MMM d, yyyy")}
        </div>
        {project.system_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.system_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[10px] bg-tag text-tag-foreground"
              >
                {tag}
              </span>
            ))}
            {project.system_tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{project.system_tags.length - 3}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
