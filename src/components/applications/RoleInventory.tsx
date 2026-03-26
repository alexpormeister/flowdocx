import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getOrganizationPositions, getOrganizationGroupsWithPositions, type OrganizationPosition, type OrganizationGroup } from "@/lib/organizationApi";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Users, ChevronDown, AlertTriangle, Workflow, UsersRound } from "lucide-react";

interface RoleDetail {
  project: Project;
  steps: { step: number; task: string; viaGroup?: string }[];
}

type GroupWithPositions = OrganizationGroup & { position_ids: string[] };

export default function RoleInventory({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const { data: positions = [] } = useQuery({
    queryKey: ["org-positions", orgId],
    queryFn: () => getOrganizationPositions(orgId),
    enabled: !!user && !!orgId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["org-groups", orgId],
    queryFn: () => getOrganizationGroupsWithPositions(orgId),
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

  // Build group name → position ids lookup
  const groupLookup = useMemo(() => {
    const map: Record<string, { group: GroupWithPositions; positionNames: string[] }> = {};
    for (const g of groups) {
      const posNames = g.position_ids
        .map((pid) => positions.find((p) => p.id === pid)?.name)
        .filter(Boolean) as string[];
      map[`[${g.name.toLowerCase()}]`] = { group: g, positionNames: posNames };
    }
    return map;
  }, [groups, positions]);

  // Build role → projects mapping, expanding groups to individual positions
  const { roleMap, groupMap, unmapped } = useMemo(() => {
    const roleMap: Record<string, { position: OrganizationPosition; details: RoleDetail[] }> = {};
    const groupMap: Record<string, { group: GroupWithPositions; details: RoleDetail[] }> = {};
    const unmapped: Record<string, RoleDetail[]> = {};

    for (const pos of positions) {
      roleMap[pos.name.toLowerCase()] = { position: pos, details: [] };
    }
    for (const g of groups) {
      groupMap[g.id] = { group: g, details: [] };
    }

    const addToRole = (key: string, project: Project, step: number, task: string, viaGroup?: string) => {
      if (!roleMap[key]) return;
      const existing = roleMap[key].details.find((d) => d.project.id === project.id);
      const entry = { step, task, viaGroup };
      if (existing) existing.steps.push(entry);
      else roleMap[key].details.push({ project, steps: [entry] });
    };

    for (const project of orgProjects) {
      const steps = (project.process_steps as any[]) || [];
      for (const step of steps) {
        const performer = (step.performer || "").trim();
        const performerLower = performer.toLowerCase();
        if (!performer) continue;

        // Check if performer is a group reference like [GroupName]
        const groupEntry = groupLookup[performerLower];
        if (groupEntry) {
          // Add to group map
          const gDetail = groupMap[groupEntry.group.id];
          if (gDetail) {
            const existing = gDetail.details.find((d) => d.project.id === project.id);
            const entry = { step: step.step, task: step.task || "[Untitled]" };
            if (existing) existing.steps.push(entry);
            else gDetail.details.push({ project, steps: [entry] });
          }
          // Expand to each position in the group
          for (const posName of groupEntry.positionNames) {
            addToRole(posName.toLowerCase(), project, step.step, step.task || "[Untitled]", groupEntry.group.name);
          }
        } else if (roleMap[performerLower]) {
          addToRole(performerLower, project, step.step, step.task || "[Untitled]");
        } else {
          if (!unmapped[performerLower]) unmapped[performerLower] = [];
          const existing = unmapped[performerLower].find((d) => d.project.id === project.id);
          const entry = { step: step.step, task: step.task || "[Untitled]" };
          if (existing) existing.steps.push(entry);
          else unmapped[performerLower].push({ project, steps: [entry] });
        }
      }
    }

    return { roleMap, groupMap, unmapped };
  }, [positions, groups, orgProjects, groupLookup]);

  const toggleExpand = (key: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sortedMapped = Object.entries(roleMap).sort(
    (a, b) => b[1].details.length - a[1].details.length
  );

  const sortedUnmapped = Object.entries(unmapped).sort(
    (a, b) => b[1].length - a[1].length
  );

  const sortedGroups = Object.entries(groupMap)
    .filter(([, v]) => v.details.length > 0)
    .sort((a, b) => b[1].details.length - a[1].details.length);

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
        {groups.length > 0 && (
          <Badge variant="secondary" className="text-sm">
            {groups.length} groups · {sortedGroups.length} active
          </Badge>
        )}
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

      {/* Groups section */}
      {sortedGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Groups</h2>
          {sortedGroups.map(([, { group, details }]) => {
            const key = `group-${group.id}`;
            const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
            const groupPositionNames = groupLookup[`[${group.name.toLowerCase()}]`]?.positionNames || [];
            return (
              <Collapsible key={key} open={expandedRoles.has(key)} onOpenChange={() => toggleExpand(key)}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-card border border-primary/20 hover:border-primary/40 transition-colors">
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedRoles.has(key) ? "" : "-rotate-90"}`} />
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <UsersRound className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{group.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {groupPositionNames.length} positions · {details.length} process(es) · {totalSteps} step(s)
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{details.length}</Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-12 mt-1 space-y-2 pb-2">
                    {groupPositionNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-3 py-1">
                        {groupPositionNames.map((name) => (
                          <Badge key={name} variant="outline" className="text-[10px]">{name}</Badge>
                        ))}
                      </div>
                    )}
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
        </div>
      )}

      {/* Role cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Organization Roles</h2>
        {sortedMapped
          .filter(([, v]) => v.details.length > 0)
          .map(([key, { position, details }]) => {
            const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
            const hasGroupSteps = details.some((d) => d.steps.some((s) => s.viaGroup));
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
                        {hasGroupSteps && " · includes group assignments"}
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
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {d.steps.some((s) => s.viaGroup) && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              via {d.steps.find((s) => s.viaGroup)?.viaGroup}
                            </Badge>
                          )}
                          {d.steps.length} steps
                        </span>
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

      {positions.length === 0 && sortedUnmapped.length === 0 && groups.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No roles found</p>
          <p className="text-xs mt-1">Define positions in organization settings and assign performers to process steps.</p>
        </div>
      )}
    </div>
  );
}
