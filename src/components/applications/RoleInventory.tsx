import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getOrganizationPositions, type OrganizationPosition } from "@/lib/organizationApi";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Users, ChevronDown, AlertTriangle, Workflow } from "lucide-react";

interface RoleDetail {
  project: Project;
  steps: { step: number; task: string }[];
}

export default function RoleInventory({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const { data: positions = [] } = useQuery({
    queryKey: ["org-positions", orgId],
    queryFn: () => getOrganizationPositions(orgId),
    enabled: !!user && !!orgId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const orgProjects = useMemo(
    () => projects.filter((p) => p.organization_id === orgId && !p.is_template),
    [projects, orgId]
  );

  // Build role → projects mapping based on performer field matching position names
  const roleMap = useMemo(() => {
    const map: Record<string, { position: OrganizationPosition; details: RoleDetail[] }> = {};
    
    for (const pos of positions) {
      map[pos.name.toLowerCase()] = { position: pos, details: [] };
    }

    // Also collect performers not in positions
    const unmappedPerformers: Record<string, RoleDetail[]> = {};

    for (const project of orgProjects) {
      const steps = (project.process_steps as any[]) || [];
      for (const step of steps) {
        const performer = (step.performer || "").trim().toLowerCase();
        if (!performer) continue;

        const entry = { step: step.step, task: step.task || "[Untitled]" };

        if (map[performer]) {
          const existing = map[performer].details.find((d) => d.project.id === project.id);
          if (existing) existing.steps.push(entry);
          else map[performer].details.push({ project, steps: [entry] });
        } else {
          if (!unmappedPerformers[performer]) unmappedPerformers[performer] = [];
          const existing = unmappedPerformers[performer].find((d) => d.project.id === project.id);
          if (existing) existing.steps.push(entry);
          else unmappedPerformers[performer].push({ project, steps: [entry] });
        }
      }
    }

    return { mapped: map, unmapped: unmappedPerformers };
  }, [positions, orgProjects]);

  const toggleExpand = (key: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sortedMapped = Object.entries(roleMap.mapped).sort(
    (a, b) => b[1].details.length - a[1].details.length
  );

  const sortedUnmapped = Object.entries(roleMap.unmapped).sort(
    (a, b) => b[1].length - a[1].length
  );

  // Positions with zero processes
  const emptyPositions = sortedMapped.filter(([, v]) => v.details.length === 0);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="secondary" className="text-sm">
          {positions.length} positions defined
        </Badge>
        <Badge variant="secondary" className="text-sm">
          {sortedMapped.filter(([, v]) => v.details.length > 0).length} active in processes
        </Badge>
        {emptyPositions.length > 0 && (
          <Badge variant="outline" className="text-sm text-destructive border-destructive/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {emptyPositions.length} unused positions
          </Badge>
        )}
      </div>

      {/* Unused positions warning */}
      {emptyPositions.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Unused positions — not linked to any process
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {emptyPositions.map(([, v]) => (
              <Badge key={v.position.id} variant="outline" className="text-xs">
                {v.position.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Role cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Organization Roles</h2>
        {sortedMapped
          .filter(([, v]) => v.details.length > 0)
          .map(([key, { position, details }]) => {
            const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
            return (
              <Collapsible
                key={position.id}
                open={expandedRoles.has(key)}
                onOpenChange={() => toggleExpand(key)}
              >
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-card border hover:border-primary/30 transition-colors">
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedRoles.has(key) ? "" : "-rotate-90"}`} />
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{position.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {details.length} process(es) · {totalSteps} step(s)
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{details.length}</Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-12 mt-1 space-y-1 pb-2">
                    {details.map((d) => (
                      <button
                        key={d.project.id}
                        onClick={() => navigate(`/presentation/${d.project.id}?org=${orgId}`)}
                        className="flex items-center gap-2 w-full text-left text-xs px-3 py-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <Workflow className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{d.project.name}</span>
                        <span className="text-[10px] text-muted-foreground">{d.steps.length} steps</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

        {/* Unmapped performers */}
        {sortedUnmapped.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-8">
              Other Performers (not in org chart)
            </h2>
            {sortedUnmapped.map(([performer, details]) => {
              const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
              return (
                <Collapsible
                  key={performer}
                  open={expandedRoles.has(performer)}
                  onOpenChange={() => toggleExpand(performer)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-card border border-dashed hover:border-primary/30 transition-colors">
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedRoles.has(performer) ? "" : "-rotate-90"}`} />
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm capitalize">{performer}</span>
                        <p className="text-xs text-muted-foreground">
                          {details.length} process(es) · {totalSteps} step(s)
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{details.length}</Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-12 mt-1 space-y-1 pb-2">
                      {details.map((d) => (
                        <button
                          key={d.project.id}
                          onClick={() => navigate(`/presentation/${d.project.id}?org=${orgId}`)}
                          className="flex items-center gap-2 w-full text-left text-xs px-3 py-2 rounded-md hover:bg-muted transition-colors"
                        >
                          <Workflow className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{d.project.name}</span>
                          <span className="text-[10px] text-muted-foreground">{d.steps.length} steps</span>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </>
        )}
      </div>

      {positions.length === 0 && sortedUnmapped.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No roles found</p>
          <p className="text-xs mt-1">Define positions in organization settings and assign performers to process steps.</p>
        </div>
      )}
    </div>
  );
}
