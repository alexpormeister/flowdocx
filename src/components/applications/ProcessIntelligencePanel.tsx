import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getOrganizationTags, getOrganizationPositions } from "@/lib/organizationApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  ArrowRight,
  BarChart3,
  GitBranch,
  Network,
  Search,
  Server,
  Users,
  Workflow,
} from "lucide-react";

type StepRow = {
  project: Project;
  step: number;
  task: string;
  performer: string;
  systems: string[];
};

type RaciRow = {
  key: string;
  label: string;
  projects: Set<string>;
  steps: StepRow[];
  systems: Set<string>;
};

type DependencyRow = {
  key: string;
  type: "role" | "system";
  label: string;
  projects: Project[];
  steps: StepRow[];
};

const normalize = (value: string) => value.trim().replace(/^\[|\]$/g, "").trim().toLowerCase();

export default function ProcessIntelligencePanel({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("raci");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const { data: systems = [] } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: () => getOrganizationTags(orgId),
    enabled: !!user && !!orgId,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["org-positions", orgId],
    queryFn: () => getOrganizationPositions(orgId),
    enabled: !!user && !!orgId,
  });

  const orgProjects = useMemo(
    () => projects.filter((project) => project.organization_id === orgId && !project.is_template),
    [projects, orgId],
  );

  const allSteps = useMemo<StepRow[]>(() => {
    return orgProjects.flatMap((project) =>
      (project.process_steps || [])
        .filter((step) => step.task || step.performer || (step.system || []).length > 0)
        .map((step) => ({
          project,
          step: step.step,
          task: step.task || "[Untitled]",
          performer: step.performer || "Unassigned",
          systems: step.system || [],
        })),
    );
  }, [orgProjects]);

  const raciRows = useMemo<RaciRow[]>(() => {
    const map = new Map<string, RaciRow>();
    for (const row of allSteps) {
      const key = normalize(row.performer) || "unassigned";
      const label = row.performer || "Unassigned";
      if (!map.has(key)) {
        map.set(key, { key, label, projects: new Set(), steps: [], systems: new Set() });
      }
      const item = map.get(key)!;
      item.projects.add(row.project.id);
      item.steps.push(row);
      row.systems.forEach((system) => item.systems.add(system));
    }
    return Array.from(map.values()).sort((a, b) => b.steps.length - a.steps.length);
  }, [allSteps]);

  const dependencyRows = useMemo<DependencyRow[]>(() => {
    const map = new Map<string, DependencyRow>();
    const add = (type: "role" | "system", label: string, step: StepRow) => {
      const key = `${type}:${normalize(label)}`;
      if (!map.has(key)) map.set(key, { key, type, label, projects: [], steps: [] });
      const item = map.get(key)!;
      if (!item.projects.some((project) => project.id === step.project.id)) item.projects.push(step.project);
      item.steps.push(step);
    };

    allSteps.forEach((step) => {
      if (step.performer && step.performer !== "Unassigned") add("role", step.performer, step);
      step.systems.forEach((system) => add("system", system, step));
    });

    return Array.from(map.values())
      .filter((row) => row.projects.length > 1)
      .sort((a, b) => b.projects.length - a.projects.length || b.steps.length - a.steps.length);
  }, [allSteps]);

  const filteredSteps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSteps;
    return allSteps.filter((step) =>
      [step.performer, step.task, step.project.name, ...step.systems].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [allSteps, query]);

  const totalSystemsInUse = useMemo(() => new Set(allSteps.flatMap((step) => step.systems)).size, [allSteps]);
  const connectedProjects = useMemo(() => new Set(dependencyRows.flatMap((row) => row.projects.map((p) => p.id))).size, [dependencyRows]);
  const topRoles = raciRows.slice(0, 6);
  const topSystems = useMemo(() => {
    const counts = new Map<string, number>();
    allSteps.forEach((step) => step.systems.forEach((system) => counts.set(system, (counts.get(system) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allSteps]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Activity className="w-4 h-4 text-primary" />
            Live process intelligence
          </div>
          <h2 className="text-2xl font-bold mt-1">Process Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Dynamic overview generated from saved BPMN diagrams, lanes, tasks and system tags.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search role, system or process..."
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Workflow} label="Processes" value={orgProjects.length} />
        <MetricCard icon={BarChart3} label="Process steps" value={allSteps.length} />
        <MetricCard icon={Users} label="Roles in use" value={raciRows.length} />
        <MetricCard icon={Network} label="Cross-links" value={dependencyRows.length} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full lg:w-[620px] grid-cols-4">
          <TabsTrigger value="raci">RACI</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="dependencies">Links</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="raci" className="m-0 space-y-3">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">
              <div className="col-span-4">Role / Lane</div>
              <div className="col-span-2">Responsible</div>
              <div className="col-span-2">Processes</div>
              <div className="col-span-2">Systems</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {raciRows.length === 0 ? <EmptyState text="No lane or task data found yet." /> : raciRows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-3 px-4 py-3 border-b last:border-b-0 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-4 min-w-0">
                  <p className="font-medium truncate">{row.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.steps.slice(0, 2).map((step) => step.task).join(" · ")}</p>
                </div>
                <div className="col-span-2"><Badge variant="default">R</Badge></div>
                <div className="col-span-2 text-sm">{row.projects.size}</div>
                <div className="col-span-2 text-sm">{row.systems.size}</div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setQuery(row.label)}>Filter</Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="search" className="m-0 space-y-3">
          <StepList rows={filteredSteps} orgId={orgId} navigate={navigate} />
        </TabsContent>

        <TabsContent value="dependencies" className="m-0 grid gap-3 lg:grid-cols-2">
          {dependencyRows.length === 0 ? <div className="lg:col-span-2"><EmptyState text="No cross-process dependencies found yet." /></div> : dependencyRows.map((row) => (
            <div key={row.key} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant="secondary" className="mb-2 gap-1">
                    {row.type === "system" ? <Server className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {row.type === "system" ? "Shared system" : "Shared role"}
                  </Badge>
                  <h3 className="font-semibold truncate">{row.label}</h3>
                </div>
                <div className="text-right text-sm text-muted-foreground shrink-0">{row.projects.length} processes</div>
              </div>
              <div className="space-y-2">
                {row.projects.slice(0, 4).map((project) => (
                  <button key={project.id} onClick={() => navigate(`/editor/${project.id}?org=${orgId}`)} className="w-full flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                    <span className="text-sm font-medium truncate">{project.name}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="dashboard" className="m-0 grid gap-4 lg:grid-cols-2">
          <InsightCard title="Role coverage" icon={Users} items={topRoles.map((row) => [row.label, row.steps.length])} />
          <InsightCard title="System usage" icon={Server} items={topSystems} />
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <h3 className="font-semibold flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" />Organization scope</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <MiniStat label="Defined roles" value={positions.length} />
              <MiniStat label="Defined systems" value={systems.length} />
              <MiniStat label="Systems in use" value={totalSystemsInUse} />
              <MiniStat label="Connected processes" value={connectedProjects} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function StepList({ rows, orgId, navigate }: { rows: StepRow[]; orgId: string; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {rows.length === 0 ? <EmptyState text="No matching process steps found." /> : rows.slice(0, 250).map((row) => (
        <button key={`${row.project.id}-${row.step}-${row.task}`} onClick={() => navigate(`/editor/${row.project.id}?org=${orgId}`)} className="w-full grid grid-cols-12 gap-3 px-4 py-3 border-b last:border-b-0 text-left hover:bg-muted/30 transition-colors">
          <div className="col-span-12 md:col-span-4 min-w-0">
            <p className="font-medium truncate">{row.task}</p>
            <p className="text-xs text-muted-foreground truncate">#{row.step} · {row.project.name}</p>
          </div>
          <div className="col-span-6 md:col-span-3 text-sm truncate">{row.performer}</div>
          <div className="col-span-6 md:col-span-5 flex flex-wrap gap-1 justify-start md:justify-end">
            {row.systems.length === 0 ? <span className="text-xs text-muted-foreground">No systems</span> : row.systems.slice(0, 4).map((system) => <Badge key={system} variant="outline">{system}</Badge>)}
          </div>
        </button>
      ))}
    </div>
  );
}

function InsightCard({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: [string, number][] }) {
  const max = Math.max(...items.map(([, count]) => count), 1);
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : items.map(([label, count]) => (
        <div key={label} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{label}</span><span className="text-muted-foreground">{count}</span></div>
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.max((count / max) * 100, 8)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold mt-1">{value}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>;
}