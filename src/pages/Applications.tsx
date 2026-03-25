import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getOrganizations, getOrganizationTags } from "@/lib/organizationApi";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  AppWindow,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Server,
  Workflow,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface AffectedDetail {
  project: Project;
  steps: { step: number; task: string; performer?: string }[];
}

export default function Applications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const [searchFilter, setSearchFilter] = useState("");

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    enabled: !!user,
  });

  const selectedOrg = organizations.find((o) => o.id === orgId);

  const { data: orgTags = [] } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: () => (orgId ? getOrganizationTags(orgId) : Promise.resolve([])),
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

  // Build tag → projects mapping with step-level detail
  const tagProjectMap = useMemo(() => {
    const map: Record<string, AffectedDetail[]> = {};
    for (const tag of orgTags) {
      map[tag.tag_name] = [];
    }
    for (const project of orgProjects) {
      const steps = (project.process_steps as any[]) || [];
      const tagSteps: Record<string, { step: number; task: string; performer?: string }[]> = {};

      for (const step of steps) {
        for (const sys of step.system || []) {
          if (!tagSteps[sys]) tagSteps[sys] = [];
          tagSteps[sys].push({
            step: step.step,
            task: step.task || "[Untitled]",
            performer: step.performer,
          });
        }
      }
      // Also project-level system_tags
      for (const tag of project.system_tags || []) {
        if (!tagSteps[tag]) tagSteps[tag] = [];
      }

      for (const [tag, stepsArr] of Object.entries(tagSteps)) {
        if (!map[tag]) map[tag] = [];
        map[tag].push({ project, steps: stepsArr });
      }
    }
    return map;
  }, [orgTags, orgProjects]);

  const [disabledSystems, setDisabledSystems] = useState<Set<string>>(new Set());
  const [expandedImpact, setExpandedImpact] = useState<Set<string>>(new Set());

  const toggleSystem = (tagName: string) => {
    setDisabledSystems((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  };

  const toggleImpactExpand = (projectId: string) => {
    setExpandedImpact((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  // Affected details when systems are off
  const affectedDetails = useMemo(() => {
    if (disabledSystems.size === 0) return [];
    const detailMap = new Map<string, AffectedDetail>();
    for (const sys of disabledSystems) {
      for (const detail of tagProjectMap[sys] || []) {
        const existing = detailMap.get(detail.project.id);
        if (existing) {
          const existingStepIds = new Set(existing.steps.map((s) => s.step));
          for (const s of detail.steps) {
            if (!existingStepIds.has(s.step)) existing.steps.push(s);
          }
        } else {
          detailMap.set(detail.project.id, { ...detail, steps: [...detail.steps] });
        }
      }
    }
    return Array.from(detailMap.values());
  }, [disabledSystems, tagProjectMap]);

  const sortedTags = useMemo(() => {
    const keys = Object.keys(tagProjectMap);
    const filtered = searchFilter
      ? keys.filter((k) => k.toLowerCase().includes(searchFilter.toLowerCase()))
      : keys;
    return filtered.sort((a, b) => a.localeCompare(b, "fi", { sensitivity: "base" }));
  }, [tagProjectMap, searchFilter]);

  if (!orgId || !selectedOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b flex items-center gap-3 px-4 md:px-6 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <AppWindow className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">{selectedOrg.name} — Applications</h1>
        <Badge variant="secondary" className="ml-auto">
          {sortedTags.length} systems
        </Badge>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search systems..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Impact banner */}
        {disabledSystems.size > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold text-destructive">
                Impact Analysis — {disabledSystems.size} system(s) disabled
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {affectedDetails.length} process(es) affected
            </p>
            <div className="space-y-2">
              {affectedDetails.map((detail) => (
                <Collapsible
                  key={detail.project.id}
                  open={expandedImpact.has(detail.project.id)}
                  onOpenChange={() => toggleImpactExpand(detail.project.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full text-left text-sm px-4 py-3 rounded-lg bg-card border hover:border-destructive/50 transition-colors">
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
                          expandedImpact.has(detail.project.id) ? "" : "-rotate-90"
                        }`}
                      />
                      <Workflow className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate flex-1">{detail.project.name}</span>
                      <Badge variant="outline" className="text-destructive border-destructive/30 shrink-0">
                        {detail.steps.length} step(s)
                      </Badge>
                      <ChevronRight
                        className="w-4 h-4 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/presentation/${detail.project.id}?org=${orgId}`);
                        }}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-10 mt-1 space-y-1 pb-1">
                      {detail.steps.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 text-xs px-3 py-2 rounded-md bg-muted/50 text-muted-foreground"
                        >
                          <span className="font-mono text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                            #{s.step}
                          </span>
                          <span className="flex-1 truncate">{s.task}</span>
                          {s.performer && (
                            <span className="text-[10px] opacity-60">{s.performer}</span>
                          )}
                        </div>
                      ))}
                      {detail.steps.length === 0 && (
                        <p className="text-xs text-muted-foreground italic px-3 py-1">
                          Tagged at project level (no specific step)
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}

        {/* Applications grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTags.map((tagName) => {
            const details = tagProjectMap[tagName] || [];
            const processCount = details.length;
            const isOff = disabledSystems.has(tagName);
            return (
              <div
                key={tagName}
                className={`group rounded-xl border p-5 transition-all duration-200 ${
                  isOff
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-card hover:shadow-md hover:border-primary/30"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isOff ? "bg-destructive/10" : "bg-primary/10"
                      }`}
                    >
                      <Server
                        className={`w-5 h-5 ${isOff ? "text-destructive" : "text-primary"}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{tagName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {processCount} process(es)
                      </p>
                    </div>
                  </div>
                  <Switch checked={!isOff} onCheckedChange={() => toggleSystem(tagName)} />
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isOff ? "bg-destructive animate-pulse" : "bg-green-500"
                    }`}
                  />
                  <span className={`text-xs font-medium ${isOff ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {isOff ? "Offline" : "Active"}
                  </span>
                </div>

                {/* Process list */}
                <div className="space-y-1 max-h-40 overflow-auto">
                  {details.map((d) => (
                    <button
                      key={d.project.id}
                      onClick={() =>
                        navigate(`/presentation/${d.project.id}?org=${orgId}`)
                      }
                      className="flex items-center gap-2 w-full text-left text-xs px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors truncate"
                    >
                      <Workflow className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{d.project.name}</span>
                      {d.steps.length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {d.steps.length} steps
                        </span>
                      )}
                    </button>
                  ))}
                  {details.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No linked processes
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sortedTags.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <AppWindow className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No applications registered yet</p>
            <p className="text-xs mt-1">
              Add system tags to process steps in the editor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
