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
  type OrganizationPosition,
  type OrganizationGroup,
} from "@/lib/organizationApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Plus,
  Pencil,
  Trash2,
  Server,
  UserCog,
  UsersRound,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface SystemsInventoryProps {
  orgId: string;
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
  const [formGroupId, setFormGroupId] = useState<string>("");

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

  const canEdit = membership?.role === "owner" || membership?.role === "admin" || membership?.role === "editor";

  const addMutation = useMutation({
    mutationFn: async (params: { name: string; description?: string; admin_position_id?: string; group_id?: string }) => {
      const tag = await addOrganizationTag(orgId, params.name);
      if (params.description || params.admin_position_id || params.group_id) {
        await updateOrganizationTag(tag.id, {
          description: params.description || null,
          admin_position_id: params.admin_position_id || null,
          group_id: params.group_id || null,
        });
      }
      return tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
      toast.success("System added");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; tag_name?: string; description?: string | null; admin_position_id?: string | null; group_id?: string | null }) => {
      const { id, ...updates } = params;
      await updateOrganizationTag(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
      toast.success("System updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeOrganizationTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
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

  const openCreate = () => {
    setEditingTag(null);
    setFormName("");
    setFormDescription("");
    setFormAdminPositionId("");
    setFormGroupId("");
    setDialogOpen(true);
  };

  const openEdit = (tag: OrganizationSystemTag) => {
    setEditingTag(tag);
    setFormName(tag.tag_name);
    setFormDescription((tag as any).description || "");
    setFormAdminPositionId((tag as any).admin_position_id || "");
    setFormGroupId((tag as any).group_id || "");
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
        group_id: formGroupId || null,
      });
    } else {
      await addMutation.mutateAsync({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        admin_position_id: formAdminPositionId || undefined,
        group_id: formGroupId || undefined,
      });
    }
    setDialogOpen(false);
  };

  const getPositionName = (id: string) => positions.find((p) => p.id === id)?.name || "—";
  const getGroupName = (id: string) => groups.find((g) => g.id === id)?.name || "—";

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
        {canEdit && (
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add System
          </Button>
        )}
      </div>

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
          <p className="font-medium">{search ? "No systems match your search" : "No systems yet"}</p>
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
            const grpId = (tag as any).group_id as string | null;

            return (
              <div
                key={tag.id}
                className="group relative rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
              >
                {/* Actions */}
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
                    <h3 className="font-semibold text-sm truncate">{tag.tag_name}</h3>
                    {desc && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {adminPosId && (
                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
                      <UserCog className="w-3 h-3" />
                      {getPositionName(adminPosId)}
                    </Badge>
                  )}
                  {grpId && (
                    <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5">
                      <UsersRound className="w-3 h-3" />
                      {getGroupName(grpId)}
                    </Badge>
                  )}
                  {!adminPosId && !grpId && !desc && (
                    <span className="text-[10px] text-muted-foreground italic">No details added</span>
                  )}
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
                <UserCog className="w-3.5 h-3.5" /> System Admin
              </label>
              <Select value={formAdminPositionId} onValueChange={setFormAdminPositionId}>
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
                <UsersRound className="w-3.5 h-3.5" /> User Group
              </label>
              <Select value={formGroupId} onValueChange={setFormGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || addMutation.isPending || updateMutation.isPending}
            >
              {editingTag ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
