import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProjects, type Project } from "@/lib/api";
import { getPresentationTokens, createPresentationToken, deletePresentationToken } from "@/lib/presentationApi";
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
  Link2,
  Unlink,
  Pencil,
  ArrowRight,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronDown,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";

// Types
interface Lifecycle {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Stage {
  id: string;
  organization_id: string;
  lifecycle_id: string | null;
  name: string;
  description: string | null;
  order_index: number;
  color: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

interface Connection {
  id: string;
  lifecycle_id: string;
  from_stage_id: string;
  to_stage_id: string;
  label: string | null;
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

const NODE_W = 240;
const NODE_H_BASE = 60;

export default function CustomerLifecyclePanel({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas state
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Interaction state
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [connecting, setConnecting] = useState<{ fromId: string; mouseX: number; mouseY: number } | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Dialog state
  const [selectedLifecycleId, setSelectedLifecycleId] = useState<string | null>(null);
  const [showAddLifecycle, setShowAddLifecycle] = useState(false);
  const [lifecycleName, setLifecycleName] = useState("");
  const [showAddStage, setShowAddStage] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageDesc, setStageDesc] = useState("");
  const [stageColor, setStageColor] = useState(STAGE_COLORS[0]);
  const [linkingStageId, setLinkingStageId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [connectionLabel, setConnectionLabel] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareTokenName, setShareTokenName] = useState("");

  // Queries
  const { data: lifecycles = [] } = useQuery({
    queryKey: ["customer-lifecycles", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_lifecycles")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at");
      if (error) throw error;
      return data as Lifecycle[];
    },
    enabled: !!user,
  });

  // Only auto-select if the selected lifecycle was deleted (no longer exists)
  useEffect(() => {
    if (lifecycles.length > 0 && selectedLifecycleId && !lifecycles.find(l => l.id === selectedLifecycleId)) {
      setSelectedLifecycleId(null);
    }
  }, [lifecycles, selectedLifecycleId]);

  const { data: stages = [] } = useQuery({
    queryKey: ["lifecycle-stages", orgId, selectedLifecycleId],
    queryFn: async () => {
      if (!selectedLifecycleId) return [];
      const { data, error } = await supabase
        .from("customer_lifecycle_stages")
        .select("*")
        .eq("lifecycle_id", selectedLifecycleId);
      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!selectedLifecycleId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["lifecycle-connections", selectedLifecycleId],
    queryFn: async () => {
      if (!selectedLifecycleId) return [];
      const { data, error } = await supabase
        .from("customer_lifecycle_connections")
        .select("*")
        .eq("lifecycle_id", selectedLifecycleId);
      if (error) throw error;
      return data as Connection[];
    },
    enabled: !!selectedLifecycleId,
  });

  const { data: stageProcesses = [] } = useQuery({
    queryKey: ["lifecycle-stage-processes", selectedLifecycleId],
    queryFn: async () => {
      const stageIds = stages.map(s => s.id);
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

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const { data: shareTokens = [] } = useQuery({
    queryKey: ["presentation-tokens", orgId],
    queryFn: () => getPresentationTokens(orgId),
    enabled: !!user,
  });

  const orgProjects = useMemo(
    () => projects.filter(p => p.organization_id === orgId),
    [projects, orgId]
  );

  // Mutations
  const addLifecycle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("customer_lifecycles")
        .insert({ organization_id: orgId, name: lifecycleName })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customer-lifecycles", orgId] });
      setSelectedLifecycleId(data.id);
      setShowAddLifecycle(false);
      setLifecycleName("");
      toast({ title: "Elinkaari luotu" });
    },
  });

  const deleteLifecycle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_lifecycles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-lifecycles", orgId] });
      setSelectedLifecycleId(null);
      toast({ title: "Elinkaari poistettu" });
    },
  });

  const addStage = useMutation({
    mutationFn: async () => {
      const centerX = (-pan.x + 400) / zoom;
      const centerY = (-pan.y + 300) / zoom;
      const { error } = await supabase
        .from("customer_lifecycle_stages")
        .insert({
          organization_id: orgId,
          lifecycle_id: selectedLifecycleId,
          name: stageName,
          description: stageDesc || null,
          color: stageColor,
          order_index: stages.length,
          position_x: centerX,
          position_y: centerY,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stages", orgId, selectedLifecycleId] });
      setShowAddStage(false);
      setStageName("");
      setStageDesc("");
      toast({ title: "Vaihe lisätty" });
    },
  });

  const updateStage = useMutation({
    mutationFn: async (stage: Partial<Stage> & { id: string }) => {
      const { error } = await supabase
        .from("customer_lifecycle_stages")
        .update(stage)
        .eq("id", stage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stages", orgId, selectedLifecycleId] });
      setEditingStage(null);
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_lifecycle_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stages", orgId, selectedLifecycleId] });
      queryClient.invalidateQueries({ queryKey: ["lifecycle-connections", selectedLifecycleId] });
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stage-processes", selectedLifecycleId] });
      toast({ title: "Vaihe poistettu" });
    },
  });

  const addConnection = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      if (!selectedLifecycleId) return;
      const { error } = await supabase
        .from("customer_lifecycle_connections")
        .insert({ lifecycle_id: selectedLifecycleId, from_stage_id: fromId, to_stage_id: toId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-connections", selectedLifecycleId] });
      toast({ title: "Yhteys luotu" });
    },
  });

  const updateConnection = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string | null }) => {
      const { error } = await supabase
        .from("customer_lifecycle_connections")
        .update({ label })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-connections", selectedLifecycleId] });
      setEditingConnection(null);
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_lifecycle_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle-connections", selectedLifecycleId] });
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
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stage-processes", selectedLifecycleId] });
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
      queryClient.invalidateQueries({ queryKey: ["lifecycle-stage-processes", selectedLifecycleId] });
    },
  });

  // Helpers
  const getStageProcesses = (stageId: string) => stageProcesses.filter(sp => sp.stage_id === stageId);
  const getProject = (projectId: string) => orgProjects.find(p => p.id === projectId);
  const getStage = (id: string) => stages.find(s => s.id === id);

  // Compute effective positions: use dragPos for the dragged stage
  const getEffectiveStage = useCallback((stage: Stage): Stage => {
    if (dragging && dragPos && stage.id === dragging.id) {
      return { ...stage, position_x: dragPos.x, position_y: dragPos.y };
    }
    return stage;
  }, [dragging, dragPos]);

  const availableProjects = useMemo(() => {
    if (!linkingStageId) return orgProjects;
    const linked = new Set(stageProcesses.filter(sp => sp.stage_id === linkingStageId).map(sp => sp.project_id));
    return orgProjects.filter(p => !linked.has(p.id));
  }, [orgProjects, stageProcesses, linkingStageId]);

  // Canvas mouse handlers
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedStageId(null);
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (dragging) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setDragPos({ x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY });
    }
    if (connecting) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnecting(prev => prev ? {
          ...prev,
          mouseX: (e.clientX - rect.left - pan.x) / zoom,
          mouseY: (e.clientY - rect.top - pan.y) / zoom,
        } : null);
      }
    }
  }, [isPanning, panStart, dragging, connecting, screenToCanvas, zoom, pan]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);
    if (dragging && dragPos) {
      updateStage.mutate({ id: dragging.id, position_x: dragPos.x, position_y: dragPos.y });
      setDragging(null);
      setDragPos(null);
    } else if (dragging) {
      setDragging(null);
      setDragPos(null);
    }
    if (connecting) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const effectiveStages = stages.map(s => {
        if (dragging && dragPos && s.id === dragging.id) return { ...s, position_x: dragPos.x, position_y: dragPos.y };
        return s;
      });
      const target = effectiveStages.find(s =>
        s.id !== connecting.fromId &&
        pos.x >= s.position_x && pos.x <= s.position_x + NODE_W &&
        pos.y >= s.position_y && pos.y <= s.position_y + NODE_H_BASE
      );
      if (target) {
        addConnection.mutate({ fromId: connecting.fromId, toId: target.id });
      }
      setConnecting(null);
    }
  }, [dragging, dragPos, connecting, stages, screenToCanvas]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.3), 3));
  }, []);

  const fitView = useCallback(() => {
    if (!stages.length || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const minX = Math.min(...stages.map(s => s.position_x));
    const minY = Math.min(...stages.map(s => s.position_y));
    const maxX = Math.max(...stages.map(s => s.position_x + NODE_W));
    const maxY = Math.max(...stages.map(s => s.position_y + NODE_H_BASE));
    const w = maxX - minX + 80;
    const h = maxY - minY + 80;
    const newZoom = Math.min(rect.width / w, rect.height / h, 1.5);
    setZoom(newZoom);
    setPan({
      x: (rect.width - w * newZoom) / 2 - minX * newZoom + 40 * newZoom,
      y: (rect.height - h * newZoom) / 2 - minY * newZoom + 40 * newZoom,
    });
  }, [stages]);

  // Arrow path between two stages
  const getArrowPath = (from: Stage, to: Stage) => {
    const fx = from.position_x + NODE_W / 2;
    const fy = from.position_y + NODE_H_BASE / 2;
    const tx = to.position_x + NODE_W / 2;
    const ty = to.position_y + NODE_H_BASE / 2;
    // Determine best connection points
    const dx = tx - fx;
    const dy = ty - fy;
    let sx: number, sy: number, ex: number, ey: number;
    if (Math.abs(dx) > Math.abs(dy)) {
      sx = dx > 0 ? from.position_x + NODE_W : from.position_x;
      sy = from.position_y + NODE_H_BASE / 2;
      ex = dx > 0 ? to.position_x : to.position_x + NODE_W;
      ey = to.position_y + NODE_H_BASE / 2;
    } else {
      sx = from.position_x + NODE_W / 2;
      sy = dy > 0 ? from.position_y + NODE_H_BASE : from.position_y;
      ex = to.position_x + NODE_W / 2;
      ey = dy > 0 ? to.position_y : to.position_y + NODE_H_BASE;
    }
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;
    return { path: `M ${sx} ${sy} Q ${midX} ${sy}, ${midX} ${midY} Q ${midX} ${ey}, ${ex} ${ey}`, midX, midY, ex, ey, sx, sy };
  };

  // No lifecycle selected - show lifecycle list
  if (!selectedLifecycleId) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Asiakkaan elinkaaret</h2>
            <p className="text-sm text-muted-foreground">Luo ja hallitse eri asiakassegmenttien elinkaaria</p>
          </div>
          <Button onClick={() => { setShowAddLifecycle(true); setLifecycleName(""); }}>
            <Plus className="w-4 h-4 mr-2" />Uusi elinkaari
          </Button>
        </div>
        {lifecycles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl text-muted-foreground gap-3">
            <p className="text-sm">Ei elinkaaria. Luo ensimmäinen aloittaaksesi.</p>
            <Button variant="outline" onClick={() => setShowAddLifecycle(true)}>
              <Plus className="w-4 h-4 mr-2" />Luo elinkaari
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifecycles.map(lc => (
              <button
                key={lc.id}
                onClick={() => setSelectedLifecycleId(lc.id)}
                className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-shadow group"
              >
                <h3 className="font-semibold text-sm">{lc.name}</h3>
                {lc.description && <p className="text-xs text-muted-foreground mt-1">{lc.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">Luotu {new Date(lc.created_at).toLocaleDateString("fi-FI")}</p>
              </button>
            ))}
          </div>
        )}
        {renderAddLifecycleDialog()}
      </div>
    );
  }

  const currentLifecycle = lifecycles.find(l => l.id === selectedLifecycleId);

  function renderAddLifecycleDialog() {
    return (
      <Dialog open={showAddLifecycle} onOpenChange={setShowAddLifecycle}>
        <DialogContent>
          <DialogHeader><DialogTitle>Uusi elinkaari</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nimi</label>
              <Input value={lifecycleName} onChange={e => setLifecycleName(e.target.value)} placeholder="esim. B2B-asiakas" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLifecycle(false)}>Peruuta</Button>
            <Button onClick={() => addLifecycle.mutate()} disabled={!lifecycleName.trim()}>Luo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedLifecycleId(null); }}>
            ← Kaikki elinkaaret
          </Button>
          <span className="text-sm font-semibold">{currentLifecycle?.name}</span>

          {/* Lifecycle switcher */}
          {lifecycles.length > 1 && (
            <Select value={selectedLifecycleId} onValueChange={setSelectedLifecycleId}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lifecycles.map(lc => (
                  <SelectItem key={lc.id} value={lc.id}>{lc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowAddStage(true); setStageName(""); setStageDesc(""); setStageColor(STAGE_COLORS[stages.length % STAGE_COLORS.length]); }}>
            <Plus className="w-4 h-4 mr-1" />Lisää vaihe
          </Button>
          <div className="flex items-center gap-1 border rounded-md px-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z * 1.2, 3))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitView}>
              <Maximize className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
            <Share2 className="w-4 h-4 mr-1" />Jaa
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
            if (confirm("Poistetaanko elinkaari?")) deleteLifecycle.mutate(selectedLifecycleId);
          }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative bg-muted/30 cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => { setIsPanning(false); setDragging(null); setConnecting(null); }}
        onWheel={handleWheel}
      >
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
          <defs>
            <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}>
              <circle cx="1" cy="1" r="1" fill="currentColor" className="text-muted-foreground/30" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Transformed layer */}
        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* SVG connections */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: 10000, height: 10000, overflow: "visible" }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-muted-foreground" />
              </marker>
            </defs>

            {connections.map(conn => {
              const from = getStage(conn.from_stage_id);
              const to = getStage(conn.to_stage_id);
              if (!from || !to) return null;
              const { path, midX, midY } = getArrowPath(from, to);
              return (
                <g key={conn.id} className="pointer-events-auto cursor-pointer" onClick={(e) => {
                  e.stopPropagation();
                  setEditingConnection(conn);
                  setConnectionLabel(conn.label || "");
                }}>
                  {/* Wider invisible hit area */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth="16" />
                  <path d={path} fill="none" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrowhead)" className="text-muted-foreground" />
                  {conn.label && (
                    <g>
                      <rect x={midX - conn.label.length * 3.5 - 6} y={midY - 10} width={conn.label.length * 7 + 12} height={20} rx={4} className="fill-card stroke-border" />
                      <text x={midX} y={midY + 4} textAnchor="middle" className="fill-foreground text-[11px]">{conn.label}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Connecting line preview */}
            {connecting && (() => {
              const from = getStage(connecting.fromId);
              if (!from) return null;
              const sx = from.position_x + NODE_W;
              const sy = from.position_y + NODE_H_BASE / 2;
              return (
                <line x1={sx} y1={sy} x2={connecting.mouseX} y2={connecting.mouseY} stroke="currentColor" strokeWidth="2" strokeDasharray="6 3" className="text-primary" />
              );
            })()}
          </svg>

          {/* Stage nodes */}
          {stages.map(stage => {
            const procs = getStageProcesses(stage.id);
            const nodeH = NODE_H_BASE + procs.length * 28;
            const isSelected = selectedStageId === stage.id;
            return (
              <div
                key={stage.id}
                className={`absolute select-none rounded-xl border-2 bg-card shadow-sm transition-shadow ${isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"}`}
                style={{
                  left: stage.position_x,
                  top: stage.position_y,
                  width: NODE_W,
                  borderColor: stage.color || "hsl(var(--border))",
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedStageId(stage.id); }}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  e.stopPropagation();
                  const pos = screenToCanvas(e.clientX, e.clientY);
                  setDragging({ id: stage.id, offsetX: pos.x - stage.position_x, offsetY: pos.y - stage.position_y });
                }}
              >
                {/* Header */}
                <div
                  className="rounded-t-[10px] px-3 py-2 flex items-center justify-between"
                  style={{ backgroundColor: stage.color || "#0891b2", color: "#fff" }}
                >
                  <span className="text-xs font-semibold flex-1 break-words leading-tight">{stage.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Connect handle */}
                    <button
                      className="p-1 rounded hover:bg-white/20"
                      title="Vedä yhteys toiseen vaiheeseen"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) {
                          setConnecting({
                            fromId: stage.id,
                            mouseX: (e.clientX - rect.left - pan.x) / zoom,
                            mouseY: (e.clientY - rect.top - pan.y) / zoom,
                          });
                        }
                      }}
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded hover:bg-white/20" onClick={(e) => { e.stopPropagation(); openEditDialog(stage); }}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded hover:bg-white/20" onClick={(e) => { e.stopPropagation(); deleteStage.mutate(stage.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {stage.description && (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b">{stage.description}</div>
                )}

                {/* Processes */}
                <div className="p-2 space-y-1">
                  {procs.map(sp => {
                    const proj = getProject(sp.project_id);
                    if (!proj) return null;
                    return (
                      <div key={sp.id} className="group flex items-center gap-1 text-[10px] rounded bg-muted/50 px-2 py-1">
                        <button
                          className="flex-1 text-left truncate hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); navigate(`/editor/${proj.id}?org=${orgId}`); }}
                        >{proj.name}</button>
                        <button className="opacity-0 group-hover:opacity-100 p-0.5" onClick={(e) => { e.stopPropagation(); unlinkProcess.mutate(sp.id); }}>
                          <Unlink className="w-2.5 h-2.5 text-destructive" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    className="w-full text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 rounded hover:bg-muted/50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setLinkingStageId(stage.id); setSelectedProjectId(""); }}
                  >
                    <Link2 className="w-2.5 h-2.5" />Linkitä
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {stages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground pointer-events-auto">
              <p className="text-sm mb-3">Tyhjä canvas. Lisää vaiheita aloittaaksesi.</p>
              <Button variant="outline" size="sm" onClick={() => { setShowAddStage(true); setStageName(""); setStageDesc(""); setStageColor(STAGE_COLORS[0]); }}>
                <Plus className="w-4 h-4 mr-1" />Lisää vaihe
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Stage Dialog */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lisää vaihe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nimi</label>
              <Input value={stageName} onChange={e => setStageName(e.target.value)} placeholder="esim. Hankinta" />
            </div>
            <div>
              <label className="text-sm font-medium">Kuvaus</label>
              <Textarea value={stageDesc} onChange={e => setStageDesc(e.target.value)} placeholder="Vaiheen kuvaus..." rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Väri</label>
              <div className="flex gap-2 flex-wrap">
                {STAGE_COLORS.map(c => (
                  <button key={c} onClick={() => setStageColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${stageColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
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
      <Dialog open={!!editingStage} onOpenChange={open => !open && setEditingStage(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Muokkaa vaihetta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nimi</label>
              <Input value={stageName} onChange={e => setStageName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Kuvaus</label>
              <Textarea value={stageDesc} onChange={e => setStageDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Väri</label>
              <div className="flex gap-2 flex-wrap">
                {STAGE_COLORS.map(c => (
                  <button key={c} onClick={() => setStageColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${stageColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStage(null)}>Peruuta</Button>
            <Button onClick={() => {
              if (editingStage) updateStage.mutate({ id: editingStage.id, name: stageName, description: stageDesc || null, color: stageColor });
              toast({ title: "Vaihe päivitetty" });
            }} disabled={!stageName.trim()}>Tallenna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Process Dialog */}
      <Dialog open={!!linkingStageId} onOpenChange={open => !open && setLinkingStageId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Linkitä prosessi</DialogTitle></DialogHeader>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger><SelectValue placeholder="Valitse prosessi..." /></SelectTrigger>
            <SelectContent>
              {availableProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
              {availableProjects.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Ei saatavilla</div>
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingStageId(null)}>Peruuta</Button>
            <Button onClick={() => { if (linkingStageId && selectedProjectId) linkProcess.mutate({ stageId: linkingStageId, projectId: selectedProjectId }); }} disabled={!selectedProjectId}>Linkitä</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Connection Dialog */}
      <Dialog open={!!editingConnection} onOpenChange={open => !open && setEditingConnection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Muokkaa yhteyttä</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Otsikko (valinnainen)</label>
              <Input value={connectionLabel} onChange={e => setConnectionLabel(e.target.value)} placeholder="esim. Ostaa / Ei osta" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getStage(editingConnection?.from_stage_id || "")?.name}</span>
              <ArrowRight className="w-3 h-3" />
              <span>{getStage(editingConnection?.to_stage_id || "")?.name}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={() => { if (editingConnection) deleteConnection.mutate(editingConnection.id); }}>Poista yhteys</Button>
            <Button variant="outline" onClick={() => setEditingConnection(null)}>Peruuta</Button>
            <Button onClick={() => { if (editingConnection) updateConnection.mutate({ id: editingConnection.id, label: connectionLabel || null }); }}>Tallenna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderAddLifecycleDialog()}

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Jaa elinkaari</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {shareTokens.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Valitse olemassa oleva jakolinkki tai luo uusi:</p>
                {shareTokens.filter(t => t.is_active).map(t => {
                  const shareUrl = `${window.location.origin}/lifecycle/${t.token}/${selectedLifecycleId}`;
                  return (
                    <div key={t.id} className="flex items-center gap-2 border rounded-lg p-2">
                      <span className="text-xs font-medium flex-1 truncate">{t.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Linkki kopioitu!" });
                      }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(shareUrl, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Luo jakolinkki, jolla elinkaarta voi katsella ilman kirjautumista.</p>
            )}
            <div className="border-t pt-3 space-y-2">
              <label className="text-sm font-medium">Uusi jakolinkki</label>
              <Input value={shareTokenName} onChange={e => setShareTokenName(e.target.value)} placeholder="esim. Asiakaselinkaari – tiimi" />
              <Button className="w-full" disabled={!shareTokenName.trim()} onClick={async () => {
                try {
                  await createPresentationToken(orgId, shareTokenName);
                  queryClient.invalidateQueries({ queryKey: ["presentation-tokens", orgId] });
                  setShareTokenName("");
                  toast({ title: "Jakolinkki luotu" });
                } catch {
                  toast({ title: "Virhe jakolinkin luonnissa", variant: "destructive" });
                }
              }}>
                <Plus className="w-4 h-4 mr-1" />Luo linkki
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function openEditDialog(stage: Stage) {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageDesc(stage.description || "");
    setStageColor(stage.color || STAGE_COLORS[0]);
  }
}
