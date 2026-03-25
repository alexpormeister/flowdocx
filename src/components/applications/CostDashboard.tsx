import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, getFolders, type Project, type Folder } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Clock, Euro, TrendingUp, Zap } from "lucide-react";

interface ProcessSummary {
  project: Project;
  folderName: string;
  totalCost: number;
  totalDuration: number;
  stepCount: number;
}

export default function CostDashboard({ orgId }: { orgId: string }) {
  const { user } = useAuth();

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
    [projects, orgId],
  );

  const folderMap = useMemo(() => {
    const map: Record<string, Folder> = {};
    for (const f of folders) map[f.id] = f;
    return map;
  }, [folders]);

  const summaries: ProcessSummary[] = useMemo(() => {
    return orgProjects.map((project) => {
      const steps = (project.process_steps as any[]) || [];
      let totalCost = 0;
      let totalDuration = 0;
      for (const step of steps) {
        totalCost += Number(step.cost_per_execution) || 0;
        totalDuration += Number(step.duration_minutes) || 0;
      }
      const folderName = project.folder_id ? folderMap[project.folder_id]?.name || "Unknown" : "Uncategorized";
      return { project, folderName, totalCost, totalDuration, stepCount: steps.length };
    });
  }, [orgProjects, folderMap]);

  // Folder-level aggregation
  const folderSummaries = useMemo(() => {
    const map: Record<string, { name: string; totalCost: number; totalDuration: number; count: number }> = {};
    for (const s of summaries) {
      if (!map[s.folderName]) map[s.folderName] = { name: s.folderName, totalCost: 0, totalDuration: 0, count: 0 };
      map[s.folderName].totalCost += s.totalCost;
      map[s.folderName].totalDuration += s.totalDuration;
      map[s.folderName].count++;
    }
    return Object.values(map).sort((a, b) => b.totalCost - a.totalCost);
  }, [summaries]);

  const totalOrgCost = summaries.reduce((s, p) => s + p.totalCost, 0);
  const totalOrgDuration = summaries.reduce((s, p) => s + p.totalDuration, 0);
  const avgEfficiency = summaries.length > 0 ? totalOrgDuration / summaries.length : 0;

  const topCostProcesses = [...summaries].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
  const topDurationProcesses = [...summaries].sort((a, b) => b.totalDuration - a.totalDuration).slice(0, 10);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(220, 60%, 50%)",
    "hsl(280, 50%, 50%)",
    "hsl(340, 50%, 50%)",
    "hsl(30, 60%, 50%)",
    "hsl(160, 50%, 40%)",
    "hsl(200, 60%, 45%)",
    "hsl(50, 60%, 45%)",
    "hsl(0, 50%, 50%)",
  ];

  const hasData = summaries.some((s) => s.totalCost > 0 || s.totalDuration > 0);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold">{totalOrgCost.toFixed(0)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Duration</p>
                <p className="text-xl font-bold">{totalOrgDuration.toFixed(0)} min</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Processes</p>
                <p className="text-xl font-bold">{summaries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
                <p className="text-xl font-bold">{avgEfficiency.toFixed(0)} min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasData && (
        <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
          <Euro className="w-5 h-5 text-primary" /> <p className="font-medium">No cost or duration data yet</p>
          <p className="text-xs mt-1">Add cost and duration values to process steps in the editor.</p>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost by process */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Cost by Process (€)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCostProcesses.map((s) => ({ name: s.project.name.slice(0, 20), value: s.totalCost }))}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)} €`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {topCostProcesses.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Duration by process */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Duration by Process (min)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topDurationProcesses.map((s) => ({
                      name: s.project.name.slice(0, 20),
                      value: s.totalDuration,
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(0)} min`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {topDurationProcesses.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Folder breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Cost & Duration by Department / Folder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Folder</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Processes</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total Cost (€)</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total Duration (min)</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Efficiency Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folderSummaries.map((fs) => {
                      const efficiency =
                        fs.totalDuration > 0 && fs.totalCost > 0 ? (fs.totalCost / fs.totalDuration).toFixed(2) : "—";
                      return (
                        <tr key={fs.name} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 font-medium">{fs.name}</td>
                          <td className="py-2.5 text-right">{fs.count}</td>
                          <td className="py-2.5 text-right">{fs.totalCost.toFixed(0)} €</td>
                          <td className="py-2.5 text-right">{fs.totalDuration.toFixed(0)} min</td>
                          <td className="py-2.5 text-right">
                            <Badge variant="outline" className="text-xs">
                              {efficiency} €/min
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
