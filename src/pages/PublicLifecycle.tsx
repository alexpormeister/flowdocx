import { useMemo, useCallback, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

const NODE_W = 240;
const NODE_H_BASE = 60;

interface Stage {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  position_x: number;
  position_y: number;
}

interface Connection {
  id: string;
  from_stage_id: string;
  to_stage_id: string;
  label: string | null;
}

interface StageProcess {
  id: string;
  stage_id: string;
  project_id: string;
}

interface ProjectInfo {
  id: string;
  name: string;
}

async function fetchLifecycleData(token: string, lifecycleId: string) {
  const { data, error } = await supabase.functions.invoke("get-lifecycle-data", {
    body: { token, lifecycleId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as {
    token: any;
    organization: any;
    lifecycle: any;
    stages: Stage[];
    connections: Connection[];
    stageProcesses: StageProcess[];
    projects: ProjectInfo[];
  };
}

export default function PublicLifecycle() {
  const { token, lifecycleId } = useParams<{ token: string; lifecycleId: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["public-lifecycle", token, lifecycleId],
    queryFn: () => fetchLifecycleData(token!, lifecycleId!),
    enabled: !!token && !!lifecycleId,
  });

  const stages = data?.stages || [];
  const connections = data?.connections || [];
  const stageProcesses = data?.stageProcesses || [];
  const projects = data?.projects || [];

  const getStage = (id: string) => stages.find(s => s.id === id);
  const getProject = (id: string) => projects.find(p => p.id === id);
  const getStageProcesses = (stageId: string) => stageProcesses.filter(sp => sp.stage_id === stageId);

  const getArrowPath = (from: Stage, to: Stage) => {
    const fx = from.position_x + NODE_W / 2;
    const fy = from.position_y + NODE_H_BASE / 2;
    const tx = to.position_x + NODE_W / 2;
    const ty = to.position_y + NODE_H_BASE / 2;
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
    return { path: `M ${sx} ${sy} Q ${midX} ${sy}, ${midX} ${midY} Q ${midX} ${ey}, ${ex} ${ey}`, midX, midY };
  };

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Ladataan...</div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">Virheellinen tai vanhentunut linkki</p>
          <p className="text-sm text-muted-foreground">Tämä jakolinkki ei ole enää aktiivinen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base font-semibold truncate">{data.lifecycle.name}</h1>
          <span className="text-xs text-muted-foreground">—</span>
          <span className="text-xs text-muted-foreground truncate">{data.organization?.name}</span>
        </div>
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
      </header>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative bg-muted/30 cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
          <defs>
            <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}>
              <circle cx="1" cy="1" r="1" fill="currentColor" className="text-muted-foreground/30" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div className="absolute origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* SVG connections */}
          <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: 10000, height: 10000, overflow: "visible" }}>
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
                <g key={conn.id}>
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
          </svg>

          {/* Stage nodes (read-only) */}
          {stages.map(stage => {
            const procs = getStageProcesses(stage.id);
            return (
              <div
                key={stage.id}
                className="absolute select-none rounded-xl border-2 bg-card shadow-sm"
                style={{
                  left: stage.position_x,
                  top: stage.position_y,
                  width: NODE_W,
                  borderColor: stage.color || "hsl(var(--border))",
                }}
              >
                <div
                  className="rounded-t-[10px] px-3 py-2"
                  style={{ backgroundColor: stage.color || "#0891b2", color: "#fff" }}
                >
                  <span className="text-xs font-semibold break-words leading-tight">{stage.name}</span>
                </div>
                {stage.description && (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b">{stage.description}</div>
                )}
                {procs.length > 0 && (
                  <div className="p-2 space-y-1">
                    {procs.map(sp => {
                      const proj = getProject(sp.project_id);
                      if (!proj) return null;
                      return (
                        <div key={sp.id} className="flex items-center gap-1 text-[10px] rounded bg-muted/50 px-2 py-1">
                          <span className="flex-1 truncate">{proj.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {stages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground">Tämä elinkaari on tyhjä.</p>
          </div>
        )}
      </div>
    </div>
  );
}
