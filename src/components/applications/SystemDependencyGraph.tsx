import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getOrganizationTags } from "@/lib/organizationApi";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Server,
  Workflow,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: "system" | "process" | "task";
  x: number;
  y: number;
  radius: number;
  color: string;
  projectId?: string;
  performer?: string;
  parentProcess?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  taskName?: string;
  performer?: string;
}

const PROCESS_COLORS = [
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(280, 55%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(60, 70%, 45%)",
  "hsl(120, 50%, 50%)",
];

// Force-directed layout simulation
function runForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations = 150
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const repulsion = 8000 * alpha;
    const attraction = 0.005 * alpha;
    const centerPull = 0.002 * alpha;

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = (a.radius + b.radius) * 2.5;
        if (dist < minDist) dist = minDist;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.x += fx; a.y += fy;
        b.x -= fx; b.y -= fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x, dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Desired distance based on node types
      const idealDist =
        src.type === "task" || tgt.type === "task" ? 120 : 200;
      const force = (dist - idealDist) * attraction;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      src.x += fx; src.y += fy;
      tgt.x -= fx; tgt.y -= fy;
    }

    // Center gravity
    const cx = 400, cy = 350;
    for (const n of nodes) {
      n.x += (cx - n.x) * centerPull;
      n.y += (cy - n.y) * centerPull;
    }
  }
}

export default function SystemDependencyGraph({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"system" | "process">("system");
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data: orgTags = [] } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: () => getOrganizationTags(orgId),
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

  const systemProcessMap = useMemo(() => {
    const map: Record<
      string,
      { project: Project; steps: { step: number; task: string; performer?: string }[] }[]
    > = {};
    for (const tag of orgTags) map[tag.tag_name] = [];
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
  }, [orgTags, orgProjects]);

  const processSystemMap = useMemo(() => {
    const map: Record<string, { systemName: string; steps: { step: number; task: string; performer?: string }[] }[]> = {};
    for (const project of orgProjects) {
      const projectSystems: Record<string, { step: number; task: string; performer?: string }[]> = {};
      const steps = (project.process_steps as any[]) || [];
      for (const step of steps) {
        for (const sys of step.system || []) {
          if (!projectSystems[sys]) projectSystems[sys] = [];
          projectSystems[sys].push({ step: step.step, task: step.task || "[Untitled]", performer: step.performer });
        }
      }
      if (Object.keys(projectSystems).length > 0) {
        map[project.id] = Object.entries(projectSystems).map(([systemName, steps]) => ({ systemName, steps }));
      }
    }
    return map;
  }, [orgProjects]);

  const allSystems = useMemo(() => Object.keys(systemProcessMap).sort(), [systemProcessMap]);
  const allProcesses = useMemo(
    () => orgProjects.filter((p) => processSystemMap[p.id]),
    [orgProjects, processSystemMap]
  );

  const filteredItems = useMemo(() => {
    const q = searchFilter.toLowerCase();
    if (searchMode === "system") return allSystems.filter((s) => s.toLowerCase().includes(q));
    return allProcesses.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchFilter, searchMode, allSystems, allProcesses]);

  // Build graph with force-directed layout
  const { nodes, edges } = useMemo(() => {
    if (!selectedCenter) return { nodes: [], edges: [] };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const cx = 400, cy = 350;

    if (searchMode === "system") {
      const details = systemProcessMap[selectedCenter] || [];
      const totalTasks = details.reduce((sum, d) => sum + Math.max(d.steps.length, 1), 0);
      const isCritical = totalTasks > 5;

      nodes.push({
        id: `sys-${selectedCenter}`,
        label: selectedCenter,
        type: "system",
        x: cx, y: cy,
        radius: isCritical ? 45 : 35,
        color: isCritical ? "hsl(0, 70%, 55%)" : "hsl(var(--primary))",
      });

      const angleStep = (2 * Math.PI) / Math.max(details.length, 1);
      details.forEach((detail, pi) => {
        const pColor = PROCESS_COLORS[pi % PROCESS_COLORS.length];
        const angle = angleStep * pi - Math.PI / 2;
        const dist = 200 + details.length * 15;
        const processNodeId = `proc-${detail.project.id}`;

        nodes.push({
          id: processNodeId,
          label: detail.project.name,
          type: "process",
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          radius: 25,
          color: pColor,
          projectId: detail.project.id,
        });
        edges.push({ source: `sys-${selectedCenter}`, target: processNodeId });

        detail.steps.forEach((step, ti) => {
          const taskAngle = angle + ((ti - (detail.steps.length - 1) / 2) * 0.3);
          const taskDist = dist + 140;
          const taskNodeId = `task-${detail.project.id}-${step.step}`;

          nodes.push({
            id: taskNodeId,
            label: `#${step.step} ${step.task}`,
            type: "task",
            x: cx + Math.cos(taskAngle) * taskDist,
            y: cy + Math.sin(taskAngle) * taskDist,
            radius: 14,
            color: pColor,
            projectId: detail.project.id,
            performer: step.performer,
            parentProcess: detail.project.name,
          });
          edges.push({ source: processNodeId, target: taskNodeId, taskName: step.task, performer: step.performer });
        });
      });
    } else {
      const project = orgProjects.find((p) => p.id === selectedCenter);
      if (!project) return { nodes: [], edges: [] };
      const systemsForProcess = processSystemMap[selectedCenter] || [];

      nodes.push({
        id: `proc-${project.id}`,
        label: project.name,
        type: "process",
        x: cx, y: cy,
        radius: 40,
        color: "hsl(var(--primary))",
        projectId: project.id,
      });

      const angleStep = (2 * Math.PI) / Math.max(systemsForProcess.length, 1);
      systemsForProcess.forEach((sys, si) => {
        const sColor = PROCESS_COLORS[si % PROCESS_COLORS.length];
        const angle = angleStep * si - Math.PI / 2;
        const dist = 200 + systemsForProcess.length * 15;
        const sysNodeId = `sys-${sys.systemName}`;
        const isCritical = sys.steps.length > 5;

        nodes.push({
          id: sysNodeId,
          label: sys.systemName,
          type: "system",
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          radius: isCritical ? 30 : 25,
          color: isCritical ? "hsl(0, 70%, 55%)" : sColor,
        });
        edges.push({ source: `proc-${project.id}`, target: sysNodeId });

        sys.steps.forEach((step, ti) => {
          const taskAngle = angle + ((ti - (sys.steps.length - 1) / 2) * 0.3);
          const taskDist = dist + 140;
          const taskNodeId = `task-${sys.systemName}-${step.step}`;

          nodes.push({
            id: taskNodeId,
            label: `#${step.step} ${step.task}`,
            type: "task",
            x: cx + Math.cos(taskAngle) * taskDist,
            y: cy + Math.sin(taskAngle) * taskDist,
            radius: 12,
            color: sColor,
            projectId: project.id,
            performer: step.performer,
            parentProcess: project.name,
          });
          edges.push({ source: sysNodeId, target: taskNodeId, taskName: step.task, performer: step.performer });
        });
      });
    }

    // Run force-directed layout to resolve overlaps
    runForceLayout(nodes, edges, 200);

    return { nodes, edges };
  }, [selectedCenter, searchMode, systemProcessMap, processSystemMap, orgProjects]);

  useEffect(() => {
    if (selectedCenter) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [selectedCenter]);

  // Auto-fit view when nodes change
  useEffect(() => {
    if (nodes.length === 0 || !containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius - 60);
      maxX = Math.max(maxX, n.x + n.radius + 60);
      minY = Math.min(minY, n.y - n.radius - 30);
      maxY = Math.max(maxY, n.y + n.radius + 30);
    }
    const graphW = maxX - minX;
    const graphH = maxY - minY;
    const scale = Math.min(w / graphW, h / graphH, 1.5) * 0.85;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setZoom(scale);
    setPan({ x: w / 2 - cx * scale, y: h / 2 - cy * scale });
  }, [nodes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(4, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as Element).tagName === "svg") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const fitView = () => {
    if (nodes.length === 0 || !containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth, h = container.clientHeight;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius - 60);
      maxX = Math.max(maxX, n.x + n.radius + 60);
      minY = Math.min(minY, n.y - n.radius - 30);
      maxY = Math.max(maxY, n.y + n.radius + 30);
    }
    const graphW = maxX - minX, graphH = maxY - minY;
    const scale = Math.min(w / graphW, h / graphH, 1.5) * 0.85;
    setZoom(scale);
    setPan({ x: w / 2 - ((minX + maxX) / 2) * scale, y: h / 2 - ((minY + maxY) / 2) * scale });
  };

  const selectItem = (id: string) => {
    setSelectedCenter(id);
    setSearchFilter("");
  };

  const getNodeById = (id: string) => nodes.find((n) => n.id === id);

  const totalTaskCount = useMemo(() => {
    if (!selectedCenter || searchMode !== "system") return 0;
    return (systemProcessMap[selectedCenter] || []).reduce((s, d) => s + d.steps.length, 0);
  }, [selectedCenter, searchMode, systemProcessMap]);

  // Curved edge path for bezier connections
  const getEdgePath = (src: GraphNode, tgt: GraphNode) => {
    const dx = tgt.x - src.x, dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return `M${src.x},${src.y}L${tgt.x},${tgt.y}`;
    // Slight curve
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    const nx = -dy / dist, ny = dx / dist;
    const curvature = Math.min(dist * 0.08, 20);
    const cx = midX + nx * curvature;
    const cy = midY + ny * curvature;
    return `M${src.x},${src.y}Q${cx},${cy},${tgt.x},${tgt.y}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={searchMode === "system" ? "default" : "outline"}
          size="sm"
          onClick={() => { setSearchMode("system"); setSelectedCenter(null); }}
        >
          <Server className="w-4 h-4 mr-1" />
          Järjestelmähaku
        </Button>
        <Button
          variant={searchMode === "process" ? "default" : "outline"}
          size="sm"
          onClick={() => { setSearchMode("process"); setSelectedCenter(null); }}
        >
          <Workflow className="w-4 h-4 mr-1" />
          Prosessihaku
        </Button>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchMode === "system" ? "Hae järjestelmää..." : "Hae prosessia..."}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedCenter && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={fitView}><Maximize2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.2))}><ZoomIn className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}><ZoomOut className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      {/* Selection list */}
      {!selectedCenter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(searchMode === "system" ? (filteredItems as string[]) : []).map((sys) => {
            const details = systemProcessMap[sys] || [];
            const taskCount = details.reduce((s, d) => s + d.steps.length, 0);
            const isCritical = taskCount > 5;
            return (
              <button
                key={sys}
                onClick={() => selectItem(sys)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                  isCritical ? "border-destructive/30 hover:border-destructive/60" : "border-border hover:border-primary/40"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isCritical ? "bg-destructive/10" : "bg-primary/10"}`}>
                  <Server className={`w-5 h-5 ${isCritical ? "text-destructive" : "text-primary"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{sys}</p>
                  <p className="text-xs text-muted-foreground">{details.length} prosessi(a) · {taskCount} tehtävä(ä)</p>
                </div>
                {isCritical && <Badge variant="destructive" className="shrink-0 text-[10px]">Kriittinen</Badge>}
              </button>
            );
          })}
          {searchMode === "process" &&
            (filteredItems as Project[]).map((proj) => {
              const systems = processSystemMap[proj.id] || [];
              return (
                <button
                  key={proj.id}
                  onClick={() => selectItem(proj.id)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border text-left transition-all hover:shadow-md hover:border-primary/40"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Workflow className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{proj.name}</p>
                    <p className="text-xs text-muted-foreground">{systems.length} järjestelmä(ä)</p>
                  </div>
                </button>
              );
            })}
          {filteredItems.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ei tuloksia</p>
            </div>
          )}
        </div>
      )}

      {/* Graph view */}
      {selectedCenter && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelectedCenter(null)}>
              ← Takaisin
            </Button>
            <h2 className="font-semibold text-lg">
              {searchMode === "system"
                ? selectedCenter
                : orgProjects.find((p) => p.id === selectedCenter)?.name}
            </h2>
            {searchMode === "system" && totalTaskCount > 5 && (
              <Badge variant="destructive">Kriittinen · {totalTaskCount} tehtävää</Badge>
            )}
          </div>

          <div
            ref={containerRef}
            className="relative border rounded-xl bg-card overflow-hidden"
            style={{ height: "650px" }}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              className="cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background pattern */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="0.5" fill="hsl(var(--muted-foreground))" opacity="0.15" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges as curved paths */}
                {edges.map((edge, i) => {
                  const src = getNodeById(edge.source);
                  const tgt = getNodeById(edge.target);
                  if (!src || !tgt) return null;

                  const isConnected =
                    hoveredNode?.id === edge.source || hoveredNode?.id === edge.target;
                  const isCriticalEdge =
                    searchMode === "system" && totalTaskCount > 5 && edge.source.startsWith("sys-");
                  const dimmed = hoveredNode && !isConnected;

                  return (
                    <path
                      key={i}
                      d={getEdgePath(src, tgt)}
                      fill="none"
                      stroke={
                        isConnected
                          ? "hsl(var(--primary))"
                          : isCriticalEdge
                          ? "hsl(0, 60%, 65%)"
                          : "hsl(var(--muted-foreground))"
                      }
                      strokeWidth={isConnected ? 2.5 : isCriticalEdge ? 2 : 1.2}
                      strokeOpacity={dimmed ? 0.1 : isConnected ? 0.9 : 0.25}
                      strokeLinecap="round"
                      className="transition-opacity duration-200"
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const isHovered = hoveredNode?.id === node.id;
                  const isConnected =
                    hoveredNode &&
                    edges.some(
                      (e) =>
                        (e.source === hoveredNode.id && e.target === node.id) ||
                        (e.target === hoveredNode.id && e.source === node.id)
                    );
                  const dimmed = hoveredNode && !isHovered && !isConnected;

                  const fontSize = node.type === "task" ? 7.5 : node.type === "process" ? 9.5 : 10.5;
                  const fontWeight = node.type === "system" ? 700 : node.type === "process" ? 600 : 400;
                  const maxChars = node.type === "task" ? 16 : 20;

                  // Word-wrap label
                  const words = node.label.split(/\s+/);
                  const lines: string[] = [];
                  let cur = "";
                  for (const w of words) {
                    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
                    else cur = cur ? cur + " " + w : w;
                  }
                  if (cur) lines.push(cur);

                  const lineHeight = fontSize + 2;
                  const textH = lines.length * lineHeight;
                  const maxLen = Math.max(...lines.map((l) => l.length));
                  const textW = maxLen * fontSize * 0.55;
                  const padX = 6, padY = 3;
                  const boxW = textW + padX * 2;
                  const boxH = textH + padY * 2;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => {
                        if (node.projectId) navigate(`/presentation/${node.projectId}?org=${orgId}`);
                      }}
                      style={{
                        cursor: node.projectId ? "pointer" : "default",
                        opacity: dimmed ? 0.15 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      {/* Glow ring on hover */}
                      {(isHovered || isConnected) && (
                        <circle
                          r={node.radius + 5}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={2}
                          strokeOpacity={0.35}
                        />
                      )}
                      {/* Outer circle */}
                      <circle
                        r={node.radius}
                        fill={node.color}
                        fillOpacity={node.type === "task" ? 0.12 : 0.18}
                        stroke={node.color}
                        strokeWidth={isHovered ? 2.5 : 1.5}
                      />
                      {/* Inner icon */}
                      {node.type === "system" && (
                        <>
                          <rect x={-7} y={-5} width={14} height={10} rx={2} fill="none" stroke={node.color} strokeWidth={1.2} />
                          <line x1={-7} y1={-1} x2={7} y2={-1} stroke={node.color} strokeWidth={0.8} />
                        </>
                      )}
                      {node.type === "process" && (
                        <polygon points="-5,-7 5,-7 9,0 5,7 -5,7 -9,0" fill="none" stroke={node.color} strokeWidth={1.2} />
                      )}
                      {node.type === "task" && <circle r={2.5} fill={node.color} />}

                      {/* Label with white background */}
                      <rect
                        x={-boxW / 2}
                        y={-boxH / 2}
                        width={boxW}
                        height={boxH}
                        rx={3}
                        fill="white"
                        fillOpacity={0.92}
                      />
                      <text
                        textAnchor="middle"
                        fill="hsl(var(--foreground))"
                        fontSize={fontSize}
                        fontWeight={fontWeight}
                      >
                        {lines.map((line, li) => (
                          <tspan
                            key={li}
                            x={0}
                            y={-textH / 2 + fontSize * 0.38 + li * lineHeight}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Tooltip */}
            {hoveredNode && (
              <div
                className="absolute pointer-events-none bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm z-50 max-w-[300px]"
                style={{
                  left: Math.min(
                    mousePos.x - (containerRef.current?.getBoundingClientRect().left || 0) + 12,
                    (containerRef.current?.clientWidth || 400) - 310
                  ),
                  top: mousePos.y - (containerRef.current?.getBoundingClientRect().top || 0) - 40,
                }}
              >
                <p className="font-medium break-words">{hoveredNode.label}</p>
                <p className="text-xs text-muted-foreground capitalize">{hoveredNode.type}</p>
                {hoveredNode.performer && (
                  <p className="text-xs text-muted-foreground">Rooli: {hoveredNode.performer}</p>
                )}
                {hoveredNode.projectId && (
                  <p className="text-xs text-primary mt-1">Klikkaa avataksesi →</p>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-primary bg-primary/20" />
                <span>Järjestelmä</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-500/20" />
                <span>Prosessi</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground bg-muted/30" />
                <span>Tehtävä</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-destructive rounded" />
                <span>Kriittinen (&gt;5)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
