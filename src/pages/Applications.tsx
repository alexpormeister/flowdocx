import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, getFolders, type Project } from "@/lib/api";
import { getOrganizations, getOrganizationTags } from "@/lib/organizationApi";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AppWindow, AlertTriangle, ChevronRight } from "lucide-react";

export default function Applications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");

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

  // Build tag → projects mapping from process_steps system fields
  const tagProjectMap = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const tag of orgTags) {
      map[tag.tag_name] = [];
    }
    for (const project of orgProjects) {
      const steps = project.process_steps || [];
      const projectTags = new Set<string>();
      for (const step of steps) {
        for (const sys of step.system || []) {
          projectTags.add(sys);
        }
      }
      // Also check project-level system_tags
      for (const tag of project.system_tags || []) {
        projectTags.add(tag);
      }
      for (const tag of projectTags) {
        if (!map[tag]) map[tag] = [];
        map[tag].push(project);
      }
    }
    return map;
  }, [orgTags, orgProjects]);

  // Disabled systems state
  const [disabledSystems, setDisabledSystems] = useState<Set<string>>(new Set());

  const toggleSystem = (tagName: string) => {
    setDisabledSystems((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  };

  // Affected processes when systems are off
  const affectedProjects = useMemo(() => {
    if (disabledSystems.size === 0) return [];
    const affected = new Set<string>();
    for (const sys of disabledSystems) {
      for (const p of tagProjectMap[sys] || []) {
        affected.add(p.id);
      }
    }
    return orgProjects.filter((p) => affected.has(p.id));
  }, [disabledSystems, tagProjectMap, orgProjects]);

  const sortedTags = useMemo(
    () =>
      Object.keys(tagProjectMap).sort((a, b) =>
        a.localeCompare(b, "fi", { sensitivity: "base" })
      ),
    [tagProjectMap]
  );

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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/?org=${orgId}`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <AppWindow className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-semibold">{selectedOrg.name} — Applications</h1>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {/* Impact banner */}
        {disabledSystems.size > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold text-destructive">
                Impact Analysis — {disabledSystems.size} system(s) disabled
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {affectedProjects.length} process(es) would be affected:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {affectedProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/presentation/${p.id}?org=${orgId}`)}
                  className="flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md bg-card border hover:border-destructive/50 transition-colors"
                >
                  <span className="truncate flex-1">{p.name}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Applications grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTags.map((tagName) => {
            const linkedProjects = tagProjectMap[tagName] || [];
            const isOff = disabledSystems.has(tagName);
            return (
              <div
                key={tagName}
                className={`rounded-xl border-2 p-4 transition-all ${
                  isOff
                    ? "border-destructive/40 bg-destructive/5 opacity-75"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isOff ? "bg-destructive" : "bg-green-500"
                      }`}
                    />
                    <h3 className="font-semibold text-sm truncate">{tagName}</h3>
                  </div>
                  <Switch
                    checked={!isOff}
                    onCheckedChange={() => toggleSystem(tagName)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {linkedProjects.length} process(es)
                </p>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {linkedProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/presentation/${p.id}?org=${orgId}`)}
                      className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors truncate"
                    >
                      {p.name}
                    </button>
                  ))}
                  {linkedProjects.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No linked processes</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sortedTags.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AppWindow className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No applications/systems registered yet.</p>
            <p className="text-xs mt-1">Add system tags to process steps in the editor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
