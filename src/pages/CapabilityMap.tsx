import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, getFolders, type Project, type Folder } from "@/lib/api";
import { getOrganizations } from "@/lib/organizationApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LayoutGrid } from "lucide-react";

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string; dot: string }> = {
  published: {
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-300 dark:border-green-700",
    text: "text-green-800 dark:text-green-300",
    label: "Published",
    dot: "bg-green-500",
  },
  review: {
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    border: "border-yellow-300 dark:border-yellow-700",
    text: "text-yellow-800 dark:text-yellow-300",
    label: "Under Review",
    dot: "bg-yellow-500",
  },
  draft: {
    bg: "bg-muted/50",
    border: "border-border",
    text: "text-muted-foreground",
    label: "Draft",
    dot: "bg-muted-foreground/40",
  },
};

interface CapabilityArea {
  folder: Folder;
  projects: Project[];
  children: CapabilityArea[];
}

function buildCapabilityTree(
  folders: Folder[],
  projects: Project[],
  parentId: string | null
): CapabilityArea[] {
  return folders
    .filter((f) => f.parent_id === parentId)
    .map((folder) => ({
      folder,
      projects: projects.filter((p) => p.folder_id === folder.id),
      children: buildCapabilityTree(folders, projects, folder.id),
    }))
    .filter((area) => area.projects.length > 0 || area.children.length > 0);
}

function ProcessBox({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const statusKey = project.status || "draft";
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-left transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] w-full min-h-[44px] ${config.bg} ${config.border}`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dot}`} />
        <p className={`text-xs font-medium leading-snug break-words hyphens-auto ${config.text}`}>
          {project.name}
        </p>
      </div>
    </button>
  );
}

function CapabilityAreaCard({
  area,
  depth,
  onProjectClick,
}: {
  area: CapabilityArea;
  depth: number;
  onProjectClick: (projectId: string) => void;
}) {
  const isTop = depth === 0;
  const totalProcesses = area.projects.length + area.children.reduce((sum, c) => sum + c.projects.length, 0);

  return (
    <div
      className={`rounded-xl border transition-all ${
        isTop
          ? "border-primary/20 bg-card shadow-sm"
          : "border-border bg-muted/20"
      } p-4 sm:p-5`}
    >
      {/* Area header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-1 h-6 rounded-full ${
              isTop ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
          <h3
            className={`font-bold ${
              isTop ? "text-base text-primary" : "text-sm text-foreground"
            }`}
          >
            {area.folder.name}
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {totalProcesses}
        </Badge>
      </div>

      {/* Process boxes */}
      {area.projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
          {area.projects.map((project) => (
            <ProcessBox
              key={project.id}
              project={project}
              onClick={() => onProjectClick(project.id)}
            />
          ))}
        </div>
      )}

      {/* Sub-areas */}
      {area.children.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {area.children.map((child) => (
            <CapabilityAreaCard
              key={child.folder.id}
              area={child}
              depth={depth + 1}
              onProjectClick={onProjectClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CapabilityMap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    enabled: !!user,
  });

  const selectedOrg = organizations.find((o) => o.id === orgId);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: getFolders,
    enabled: !!user,
  });

  const orgProjects = useMemo(
    () => projects.filter((p) => p.organization_id === orgId && !p.is_template),
    [projects, orgId]
  );

  const orgFolders = useMemo(
    () => folders.filter((f) => f.organization_id === orgId),
    [folders, orgId]
  );

  const capabilityTree = useMemo(
    () => buildCapabilityTree(orgFolders, orgProjects, null),
    [orgFolders, orgProjects]
  );

  const rootProjects = useMemo(
    () => orgProjects.filter((p) => !p.folder_id),
    [orgProjects]
  );

  const handleProjectClick = (projectId: string) => {
    navigate(`/presentation/${projectId}?org=${orgId}`);
  };

  if (!orgId || !selectedOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center gap-3 px-4 md:px-6 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <LayoutGrid className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">{selectedOrg.name} — Capability Map</h1>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs bg-card border rounded-lg px-4 py-3">
          <span className="font-medium text-muted-foreground">Status:</span>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
              {config.label}
            </span>
          ))}
        </div>

        {/* Capability areas */}
        <div className="space-y-5">
          {capabilityTree.map((area) => (
            <CapabilityAreaCard
              key={area.folder.id}
              area={area}
              depth={0}
              onProjectClick={handleProjectClick}
            />
          ))}
        </div>

        {/* Root projects */}
        {rootProjects.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-card shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-primary" />
              <h3 className="font-bold text-base text-primary">Uncategorized</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {rootProjects.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {rootProjects.map((project) => (
                <ProcessBox
                  key={project.id}
                  project={project}
                  onClick={() => handleProjectClick(project.id)}
                />
              ))}
            </div>
          </div>
        )}

        {capabilityTree.length === 0 && rootProjects.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <LayoutGrid className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No processes found</p>
            <p className="text-xs mt-1">Create processes and organize them into folders.</p>
          </div>
        )}
      </div>
    </div>
  );
}
