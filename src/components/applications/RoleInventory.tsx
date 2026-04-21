import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getOrganizationPositions, getOrganizationGroupsWithPositions, type OrganizationPosition, type OrganizationGroup } from "@/lib/organizationApi";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Users, ChevronDown, AlertTriangle, Workflow, UsersRound, Search, UserCircle2, HelpCircle, Network } from "lucide-react";

interface RoleDetail {
  project: Project;
  steps: { step: number; task: string; viaGroup?: string }[];
}

type GroupWithPositions = OrganizationGroup & { position_ids: string[] };

export default function RoleInventory({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("roles");

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

        const groupEntry = groupLookup[performerLower];
        if (groupEntry) {
          const gDetail = groupMap[groupEntry.group.id];
          if (gDetail) {
            const existing = gDetail.details.find((d) => d.project.id === project.id);
            const entry = { step: step.step, task: step.task || "[Untitled]" };
            if (existing) existing.steps.push(entry);
            else gDetail.details.push({ project, steps: [entry] });
          }
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

  const q = search.trim().toLowerCase();

  const sortedMapped = useMemo(() => {
    return Object.entries(roleMap)
      .filter(([, v]) => v.details.length > 0)
      .filter(([, v]) => !q || v.position.name.toLowerCase().includes(q))
      .sort((a, b) => b[1].details.length - a[1].details.length);
  }, [roleMap, q]);

  const sortedUnmapped = useMemo(() => {
    return Object.entries(unmapped)
      .filter(([k]) => !q || k.includes(q))
      .sort((a, b) => b[1].length - a[1].length);
  }, [unmapped, q]);

  const sortedGroups = useMemo(() => {
    return Object.entries(groupMap)
      .filter(([, v]) => v.details.length > 0)
      .filter(([, v]) => !q || v.group.name.toLowerCase().includes(q))
      .sort((a, b) => b[1].details.length - a[1].details.length);
  }, [groupMap, q]);

  const emptyPositions = useMemo(
    () => Object.values(roleMap).filter((v) => v.details.length === 0),
    [roleMap]
  );

  const totalSteps = useMemo(() => {
    return Object.values(roleMap).reduce(
      (acc, v) => acc + v.details.reduce((s, d) => s + d.steps.length, 0),
      0
    );
  }, [roleMap]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Role Inventory
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Who does what — across all processes in this organization.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Positions" value={positions.length} icon={UserCircle2} />
        <StatCard label="Active Roles" value={sortedMapped.length} icon={Users} accent />
        <StatCard label="Groups" value={sortedGroups.length} icon={UsersRound} />
        <StatCard label="Process Steps" value={totalSteps} icon={Workflow} />
      </div>

      {/* Unused positions warning */}
      {emptyPositions.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {emptyPositions.length} unused position{emptyPositions.length !== 1 ? "s" : ""} — not linked to any process
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emptyPositions.map((v) => (
              <Badge key={v.position.id} variant="outline" className="text-xs bg-card">
                {v.position.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search roles, groups or performers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="roles" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Roles
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{sortedMapped.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <UsersRound className="w-3.5 h-3.5" />
            Groups
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{sortedGroups.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-1.5">
            <Network className="w-3.5 h-3.5" />
            Hierarchy
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Other
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{sortedUnmapped.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Roles */}
        <TabsContent value="roles" className="space-y-2 m-0">
          {sortedMapped.length === 0 ? (
            <EmptyState icon={Users} text={q ? "No roles match your search" : "No active roles yet"} />
          ) : (
            sortedMapped.map(([key, { position, details }]) => {
              const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
              const hasGroupSteps = details.some((d) => d.steps.some((s) => s.viaGroup));
              return (
                <RoleCard
                  key={position.id}
                  expanded={expandedRoles.has(key)}
                  onToggle={() => toggleExpand(key)}
                  icon={Users}
                  title={position.name}
                  subtitle={`${details.length} process${details.length !== 1 ? "es" : ""} · ${totalSteps} step${totalSteps !== 1 ? "s" : ""}${hasGroupSteps ? " · via groups" : ""}`}
                  count={details.length}
                  details={details}
                  orgId={orgId}
                  navigate={navigate}
                />
              );
            })
          )}
        </TabsContent>

        {/* Groups */}
        <TabsContent value="groups" className="space-y-2 m-0">
          {sortedGroups.length === 0 ? (
            <EmptyState icon={UsersRound} text={q ? "No groups match" : "No active groups"} />
          ) : (
            sortedGroups.map(([, { group, details }]) => {
              const key = `group-${group.id}`;
              const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
              const groupPositionNames = groupLookup[`[${group.name.toLowerCase()}]`]?.positionNames || [];
              return (
                <RoleCard
                  key={key}
                  expanded={expandedRoles.has(key)}
                  onToggle={() => toggleExpand(key)}
                  icon={UsersRound}
                  title={group.name}
                  subtitle={`${groupPositionNames.length} position${groupPositionNames.length !== 1 ? "s" : ""} · ${details.length} process${details.length !== 1 ? "es" : ""} · ${totalSteps} step${totalSteps !== 1 ? "s" : ""}`}
                  count={details.length}
                  details={details}
                  orgId={orgId}
                  navigate={navigate}
                  highlight
                  positionTags={groupPositionNames}
                />
              );
            })
          )}
        </TabsContent>

        {/* Other */}
        <TabsContent value="other" className="space-y-2 m-0">
          {sortedUnmapped.length === 0 ? (
            <EmptyState icon={HelpCircle} text="All performers are mapped to org chart" />
          ) : (
            sortedUnmapped.map(([performer, details]) => {
              const totalSteps = details.reduce((s, d) => s + d.steps.length, 0);
              return (
                <RoleCard
                  key={performer}
                  expanded={expandedRoles.has(performer)}
                  onToggle={() => toggleExpand(performer)}
                  icon={Users}
                  title={performer}
                  capitalize
                  subtitle={`${details.length} process${details.length !== 1 ? "es" : ""} · ${totalSteps} step${totalSteps !== 1 ? "s" : ""}`}
                  count={details.length}
                  details={details}
                  orgId={orgId}
                  navigate={navigate}
                  dashed
                />
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {positions.length === 0 && Object.keys(unmapped).length === 0 && groups.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No roles found</p>
          <p className="text-xs mt-1">Define positions in organization settings and assign performers to process steps.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function RoleCard({
  expanded,
  onToggle,
  icon: Icon,
  title,
  subtitle,
  count,
  details,
  orgId,
  navigate,
  highlight,
  dashed,
  capitalize,
  positionTags,
}: {
  expanded: boolean;
  onToggle: () => void;
  icon: any;
  title: string;
  subtitle: string;
  count: number;
  details: RoleDetail[];
  orgId: string;
  navigate: (path: string) => void;
  highlight?: boolean;
  dashed?: boolean;
  capitalize?: boolean;
  positionTags?: string[];
}) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-card border hover:shadow-sm transition-all ${
            highlight ? "border-primary/30 hover:border-primary/50" : dashed ? "border-dashed hover:border-foreground/30" : "hover:border-primary/30"
          }`}
        >
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "" : "-rotate-90"}`} />
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${highlight ? "bg-primary/15" : "bg-muted"}`}>
            <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`font-medium text-sm ${capitalize ? "capitalize" : ""}`}>{title}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <Badge variant={highlight ? "default" : "secondary"} className="shrink-0">{count}</Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-12 mt-1 space-y-1 pb-2">
          {positionTags && positionTags.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2 py-1.5">
              {positionTags.map((name) => (
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
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {d.steps.some((s) => s.viaGroup) && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    via {d.steps.find((s) => s.viaGroup)?.viaGroup}
                  </Badge>
                )}
                {d.steps.length} step{d.steps.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
