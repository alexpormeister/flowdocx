import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, getFolders, type Project, type Folder } from "@/lib/api";
import { getOrganizations } from "@/lib/organizationApi";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid } from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  published: {
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-400 dark:border-green-600",
    text: "text-green-800 dark:text-green-300",
  },
  review: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    border: "border-yellow-400 dark:border-yellow-600",
    text: "text-yellow-800 dark:text-yellow-300",
  },
  draft: {
    bg: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
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

function CapabilityAreaCard({
  area,
  depth,
  onProjectClick,
  orgId,
}: {
  area: CapabilityArea;
  depth: number;
  onProjectClick: (projectId: string) => void;
  orgId: string;
}) {
  const isTop = depth === 0;
  return (
    <div
      className={`rounded-xl border-2 ${
        isTop ? "border-primary/30 bg-card" : "border-border bg-muted/30"
      } p-3 sm:p-4`}
    >
      <h3
        className={`font-bold mb-3 ${
          isTop ? "text-base text-primary" : "text-sm text-foreground"
        }`}
      >
        {area.folder.name}
      </h3>

      {/* Process capability boxes */}
      {area.projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
          {area.projects.map((project) => {
            const statusKey = project.status || "draft";
            const colors = STATUS_COLORS[statusKey] || STATUS_COLORS.draft;
            return (
              <button
                key={project.id}
                onClick={() => onProjectClick(project.id)}
                className={`rounded-lg border-2 px-3 py-2 text-left transition-all hover:shadow-md hover:scale-[1.02] ${colors.bg} ${colors.border}`}
              >
                <p className={`text-xs font-medium leading-tight line-clamp-2 ${colors.text}`}>
                  {project.name}
                </p>
              </button>
            );
          })}
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
              orgId={orgId}
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

  // Projects without folder
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
        <Button variant="ghost" size="icon" onClick={() => navigate(`/?org=${orgId}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <LayoutGrid className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-semibold">{selectedOrg.name} — Business Capability Map</h1>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-medium text-muted-foreground">Status:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-400 dark:bg-green-600" />
            Published
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-400 dark:bg-yellow-600" />
            Under Review
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-muted border border-border" />
            Draft
          </span>
        </div>

        {/* Capability areas */}
        <div className="space-y-4">
          {capabilityTree.map((area) => (
            <CapabilityAreaCard
              key={area.folder.id}
              area={area}
              depth={0}
              onProjectClick={handleProjectClick}
              orgId={orgId!}
            />
          ))}
        </div>

        {/* Root projects (no folder) */}
        {rootProjects.length > 0 && (
          <div className="rounded-xl border-2 border-primary/30 bg-card p-4">
            <h3 className="font-bold text-base text-primary mb-3">Uncategorized</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {rootProjects.map((project) => {
                const colors = STATUS_COLORS[project.status] || STATUS_COLORS.draft;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                    className={`rounded-lg border-2 px-3 py-2 text-left transition-all hover:shadow-md hover:scale-[1.02] ${colors.bg} ${colors.border}`}
                  >
                    <p className={`text-xs font-medium leading-tight line-clamp-2 ${colors.text}`}>
                      {project.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {capabilityTree.length === 0 && rootProjects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No processes found for this organization.</p>
          </div>
        )}
      </div>
    </div>
  );
}
