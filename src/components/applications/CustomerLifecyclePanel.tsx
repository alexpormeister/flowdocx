import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProjects, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowRight,
  Link2,
  Unlink,
  ChevronRight,
  Pencil,
} from "lucide-react";

interface LifecycleStage {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  order_index: number;
  color: string;
  created_at: string;
}

interface StageProcess {
  id: string;
  stage_id: string;
  project_id: string;
  created_at: string;
}

const STAGE_COLORS = [
  "#0891b2", "#0d9488", "#059669", "#65a30d",
  "#ca8a04", "#ea580c", "#dc2626", "#9333ea",
  "#2563eb", "#4f46e5",
];

export default function CustomerLifecyclePanel({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddStage, setShowAddStage] = useState(false);
  const [editingStage, setEditingStage] = useState<LifecycleStage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageDesc, setStageDesc] = useState("");
  const [stageColor, setStageColor] = useState(STAGE_COLORS[0]);
  const [linkingStageId, setLinkingStageId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Fetch stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["lifecycle-stages", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_lifecycle_stages")
        .select("*")
        .eq("organization_id", orgId)
        .order("order_index");
      if (error) throw error;
      return data as LifecycleStage[];
    },
    enabled: !!user,
  });

  // Fetch stage-process links
  const { data: stageProcesses = [] } = useQuery({
    queryKey: ["lifecycle-stage-processes", orgId],
    queryFn: async () => {
      const stageIds = stages.map((s) => s.id);
      if (!stageIds.length) return [];
      const { data, error } = await supabase
        .from("customer_lifecycle_stage_processes")
        .select("*")
        .in("stage_id", stageIds);
      if (error) throw error;
      return data as StageProcess[];
    },
    enabled: stages.length > 0,
  });

  // Fetch org projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const orgProjects = useMemo(
    () => projects.filter((p) => p.organization_id === orgId),
    [projects, orgId]
  );

  // Mutations
  const addStage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("customer_lifecycle_stages")
        .insert({
          organization_id: orgId,
          name: stageName,
          description: stageDesc || null,
          order_index: stages.length,
          color: stageColor,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stages", orgId] });
      setShowAddStage(false);
      setStageName("");
      setStageDesc("");
      toast({ title: "Vaihe lisätty" });
    },
  });

  const updateStage = useMutation({
    mutationFn: async (stage: LifecycleStage) => {
      const { error } = await supabase
        .from("customer_lifecycle_stages")
        .update({ name: stage.name, description: stage.description, color: stage.color })
        .eq("id", stage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stages", orgId] });
      setEditingStage(null);
      toast({ title: "Vaihe päivitetty" });
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_lifecycle_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stages", orgId] });
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stage-processes", orgId] });
      toast({ title: "Vaihe poistettu" });
    },
  });

  const linkProcess = useMutation({
    mutationFn: async ({ stageId, projectId }: { stageId: string; projectId: string }) => {
      const { error } = await supabase
        .from("customer_lifecycle_stage_processes")
        .insert({ stage_id: stageId, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stage-processes", orgId] });
      setLinkingStageId(null);
      setSelectedProjectId("");
      toast({ title: "Prosessi linkitetty" });
    },
  });

  const unlinkProcess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_lifecycle_stage_processes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stage-processes", orgId] });
    },
  });

  const getStageProcesses = (stageId: string) =>
    stageProcesses.filter((sp) => sp.stage_id === stageId);

  const getProject = (projectId: string) =>
    orgProjects.find((p) => p.id === projectId);

  const linkedProjectIds = new Set(stageProcesses.map((sp) => sp.project_id));
  const availableProjects = orgProjects.filter((p) => {
    if (!linkingStageId) return true;
    const alreadyLinked = stageProcesses.some(
      (sp) => sp.stage_id === linkingStageId && sp.project_id === p.id
    );
    return !alreadyLinked;
  });

  const openEditDialog = (stage: LifecycleStage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageDesc(stage.description || "");
    setStageColor(stage.color);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Asiakkaan elinkaari</h2>
          <p className="text-sm text-muted-foreground">
            Rakenna asiakkaan elinkaari linkittämällä prosesseja eri vaiheisiin
          </p>
        </div>
        <Button onClick={() => { setShowAddStage(true); setStageName(""); setStageDesc(""); setStageColor(STAGE_COLORS[stages.length % STAGE_COLORS.length]); }}>
          <Plus className="w-4 h-4 mr-2" />
          Lisää vaihe
        </Button>
      </div>

      {/* Lifecycle visualization */}
      {stagesLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Ladataan...</div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl text-muted-foreground gap-3">
          <p className="text-sm">Ei vielä vaiheita. Aloita lisäämällä ensimmäinen elinkaaren vaihe.</p>
          <Button variant="outline" onClick={() => setShowAddStage(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Lisää ensimmäinen vaihe
          </Button>
        </div>
      ) : (
        <>
          {/* Arrow flow */}
          <div className="flex items-start gap-0 overflow-x-auto pb-4">
            {stages.map((stage, idx) => {
              const procs = getStageProcesses(stage.id);
              return (
                <div key={stage.id} className="flex items-start shrink-0">
                  <div className="flex flex-col items-center" style={{ minWidth: 220, maxWidth: 280 }}>
                    {/* Stage header */}
                    <div
                      className="w-full rounded-t-xl px-4 py-3 flex items-center justify-between gap-2"
                      style={{ backgroundColor: stage.color, color: "#fff" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-4 h-4 opacity-50 shrink-0" />
                        <span className="font-semibold text-sm truncate">{stage.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditDialog(stage)} className="p-1 rounded hover:bg-white/20 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteStage.mutate(stage.id)} className="p-1 rounded hover:bg-white/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stage description */}
                    {stage.description && (
                      <div className="w-full px-4 py-2 bg-muted/30 border-x border-border text-xs text-muted-foreground">
                        {stage.description}
                      </div>
                    )}

                    {/* Linked processes */}
                    <div className="w-full border-x border-b border-border rounded-b-xl bg-card p-3 space-y-2 min-h-[80px]">
                      {procs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Ei prosesseja</p>
                      ) : (
                        procs.map((sp) => {
                          const proj = getProject(sp.project_id);
                          if (!proj) return null;
                          return (
                            <div
                              key={sp.id}
                              className="group flex items-center gap-2 rounded-lg border bg-background p-2 text-xs hover:shadow-sm transition-shadow"
                            >
                              <button
                                onClick={() => navigate(`/editor/${proj.id}?org=${orgId}`)}
                                className="flex-1 text-left truncate text-foreground hover:text-primary transition-colors font-medium"
                                title={proj.name}
                              >
                                {proj.name}
                              </button>
                              <button
                                onClick={() => unlinkProcess.mutate(sp.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                                title="Poista linkki"
                              >
                                <Unlink className="w-3 h-3 text-destructive" />
                              </button>
                            </div>
                          );
                        })
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7"
                        onClick={() => { setLinkingStageId(stage.id); setSelectedProjectId(""); }}
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Linkitä prosessi
                      </Button>
                    </div>
                  </div>

                  {/* Arrow between stages */}
                  {idx < stages.length - 1 && (
                    <div className="flex items-center self-center mt-8 px-1">
                      <ChevronRight className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
            <span>{stages.length} vaihetta</span>
            <span>{stageProcesses.length} linkitettyä prosessia</span>
            <span>{orgProjects.length - linkedProjectIds.size} linkittämätöntä prosessia</span>
          </div>
        </>
      )}

      {/* Add Stage Dialog */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lisää elinkaaren vaihe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nimi</label>
              <Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="esim. Hankinta" />
            </div>
            <div>
              <label className="text-sm font-medium">Kuvaus</label>
              <Textarea value={stageDesc} onChange={(e) => setStageDesc(e.target.value)} placeholder="Vaiheen kuvaus..." rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Väri</label>
              <div className="flex gap-2 flex-wrap">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStageColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${stageColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStage(false)}>Peruuta</Button>
            <Button onClick={() => addStage.mutate()} disabled={!stageName.trim()}>Lisää</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stage Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && setEditingStage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Muokkaa vaihetta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nimi</label>
              <Input value={stageName} onChange={(e) => setStageName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Kuvaus</label>
              <Textarea value={stageDesc} onChange={(e) => setStageDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Väri</label>
              <div className="flex gap-2 flex-wrap">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStageColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${stageColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStage(null)}>Peruuta</Button>
            <Button
              onClick={() => {
                if (editingStage) {
                  updateStage.mutate({ ...editingStage, name: stageName, description: stageDesc || null, color: stageColor });
                }
              }}
              disabled={!stageName.trim()}
            >
              Tallenna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Process Dialog */}
      <Dialog open={!!linkingStageId} onOpenChange={(open) => !open && setLinkingStageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Linkitä prosessi vaiheeseen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Valitse prosessi..." />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                {availableProjects.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Ei saatavilla olevia prosesseja</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingStageId(null)}>Peruuta</Button>
            <Button
              onClick={() => {
                if (linkingStageId && selectedProjectId) {
                  linkProcess.mutate({ stageId: linkingStageId, projectId: selectedProjectId });
                }
              }}
              disabled={!selectedProjectId}
            >
              Linkitä
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
