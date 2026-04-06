import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Tag, FolderOpen } from "lucide-react";
import { type Project } from "@/lib/api";

interface ProjectStatsProps {
  projects: Project[];
  currentFolderName: string | null;
}

export function ProjectStats({ projects, currentFolderName }: ProjectStatsProps) {
  const { t } = useLanguage();

  // Count unique system tags across all filtered projects
  const allTags = projects.flatMap((p) => p.system_tags);
  const uniqueTags = new Set(allTags);

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card className="bg-card">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold">{projects.length}</p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.totalProjects")}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold">{uniqueTags.size}</p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.systemsMapped")}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium truncate max-w-[120px]">
              {currentFolderName || t("dashboard.allProjects")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.currentFolder")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
