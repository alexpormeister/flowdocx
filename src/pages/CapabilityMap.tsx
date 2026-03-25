import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, getFolders, type Project, type Folder } from "@/lib/api";
import { getOrganizations } from "@/lib/organizationApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, LayoutGrid, ZoomIn, ZoomOut } from "lucide-react";

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

function ProcessBox({ project, onClick }: { project: Project; onClick: () => void }) {
  const config = STATUS_CONFIG[project.status || "draft"] || STATUS_CONFIG.draft;

  return (
    <button
      onClick={onClick}
      title={project.name}
      className={`rounded-lg border-2 p-3 text-left transition-all duration-150 hover:shadow-lg hover:scale-[1.03] active:scale-[0.98] w-full ${config.bg} ${config.border}`}
      style={{ minHeight: 56, wordBreak: "break-word", overflowWrap: "anywhere" }}
    >
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${config.dot}`} />
        <span className={`text-[13px] font-medium leading-tight ${config.text}`}>
          {project.name}
        </span>
      </div>
    </button>
  );
}

function AreaCard({
  area,
  depth,
  onProjectClick,
}: {
  area: CapabilityArea;
  depth: number;
  onProjectClick: (id: string) => void;
}) {
  const isTop = depth === 0;

  return (
    <div
      className={`rounded-xl border-2 ${
        isTop ? "border-primary/30 bg-card shadow-sm" : "border-border bg-background"
      }`}
      style={{ padding: isTop ? 20 : 16 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1.5 rounded-full ${isTop ? "bg-primary h-7" : "bg-muted-foreground/30 h-5"}`} />
        <h3 className={`font-bold ${isTop ? "text-base text-primary" : "text-sm text-foreground"}`}>
          {area.folder.name}
        </h3>
        <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
          {area.projects.length + area.children.reduce((s, c) => s + c.projects.length, 0)}
        </Badge>
      </div>

      {/* Process boxes — use flex-wrap so each box sizes to its content */}
      {area.projects.length > 0 && (
        <div
          className="flex flex-wrap gap-3 mb-4"
          style={{ alignItems: "stretch" }}
        >
          {area.projects.map((p) => (
            <div key={p.id} style={{ flex: "1 1 200px", maxWidth: 280 }}>
              <ProcessBox project={p} onClick={() => onProjectClick(p.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Sub-areas */}
      {area.children.length > 0 && (
        <div className="space-y-3">
          {area.children.map((child) => (
            <AreaCard
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
  const [zoom, setZoom] = useState(100);

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

  const scale = zoom / 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b flex items-center gap-3 px-4 md:px-6 bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <LayoutGrid className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">{selectedOrg.name} — Capability Map</h1>

        {/* Zoom controls */}
        <div className="ml-auto flex items-center gap-2">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0])}
            min={40}
            max={150}
            step={10}
            className="w-28"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-10 text-right">{zoom}%</span>
        </div>
      </header>

      {/* Legend */}
      <div className="border-b bg-card/50 px-4 md:px-6 py-2 shrink-0">
        <div className="flex flex-wrap items-center gap-5 text-xs max-w-7xl mx-auto">
          <span className="font-medium text-muted-foreground">Status:</span>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
              {config.label}
            </span>
          ))}
        </div>
      </div>

      {/* Zoomable content */}
      <div className="flex-1 overflow-auto">
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: `${100 / scale}%`,
          }}
          className="p-4 md:p-8"
        >
          <div className="max-w-7xl mx-auto space-y-5">
            {capabilityTree.map((area) => (
              <AreaCard
                key={area.folder.id}
                area={area}
                depth={0}
                onProjectClick={handleProjectClick}
              />
            ))}

            {rootProjects.length > 0 && (
              <div className="rounded-xl border-2 border-primary/30 bg-card shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-7 rounded-full bg-primary" />
                  <h3 className="font-bold text-base text-primary">Uncategorized</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {rootProjects.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  {rootProjects.map((project) => (
                    <div key={project.id} style={{ flex: "1 1 200px", maxWidth: 280 }}>
                      <ProcessBox project={project} onClick={() => handleProjectClick(project.id)} />
                    </div>
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
      </div>
    </div>
  );
}
