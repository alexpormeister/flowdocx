import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrganizationTags,
  addOrganizationTag,
  removeOrganizationTag,
  updateOrganizationTag,
  getOrganizationPositions,
  getOrganizationGroupsWithPositions,
  getCurrentUserMembership,
  type OrganizationSystemTag,
} from "@/lib/organizationApi";
import { getAllSystemTagGroups, setSystemTagGroups } from "@/lib/presentationApi";
import { getProjects, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Server,
  UserCog,
  UsersRound,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  Workflow,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface SystemsInventoryProps {
  orgId: string;
}

interface AffectedDetail {
  project: Project;
  steps: { step: number; task: string; performer?: string }[];
}

export default function SystemsInventory({ orgId }: SystemsInventoryProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<OrganizationSystemTag | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAdminPositionId, setFormAdminPositionId] = useState<string>("");
  const [formGroupIds, setFormGroupIds] = useState<string[]>([]);
  const [formLinkUrl, setFormLinkUrl] = useState("");
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [disabledSystems, setDisabledSystems] = useState<Set<string>>(new Set());
  const [expandedImpact, setExpandedImpact] = useState<Set<string>>(new Set());
  const navigate = (await import("react-router-dom")).useNavigate ? undefined : undefined;

  const { data: membership } = useQuery({
    queryKey: ["org-membership", orgId],
    queryFn: () => getCurrentUserMembership(orgId),
    enabled: !!user,
  });

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: () => getOrganizationTags(orgId),
    enabled: !!user,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["org-positions", orgId],
    queryFn: () => getOrganizationPositions(orgId),
    enabled: !!user,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["org-groups-with-positions", orgId],
    queryFn: () => getOrganizationGroupsWithPositions(orgId),
    enabled: !!user,
  });

  const { data: tagGroupsMap = {} } = useQuery({
    queryKey: ["system-tag-groups", orgId],
    queryFn: () => getAllSystemTagGroups(orgId),
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const canEdit =
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "editor";

  // IT Inventory logic
  const orgProjects = useMemo(
    () => projects.filter((p) => p.organization_id === orgId && !p.is_template),
    [projects, orgId]
  );

  const tagProjectMap = useMemo(() => {
    const map: Record<string, AffectedDetail[]> = {};
    for (const tag of tags) map[tag.tag_name] = [];
    for (const project of orgProjects) {
      const steps = (project.process_steps as any[]) || [];
      const tagSteps: Record<string, { step: number; task: string; performer?: string }[]> = {};
      for (const step of steps) {
        for (const sys of step.system || []) {
          if (!tagSteps[sys]) tagSteps[sys] = [];
          tagSteps[sys].push({ step: step.step, task: step.task || "[Untitled]", performer: step.performer });
        }
      }
      for (const tag of project.system_tags || []) {
        if (!tagSteps[tag]) tagSteps[tag] = [];
      }
      for (const [tag, stepsArr] of Object.entries(tagSteps)) {
        if (!map[tag]) map[tag] = [];
        map[tag].push({ project, steps: stepsArr });
      }
    }
    return map;
  }, [tags, orgProjects]);

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

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      admin_position_id?: string;
      group_ids: string[];
      link_url?: string;
    }) => {
      const tag = await addOrganizationTag(orgId, params.name);
      await updateOrganizationTag(tag.id, {
        description: params.description || null,
        admin_position_id: params.admin_position_id || null,
        group_id: params.group_ids[0] || null,
      });
      if (params.link_url) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase
          .from("organization_system_tags")
          .update({ link_url: params.link_url } as any)
          .eq("id", tag.id);
      }
      if (params.group_ids.length > 0) {
        await setSystemTagGroups(tag.id, params.group_ids);
      }
      return tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
      queryClient.invalidateQueries({ queryKey: ["system-tag-groups", orgId] });
      toast.success("System added");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      tag_name?: string;
      description?: string | null;
      admin_position_id?: string | null;
      group_ids: string[];
      link_url?: string | null;
    }) => {
      const { id, group_ids, link_url, ...updates } = params;
      await updateOrganizationTag(id, {
        ...updates,
        group_id: group_ids[0] || null,
      });
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase
        .from("organization_system_tags")
        .update({ link_url: link_url || null } as any)
        .eq("id", id);
      await setSystemTagGroups(id, group_ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
      queryClient.invalidateQueries({ queryKey: ["system-tag-groups", orgId] });
      toast.success("System updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeOrganizationTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
      queryClient.invalidateQueries({ queryKey: ["system-tag-groups", orgId] });
      toast.success("System removed");
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter(
      (t) =>
        t.tag_name.toLowerCase().includes(q) ||
        (t as any).description?.toLowerCase().includes(q)
    );
  }, [tags, search]);

  // Warning counts
  const warningStats = useMemo(() => {
    let missingLink = 0;
    let missingAdmin = 0;
    for (const tag of tags) {
      if (!(tag as any).link_url) missingLink++;
      if (!(tag as any).admin_position_id) missingAdmin++;
    }
    return { missingLink, missingAdmin };
  }, [tags]);

  const openCreate = () => {
    setEditingTag(null);
    setFormName("");
    setFormDescription("");
    setFormAdminPositionId("");
    setFormGroupIds([]);
    setFormLinkUrl("");
    setDialogOpen(true);
  };

  const openEdit = (tag: OrganizationSystemTag) => {
    setEditingTag(tag);
    setFormName(tag.tag_name);
    setFormDescription((tag as any).description || "");
    setFormAdminPositionId((tag as any).admin_position_id || "");
    setFormGroupIds(tagGroupsMap[tag.id] || []);
    setFormLinkUrl((tag as any).link_url || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (editingTag) {
      await updateMutation.mutateAsync({
        id: editingTag.id,
        tag_name: formName.trim(),
        description: formDescription.trim() || null,
        admin_position_id: formAdminPositionId || null,
        group_ids: formGroupIds,
        link_url: formLinkUrl.trim() || null,
      });
    } else {
      await addMutation.mutateAsync({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        admin_position_id: formAdminPositionId || undefined,
        group_ids: formGroupIds,
        link_url: formLinkUrl.trim() || undefined,
      });
    }
    setDialogOpen(false);
  };

  const getPositionName = (id: string) =>
    positions.find((p) => p.id === id)?.name || "—";
  const getGroupName = (id: string) =>
    groups.find((g) => g.id === id)?.name || "—";

  const toggleGroupId = (gid: string) => {
    setFormGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((id) => id !== gid) : [...prev, gid]
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Systems
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization's systems & software inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showImpactAnalysis ? "default" : "outline"}
            size="sm"
            onClick={() => setShowImpactAnalysis(!showImpactAnalysis)}
            className="gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" />
            Impact Analysis
          </Button>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add System
            </Button>
          )}
        </div>
      </div>

      {/* Warning banner */}
      {tags.length > 0 && (warningStats.missingLink > 0 || warningStats.missingAdmin > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Incomplete system data</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-amber-700">
              {warningStats.missingAdmin > 0 && (
                <span>{warningStats.missingAdmin} system(s) missing admin</span>
              )}
              {warningStats.missingLink > 0 && (
                <span>{warningStats.missingLink} system(s) missing link</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search systems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Impact Analysis Panel */}
      {showImpactAnalysis && (
        <ImpactAnalysisPanel
          tags={tags}
          tagProjectMap={tagProjectMap}
          disabledSystems={disabledSystems}
          toggleSystem={toggleSystem}
          affectedDetails={affectedDetails}
          expandedImpact={expandedImpact}
          toggleImpactExpand={toggleImpactExpand}
          orgId={orgId}
        />
      )}

      {/* Systems grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Server className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {search ? "No systems match your search" : "No systems yet"}
          </p>
          {canEdit && !search && (
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Add your first system
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tag) => {
            const desc = (tag as any).description as string | null;
            const adminPosId = (tag as any).admin_position_id as string | null;
            const grpIds = tagGroupsMap[tag.id] || [];
            const linkUrl = (tag as any).link_url as string | null;
            const warnings: string[] = [];
            if (!adminPosId) warnings.push("No admin");
            if (!linkUrl) warnings.push("No link");

            return (
              <div
                key={tag.id}
                className="group relative rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
              >
                {canEdit && (
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(tag)}
                      className="p-1.5 rounded-md hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(tag.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{tag.tag_name}</h3>
                      {linkUrl && (
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {desc && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>
                    )}
                  </div>
                </div>

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {warnings.map((w) => (
                      <span
                        key={w}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {w}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {adminPosId && (
                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
                      <UserCog className="w-3 h-3" />
                      {getPositionName(adminPosId)}
                    </Badge>
                  )}
                  {grpIds.map((gid) => (
                    <Badge
                      key={gid}
                      variant="secondary"
                      className="text-[10px] gap-1 px-1.5 py-0.5"
                    >
                      <UsersRound className="w-3 h-3" />
                      {getGroupName(gid)}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit System" : "Add System"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="e.g. SAP, Salesforce, Jira..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Description
              </label>
              <Textarea
                placeholder="What does this system do?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" /> Link URL
              </label>
              <Input
                placeholder="https://..."
                value={formLinkUrl}
                onChange={(e) => setFormLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <UserCog className="w-3.5 h-3.5" /> System Admin
              </label>
              <Select
                value={formAdminPositionId || "none"}
                onValueChange={(v) => setFormAdminPositionId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <UsersRound className="w-3.5 h-3.5" /> User Groups
              </label>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No groups created yet</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-auto border rounded-md p-2">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5"
                    >
                      <Checkbox
                        checked={formGroupIds.includes(g.id)}
                        onCheckedChange={() => toggleGroupId(g.id)}
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formName.trim() || addMutation.isPending || updateMutation.isPending
              }
            >
              {editingTag ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Impact Analysis sub-component
function ImpactAnalysisPanel({
  tags,
  tagProjectMap,
  disabledSystems,
  toggleSystem,
  affectedDetails,
  expandedImpact,
  toggleImpactExpand,
  orgId,
}: {
  tags: any[];
  tagProjectMap: Record<string, AffectedDetail[]>;
  disabledSystems: Set<string>;
  toggleSystem: (name: string) => void;
  affectedDetails: AffectedDetail[];
  expandedImpact: Set<string>;
  toggleImpactExpand: (id: string) => void;
  orgId: string;
}) {
  const navigate = (await import("react-router-dom")).useNavigate();
  const sortedTags = useMemo(() => {
    return Object.keys(tagProjectMap).sort((a, b) => a.localeCompare(b, "fi", { sensitivity: "base" }));
  }, [tagProjectMap]);

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5">
      <h3 className="font-semibold flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-primary" />
        Impact Analysis
      </h3>
      <p className="text-sm text-muted-foreground">
        Toggle systems off to simulate outages and see affected processes.
      </p>

      {/* System toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sortedTags.map((tagName) => {
          const isOff = disabledSystems.has(tagName);
          const processCount = (tagProjectMap[tagName] || []).length;
          return (
            <div
              key={tagName}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                isOff ? "border-destructive/40 bg-destructive/5" : "bg-card"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full ${isOff ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
                <span className="truncate font-medium">{tagName}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">({processCount})</span>
              </div>
              <Switch checked={!isOff} onCheckedChange={() => toggleSystem(tagName)} />
            </div>
          );
        })}
      </div>

      {/* Impact results */}
      {disabledSystems.size > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="font-semibold text-destructive">
              {disabledSystems.size} system(s) disabled — {affectedDetails.length} process(es) affected
            </span>
          </div>
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
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-10 mt-1 space-y-1 pb-1">
                    {detail.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs px-3 py-2 rounded-md bg-muted/50 text-muted-foreground">
                        <span className="font-mono text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">#{s.step}</span>
                        <span className="flex-1 truncate">{s.task}</span>
                        {s.performer && <span className="text-[10px] opacity-60">{s.performer}</span>}
                      </div>
                    ))}
                    {detail.steps.length === 0 && (
                      <p className="text-xs text-muted-foreground italic px-3 py-1">Tagged at project level</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
