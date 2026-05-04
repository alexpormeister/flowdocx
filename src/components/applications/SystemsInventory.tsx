import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  LayoutGrid,
  List,
  Filter,
  CheckCircle2,
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  

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

  // Auto-detect actual users for each system: collect performer names directly from steps
  // that use the system. Show ONLY who is truly on the lane — no group expansion.
  const autoDetectedUsers = useMemo(() => {
    const map: Record<string, string[]> = {}; // tag_name -> display names (deduped)
    const cleanLabel = (s: string) => s.replace(/^\[|\]$/g, "").trim();

    for (const tag of tags) {
      const seen = new Map<string, string>(); // lowercased -> original casing
      for (const project of orgProjects) {
        const steps = (project.process_steps as any[]) || [];
        for (const step of steps) {
          if ((step.system || []).includes(tag.tag_name) && step.performer) {
            const label = cleanLabel(step.performer);
            if (!label) continue;
            const key = label.toLowerCase();
            if (!seen.has(key)) seen.set(key, label);
          }
        }
      }
      if (seen.size > 0) {
        map[tag.tag_name] = Array.from(seen.values()).sort((a, b) =>
          a.localeCompare(b, "fi", { sensitivity: "base" })
        );
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
    let list = tags;
    if (adminFilter !== "all") {
      if (adminFilter === "__none__") {
        list = list.filter((t) => !(t as any).admin_position_id);
      } else {
        list = list.filter((t) => (t as any).admin_position_id === adminFilter);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.tag_name.toLowerCase().includes(q) ||
          (t as any).description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tags, search, adminFilter]);

  // Stats
  const stats = useMemo(() => {
    const withAdmin = tags.filter((t) => (t as any).admin_position_id).length;
    const withLink = tags.filter((t) => (t as any).link_url).length;
    const usedTagNames = new Set<string>();
    for (const project of orgProjects) {
      for (const step of (project.process_steps as any[]) || []) {
        for (const sys of step.system || []) usedTagNames.add(sys);
      }
    }
    const inUse = tags.filter((t) => usedTagNames.has(t.tag_name)).length;
    return {
      total: tags.length,
      withAdmin,
      withLink,
      inUse,
      orphan: tags.length - inUse,
    };
  }, [tags, orgProjects]);

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
    setFormGroupIds([]);
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


  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
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
            variant="outline"
            size="sm"
            onClick={() => setShowImpactAnalysis(true)}
            className="gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">Impact Analysis</span>
          </Button>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add System
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {tags.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SystemStatCard label="Total Systems" value={stats.total} icon={Server} accent />
          <SystemStatCard label="In Use" value={stats.inUse} icon={CheckCircle2} />
          <SystemStatCard label="With Admin" value={stats.withAdmin} icon={UserCog} />
          <SystemStatCard label="Unused" value={stats.orphan} icon={AlertTriangle} muted={stats.orphan === 0} />
        </div>
      )}

      {/* Warning banner */}
      {tags.length > 0 && (warningStats.missingLink > 0 || warningStats.missingAdmin > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-medium text-amber-800">Incomplete data:</span>{" "}
            <span className="text-amber-700">
              {warningStats.missingAdmin > 0 && `${warningStats.missingAdmin} missing admin`}
              {warningStats.missingAdmin > 0 && warningStats.missingLink > 0 && " · "}
              {warningStats.missingLink > 0 && `${warningStats.missingLink} missing link`}
            </span>
          </div>
        </div>
      )}

      {/* Toolbar: search + filter + view toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search systems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={adminFilter} onValueChange={setAdminFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter by admin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              <SelectItem value="__none__">No admin</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-md p-0.5 bg-card">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Result count */}
      {tags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of {tags.length} systems
        </p>
      )}

      {/* Impact Analysis Sheet (modal) */}
      <Sheet open={showImpactAnalysis} onOpenChange={setShowImpactAnalysis}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              Impact Analysis
            </SheetTitle>
            <SheetDescription>
              Toggle systems off to simulate outages and see affected processes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
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
          </div>
        </SheetContent>
      </Sheet>

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
      ) : viewMode === "list" ? (
        /* List view (compact, dense — works well for many systems) */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
            <div className="col-span-4">System</div>
            <div className="col-span-3 hidden md:block">Admin</div>
            <div className="col-span-3 hidden lg:block">Käyttäjät</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y">
            {filtered.map((tag) => {
              const desc = (tag as any).description as string | null;
              const adminPosId = (tag as any).admin_position_id as string | null;
              const linkUrl = (tag as any).link_url as string | null;
              const detectedUsers = autoDetectedUsers[tag.tag_name] || [];
              return (
                <div
                  key={tag.id}
                  className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-muted/40 transition-colors group"
                >
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Server className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{tag.tag_name}</span>
                        {linkUrl && (
                          <a
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {!adminPosId && (
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        )}
                      </div>
                      {desc && (
                        <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 hidden md:block min-w-0">
                    {adminPosId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-foreground truncate">
                        <UserCog className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{getPositionName(adminPosId)}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] italic text-muted-foreground">No admin</span>
                    )}
                  </div>
                  <div className="col-span-3 hidden lg:flex flex-wrap gap-1 min-w-0">
                    {detectedUsers.length === 0 ? (
                      <span className="text-[11px] italic text-muted-foreground">—</span>
                    ) : (
                      detectedUsers.slice(0, 2).map((name) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="text-[10px] gap-1 px-1.5 py-0 font-normal"
                        >
                          <UsersRound className="w-2.5 h-2.5" />
                          {name}
                        </Badge>
                      ))
                    )}
                    {detectedUsers.length > 2 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{detectedUsers.length - 2}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => openEdit(tag)}
                          className="p-1.5 rounded-md hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(tag.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((tag) => {
            const desc = (tag as any).description as string | null;
            const adminPosId = (tag as any).admin_position_id as string | null;
            const linkUrl = (tag as any).link_url as string | null;
            const detectedUsers = autoDetectedUsers[tag.tag_name] || [];
            const warnings: string[] = [];
            if (!adminPosId) warnings.push("No admin");
            if (!linkUrl) warnings.push("No link");

            return (
              <div
                key={tag.id}
                className="group relative rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all"
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
                  {detectedUsers.map((name) => (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="text-[10px] gap-1 px-1.5 py-0.5"
                    >
                      <UsersRound className="w-3 h-3" />
                      {name}
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
                <UsersRound className="w-3.5 h-3.5" /> Käyttäjät
              </label>
              <p className="text-xs text-muted-foreground">
                Käyttäjät tunnistetaan automaattisesti BPMN-kaavioista — niistä radoista,
                joilla tämä järjestelmä esiintyy. Lista päivittyy itsestään, eikä sitä voi muokata käsin.
              </p>
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

// Stat card for systems overview
function SystemStatCard({
  label,
  value,
  icon: Icon,
  accent,
  muted,
}: {
  label: string;
  value: number;
  icon: any;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <Icon
          className={`w-3.5 h-3.5 ${
            accent ? "text-primary" : muted ? "text-muted-foreground/50" : "text-muted-foreground"
          }`}
        />
      </div>
      <p
        className={`text-2xl font-bold mt-1 ${
          accent ? "text-primary" : muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </p>
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
  const navigate = useNavigate();
  const [impactSearch, setImpactSearch] = useState("");

  const sortedTags = useMemo(() => {
    const keys = Object.keys(tagProjectMap);
    const q = impactSearch.toLowerCase();
    const filtered = q ? keys.filter((k) => k.toLowerCase().includes(q)) : keys;
    return filtered.sort((a, b) => a.localeCompare(b, "fi", { sensitivity: "base" }));
  }, [tagProjectMap, impactSearch]);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Systems</p>
          <p className="text-2xl font-bold mt-0.5">{sortedTags.length}</p>
        </div>
        <div className={`rounded-lg border p-3 ${disabledSystems.size > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Disabled</p>
          <p className={`text-2xl font-bold mt-0.5 ${disabledSystems.size > 0 ? "text-destructive" : ""}`}>{disabledSystems.size}</p>
        </div>
        <div className={`rounded-lg border p-3 ${affectedDetails.length > 0 ? "border-amber-400/50 bg-amber-50" : "bg-card"}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Affected</p>
          <p className={`text-2xl font-bold mt-0.5 ${affectedDetails.length > 0 ? "text-amber-700" : ""}`}>{affectedDetails.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search systems..."
          value={impactSearch}
          onChange={(e) => setImpactSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* System toggles - compact list */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Systems ({sortedTags.length})
        </h4>
        <div className="rounded-lg border divide-y bg-card max-h-[280px] overflow-y-auto">
          {sortedTags.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground text-center">No systems found</p>
          ) : (
            sortedTags.map((tagName) => {
              const isOff = disabledSystems.has(tagName);
              const processCount = (tagProjectMap[tagName] || []).length;
              return (
                <div
                  key={tagName}
                  className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    isOff ? "bg-destructive/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOff ? "bg-destructive" : "bg-emerald-500"}`} />
                    <span className="truncate font-medium">{tagName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{processCount} proc.</span>
                  </div>
                  <Switch checked={!isOff} onCheckedChange={() => toggleSystem(tagName)} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Affected results */}
      {disabledSystems.size > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Affected Processes ({affectedDetails.length})
          </h4>
          {affectedDetails.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-3 py-4 text-center rounded-lg border border-dashed">
              No processes use the disabled systems.
            </p>
          ) : (
            <div className="space-y-1.5">
              {affectedDetails.map((detail) => (
                <Collapsible
                  key={detail.project.id}
                  open={expandedImpact.has(detail.project.id)}
                  onOpenChange={() => toggleImpactExpand(detail.project.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg bg-card border hover:border-destructive/50 transition-colors">
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${
                          expandedImpact.has(detail.project.id) ? "" : "-rotate-90"
                        }`}
                      />
                      <Workflow className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate flex-1 text-xs">{detail.project.name}</span>
                      <Badge variant="outline" className="text-destructive border-destructive/30 shrink-0 text-[10px]">
                        {detail.steps.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-7 mt-1 space-y-1 pb-1">
                      {detail.steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/50 text-muted-foreground">
                          <span className="font-mono text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded shrink-0">#{s.step}</span>
                          <span className="flex-1 truncate">{s.task}</span>
                          {s.performer && <span className="text-[10px] opacity-60 shrink-0">{s.performer}</span>}
                        </div>
                      ))}
                      {detail.steps.length === 0 && (
                        <p className="text-xs text-muted-foreground italic px-2 py-1">Tagged at project level</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
