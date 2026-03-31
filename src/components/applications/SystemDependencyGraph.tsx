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
  vx: number;
  vy: number;
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

interface GraphLabelLayout {
  nodeId: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  lineHeight: number;
  fontSize: number;
  fontWeight: number;
  side: "left" | "right" | "top" | "bottom";
}

const GRAPH_CENTER = { x: 400, y: 300 };
const LABEL_PADDING_X = 8;
const LABEL_PADDING_Y = 6;
const LABEL_GAP = 18;
const LABEL_MARGIN = 10;
const GRAPH_BOUNDS = { minX: 16, minY: 16, maxX: 784, maxY: 584 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const splitLabelLines = (label: string, maxChars: number) => {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }

    if (currentLine && `${currentLine} ${word}`.length > maxChars) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [label];
};

const boxesOverlap = (
  a: Pick<GraphLabelLayout, "x" | "y" | "width" | "height">,
  b: Pick<GraphLabelLayout, "x" | "y" | "width" | "height">,
  padding = LABEL_MARGIN
) =>
  a.x - padding < b.x + b.width &&
  a.x + a.width + padding > b.x &&
  a.y - padding < b.y + b.height &&
  a.y + a.height + padding > b.y;

const circleOverlapsBox = (
  node: Pick<GraphNode, "x" | "y" | "radius">,
  box: Pick<GraphLabelLayout, "x" | "y" | "width" | "height">,
  padding = 6
) => {
  const closestX = clamp(node.x, box.x - padding, box.x + box.width + padding);
  const closestY = clamp(node.y, box.y - padding, box.y + box.height + padding);
  const dx = node.x - closestX;
  const dy = node.y - closestY;
  return dx * dx + dy * dy < (node.radius + padding) * (node.radius + padding);
};

const pointInsideRect = (x: number, y: number, rect: Pick<GraphLabelLayout, "x" | "y" | "width" | "height">, padding = 4) =>
  x >= rect.x - padding &&
  x <= rect.x + rect.width + padding &&
  y >= rect.y - padding &&
  y <= rect.y + rect.height + padding;

const segmentsIntersect = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
) => {
  const ccw = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (ry - py) * (qx - px) > (qy - py) * (rx - px);

  return (
    ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
    ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
  );
};

const segmentIntersectsRect = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Pick<GraphLabelLayout, "x" | "y" | "width" | "height">,
  padding = 4
) => {
  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;

  if (
    Math.max(x1, x2) < left ||
    Math.min(x1, x2) > right ||
    Math.max(y1, y2) < top ||
    Math.min(y1, y2) > bottom
  ) {
    return false;
  }

  if (pointInsideRect(x1, y1, rect, padding) || pointInsideRect(x2, y2, rect, padding)) {
    return true;
  }

  return (
    segmentsIntersect(x1, y1, x2, y2, left, top, right, top) ||
    segmentsIntersect(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsIntersect(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsIntersect(x1, y1, x2, y2, left, bottom, left, top)
  );
};

const PROCESS_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(280, 55%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(60, 70%, 45%)",
];

export default function SystemDependencyGraph({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"system" | "process">("system");
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
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

  // Build system->process->task mapping
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
          tagSteps[sys].push({
            step: step.step,
            task: step.task || "[Untitled]",
            performer: step.performer,
          });
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

  // Reverse: process -> systems
  const processSystemMap = useMemo(() => {
    const map: Record<string, { systemName: string; steps: { step: number; task: string; performer?: string }[] }[]> = {};

    for (const project of orgProjects) {
      const projectSystems: Record<string, { step: number; task: string; performer?: string }[]> = {};
      const steps = (project.process_steps as any[]) || [];

      for (const step of steps) {
        for (const sys of step.system || []) {
          if (!projectSystems[sys]) projectSystems[sys] = [];
          projectSystems[sys].push({
            step: step.step,
            task: step.task || "[Untitled]",
            performer: step.performer,
          });
        }
      }

      if (Object.keys(projectSystems).length > 0) {
        map[project.id] = Object.entries(projectSystems).map(([systemName, steps]) => ({
          systemName,
          steps,
        }));
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
    if (searchMode === "system") {
      return allSystems.filter((s) => s.toLowerCase().includes(q));
    }
    return allProcesses.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchFilter, searchMode, allSystems, allProcesses]);

  // Build graph nodes and edges
  const { nodes, edges } = useMemo(() => {
    if (!selectedCenter) return { nodes: [], edges: [] };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const cx = 400;
    const cy = 300;

    if (searchMode === "system") {
      const details = systemProcessMap[selectedCenter] || [];
      const totalTasks = details.reduce((sum, d) => sum + Math.max(d.steps.length, 1), 0);
      const isCritical = totalTasks > 5;

      // Center node
      nodes.push({
        id: `sys-${selectedCenter}`,
        label: selectedCenter,
        type: "system",
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        radius: isCritical ? 40 : 30,
        color: isCritical ? "hsl(0, 70%, 55%)" : "hsl(var(--primary))",
      });

      let processAngle = 0;
      const processAngleStep = (2 * Math.PI) / Math.max(details.length, 1);

      details.forEach((detail, pi) => {
        const pColor = PROCESS_COLORS[pi % PROCESS_COLORS.length];
        const pDist = 180;
        const px = cx + Math.cos(processAngle) * pDist;
        const py = cy + Math.sin(processAngle) * pDist;
        const processNodeId = `proc-${detail.project.id}`;

        nodes.push({
          id: processNodeId,
          label: detail.project.name,
          type: "process",
          x: px,
          y: py,
          vx: 0,
          vy: 0,
          radius: 22,
          color: pColor,
          projectId: detail.project.id,
        });

        edges.push({
          source: `sys-${selectedCenter}`,
          target: processNodeId,
        });

        // Task nodes
        const taskAngleStart = processAngle - (processAngleStep * 0.3);
        const taskAngleRange = processAngleStep * 0.6;
        const taskCount = detail.steps.length;

        detail.steps.forEach((step, ti) => {
          const tAngle =
            taskCount === 1
              ? processAngle
              : taskAngleStart + (taskAngleRange * ti) / (taskCount - 1);
          const tDist = pDist + 100;
          const tx = cx + Math.cos(tAngle) * tDist;
          const ty = cy + Math.sin(tAngle) * tDist;
          const taskNodeId = `task-${detail.project.id}-${step.step}`;

          nodes.push({
            id: taskNodeId,
            label: `#${step.step} ${step.task}`,
            type: "task",
            x: tx,
            y: ty,
            vx: 0,
            vy: 0,
            radius: 12,
            color: pColor,
            projectId: detail.project.id,
            performer: step.performer,
            parentProcess: detail.project.name,
          });

          edges.push({
            source: processNodeId,
            target: taskNodeId,
            taskName: step.task,
            performer: step.performer,
          });
        });

        processAngle += processAngleStep;
      });
    } else {
      // Process mode: center = process, surrounding = systems
      const project = orgProjects.find((p) => p.id === selectedCenter);
      if (!project) return { nodes: [], edges: [] };

      const systemsForProcess = processSystemMap[selectedCenter] || [];

      nodes.push({
        id: `proc-${project.id}`,
        label: project.name,
        type: "process",
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        radius: 35,
        color: "hsl(var(--primary))",
        projectId: project.id,
      });

      let sysAngle = 0;
      const sysAngleStep = (2 * Math.PI) / Math.max(systemsForProcess.length, 1);

      systemsForProcess.forEach((sys, si) => {
        const sColor = PROCESS_COLORS[si % PROCESS_COLORS.length];
        const sDist = 180;
        const sx = cx + Math.cos(sysAngle) * sDist;
        const sy = cy + Math.sin(sysAngle) * sDist;
        const sysNodeId = `sys-${sys.systemName}`;
        const isCritical = sys.steps.length > 5;

        nodes.push({
          id: sysNodeId,
          label: sys.systemName,
          type: "system",
          x: sx,
          y: sy,
          vx: 0,
          vy: 0,
          radius: isCritical ? 28 : 22,
          color: isCritical ? "hsl(0, 70%, 55%)" : sColor,
        });

        edges.push({
          source: `proc-${project.id}`,
          target: sysNodeId,
        });

        // Task nodes
        const taskAngleStart = sysAngle - (sysAngleStep * 0.3);
        const taskAngleRange = sysAngleStep * 0.6;

        sys.steps.forEach((step, ti) => {
          const tAngle =
            sys.steps.length === 1
              ? sysAngle
              : taskAngleStart + (taskAngleRange * ti) / (sys.steps.length - 1);
          const tDist = sDist + 100;
          const tx = cx + Math.cos(tAngle) * tDist;
          const ty = cy + Math.sin(tAngle) * tDist;
          const taskNodeId = `task-${sys.systemName}-${step.step}`;

          nodes.push({
            id: taskNodeId,
            label: `#${step.step} ${step.task}`,
            type: "task",
            x: tx,
            y: ty,
            vx: 0,
            vy: 0,
            radius: 10,
            color: sColor,
            projectId: project.id,
            performer: step.performer,
            parentProcess: project.name,
          });

          edges.push({
            source: sysNodeId,
            target: taskNodeId,
            taskName: step.task,
            performer: step.performer,
          });
        });

        sysAngle += sysAngleStep;
      });
    }

    return { nodes, edges };
  }, [selectedCenter, searchMode, systemProcessMap, processSystemMap, orgProjects]);

  // Reset view when center changes
  useEffect(() => {
    if (selectedCenter) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [selectedCenter]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
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
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const fitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const selectItem = (id: string) => {
    setSelectedCenter(id);
    setSearchFilter("");
  };

  const getNodeById = (id: string) => nodes.find((n) => n.id === id);

  const totalTaskCount = useMemo(() => {
    if (!selectedCenter || searchMode !== "system") return 0;
    const details = systemProcessMap[selectedCenter] || [];
    return details.reduce((s, d) => s + d.steps.length, 0);
  }, [selectedCenter, searchMode, systemProcessMap]);

  const labelLayouts = useMemo(() => {
    if (!nodes.length) return [] as GraphLabelLayout[];

    const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
    const connectedEdges = edges
      .map((edge) => {
        const source = nodeLookup.get(edge.source);
        const target = nodeLookup.get(edge.target);
        if (!source || !target) return null;
        return { x1: source.x, y1: source.y, x2: target.x, y2: target.y };
      })
      .filter((edge): edge is { x1: number; y1: number; x2: number; y2: number } => !!edge);

    const layouts = nodes.map<GraphLabelLayout>((node) => {
      const fontSize = node.type === "task" ? 9 : node.type === "process" ? 11 : 12;
      const fontWeight = node.type === "system" ? 700 : node.type === "process" ? 600 : 400;
      const lines = splitLabelLines(node.label, node.type === "task" ? 18 : 22);
      const lineHeight = fontSize + 3;
      const longestLine = Math.max(...lines.map((line) => line.length), 1);
      const width = Math.max(76, longestLine * fontSize * 0.58 + LABEL_PADDING_X * 2);
      const height = lines.length * lineHeight + LABEL_PADDING_Y * 2;
      const dx = node.x - GRAPH_CENTER.x;
      const dy = node.y - GRAPH_CENTER.y;

      let side: GraphLabelLayout["side"] = "bottom";
      let x = node.x - width / 2;
      let y = node.y + node.radius + LABEL_GAP;

      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
        side = "top";
        y = node.y - node.radius - LABEL_GAP - height;
      } else if (Math.abs(dx) >= Math.abs(dy)) {
        side = dx >= 0 ? "right" : "left";
        x = dx >= 0 ? node.x + node.radius + LABEL_GAP : node.x - node.radius - LABEL_GAP - width;
        y = node.y - height / 2;
      } else {
        side = dy >= 0 ? "bottom" : "top";
        x = node.x - width / 2;
        y = dy >= 0 ? node.y + node.radius + LABEL_GAP : node.y - node.radius - LABEL_GAP - height;
      }

      return {
        nodeId: node.id,
        lines,
        x: clamp(x, GRAPH_BOUNDS.minX, GRAPH_BOUNDS.maxX - width),
        y: clamp(y, GRAPH_BOUNDS.minY, GRAPH_BOUNDS.maxY - height),
        width,
        height,
        lineHeight,
        fontSize,
        fontWeight,
        side,
      };
    });

    const pushOutward = (label: GraphLabelLayout, amount: number) => {
      if (label.side === "left") label.x -= amount;
      if (label.side === "right") label.x += amount;
      if (label.side === "top") label.y -= amount;
      if (label.side === "bottom") label.y += amount;
      label.x = clamp(label.x, GRAPH_BOUNDS.minX, GRAPH_BOUNDS.maxX - label.width);
      label.y = clamp(label.y, GRAPH_BOUNDS.minY, GRAPH_BOUNDS.maxY - label.height);
    };

    for (let pass = 0; pass < 12; pass += 1) {
      for (let i = 0; i < layouts.length; i += 1) {
        const current = layouts[i];

        for (let j = 0; j < layouts.length; j += 1) {
          if (i === j) continue;
          const other = layouts[j];
          if (!boxesOverlap(current, other)) continue;

          const overlapX = Math.min(current.x + current.width, other.x + other.width) - Math.max(current.x, other.x);
          const overlapY = Math.min(current.y + current.height, other.y + other.height) - Math.max(current.y, other.y);

          if (current.side === "left" || current.side === "right") {
            current.y += current.y <= other.y ? -(overlapY / 2 + LABEL_MARGIN) : overlapY / 2 + LABEL_MARGIN;
            pushOutward(current, overlapX / 2 + 8);
          } else {
            current.x += current.x <= other.x ? -(overlapX / 2 + LABEL_MARGIN) : overlapX / 2 + LABEL_MARGIN;
            pushOutward(current, overlapY / 2 + 8);
          }

          current.x = clamp(current.x, GRAPH_BOUNDS.minX, GRAPH_BOUNDS.maxX - current.width);
          current.y = clamp(current.y, GRAPH_BOUNDS.minY, GRAPH_BOUNDS.maxY - current.height);
        }

        for (const node of nodes) {
          if (node.id === current.nodeId) continue;
          let safety = 0;
          while (circleOverlapsBox(node, current) && safety < 8) {
            pushOutward(current, 12);
            safety += 1;
          }
        }

        for (const edge of connectedEdges) {
          let safety = 0;
          while (segmentIntersectsRect(edge.x1, edge.y1, edge.x2, edge.y2, current) && safety < 8) {
            pushOutward(current, 10);
            safety += 1;
          }
        }
      }
    }

    return layouts;
  }, [nodes, edges]);

  const labelLayoutMap = useMemo(
    () => new Map(labelLayouts.map((layout) => [layout.nodeId, layout])),
    [labelLayouts]
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={searchMode === "system" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSearchMode("system");
            setSelectedCenter(null);
          }}
        >
          <Server className="w-4 h-4 mr-1" />
          Järjestelmähaku
        </Button>
        <Button
          variant={searchMode === "process" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSearchMode("process");
            setSelectedCenter(null);
          }}
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fitView}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
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
                  isCritical
                    ? "border-destructive/30 hover:border-destructive/60"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isCritical ? "bg-destructive/10" : "bg-primary/10"}`}>
                  <Server className={`w-5 h-5 ${isCritical ? "text-destructive" : "text-primary"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{sys}</p>
                  <p className="text-xs text-muted-foreground">
                    {details.length} prosessi(a) · {taskCount} tehtävä(ä)
                  </p>
                </div>
                {isCritical && (
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    Kriittinen
                  </Badge>
                )}
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
              <p className="text-xs mt-1">
                {searchMode === "system"
                  ? "Lisää järjestelmätageja prosessiaskeleisiin editorissa."
                  : "Organisaation prosesseilla ei ole järjestelmäkytköksiä."}
              </p>
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
            style={{ height: "600px" }}
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
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {edges.map((edge, i) => {
                  const src = getNodeById(edge.source);
                  const tgt = getNodeById(edge.target);
                  if (!src || !tgt) return null;

                  const isHovered =
                    hoveredEdge?.source === edge.source && hoveredEdge?.target === edge.target;
                  const isNodeHovered =
                    hoveredNode?.id === edge.source || hoveredNode?.id === edge.target;
                  const isCriticalEdge =
                    searchMode === "system" &&
                    totalTaskCount > 5 &&
                    edge.source.startsWith("sys-");

                  return (
                    <line
                      key={i}
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={
                        isHovered || isNodeHovered
                          ? "hsl(var(--primary))"
                          : isCriticalEdge
                          ? "hsl(0, 70%, 55%)"
                          : "hsl(var(--muted-foreground) / 0.3)"
                      }
                      strokeWidth={
                        isHovered || isNodeHovered
                          ? 3
                          : isCriticalEdge
                          ? 2.5
                          : 1.5
                      }
                      strokeOpacity={isHovered || isNodeHovered ? 1 : 0.6}
                      className="transition-all duration-200"
                      onMouseEnter={() => setHoveredEdge(edge)}
                      onMouseLeave={() => setHoveredEdge(null)}
                      style={{ cursor: "pointer", pointerEvents: "stroke" }}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const isHovered = hoveredNode?.id === node.id;
                  const isEdgeConnected =
                    hoveredEdge &&
                    (hoveredEdge.source === node.id || hoveredEdge.target === node.id);
                  const labelLayout = labelLayoutMap.get(node.id);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => {
                        if (node.type === "process" && node.projectId) {
                          navigate(`/presentation/${node.projectId}?org=${orgId}`);
                        } else if (node.type === "task" && node.projectId) {
                          navigate(`/presentation/${node.projectId}?org=${orgId}`);
                        }
                      }}
                      style={{
                        cursor:
                          node.type === "process" || node.type === "task"
                            ? "pointer"
                            : "default",
                      }}
                    >
                      {/* Glow */}
                      {(isHovered || isEdgeConnected) && (
                        <circle
                          r={node.radius + 6}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={2}
                          strokeOpacity={0.4}
                          className="animate-pulse"
                        />
                      )}
                      {/* Node circle */}
                      <circle
                        r={node.radius}
                        fill={node.color}
                        fillOpacity={node.type === "task" ? 0.15 : 0.2}
                        stroke={node.color}
                        strokeWidth={isHovered || isEdgeConnected ? 2.5 : 1.5}
                      />
                      {/* Icon for system */}
                      {node.type === "system" && (
                        <>
                          <rect
                            x={-8}
                            y={-6}
                            width={16}
                            height={12}
                            rx={2}
                            fill="none"
                            stroke={node.color}
                            strokeWidth={1.5}
                          />
                          <line x1={-8} y1={-2} x2={8} y2={-2} stroke={node.color} strokeWidth={1} />
                        </>
                      )}
                      {/* Icon for process */}
                      {node.type === "process" && (
                        <polygon
                          points="-6,-8 6,-8 10,0 6,8 -6,8 -10,0"
                          fill="none"
                          stroke={node.color}
                          strokeWidth={1.5}
                        />
                      )}
                      {/* Dot for task */}
                      {node.type === "task" && (
                        <circle r={3} fill={node.color} />
                      )}
                      {/* Label */}
                      {labelLayout && (
                        <g
                          transform={`translate(${labelLayout.x - node.x}, ${labelLayout.y - node.y})`}
                          pointerEvents="none"
                        >
                          <rect
                            x={0}
                            y={0}
                            width={labelLayout.width}
                            height={labelLayout.height}
                            rx={8}
                            fill="hsl(var(--card))"
                            fillOpacity={0.96}
                            stroke="hsl(var(--border))"
                            strokeWidth={1}
                          />
                          <text
                            x={LABEL_PADDING_X}
                            y={LABEL_PADDING_Y + labelLayout.fontSize}
                            fill="hsl(var(--foreground))"
                            fontSize={labelLayout.fontSize}
                            fontWeight={labelLayout.fontWeight}
                          >
                            {labelLayout.lines.map((line, li) => (
                              <tspan key={li} x={LABEL_PADDING_X} y={LABEL_PADDING_Y + labelLayout.fontSize + li * labelLayout.lineHeight}>
                                {line}
                              </tspan>
                            ))}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Tooltip */}
            {(hoveredEdge?.taskName || hoveredNode) && (
              <div
                className="absolute pointer-events-none bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm z-50 max-w-[300px]"
                style={{
                  left: Math.min(mousePos.x - (containerRef.current?.getBoundingClientRect().left || 0) + 12, (containerRef.current?.clientWidth || 400) - 310),
                  top: mousePos.y - (containerRef.current?.getBoundingClientRect().top || 0) - 40,
                }}
              >
                {hoveredEdge?.taskName && (
                  <>
                    <p className="font-medium break-words">{hoveredEdge.taskName}</p>
                    {hoveredEdge.performer && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Rooli: {hoveredEdge.performer}
                      </p>
                    )}
                  </>
                )}
                {hoveredNode && !hoveredEdge?.taskName && (
                  <>
                    <p className="font-medium break-words">{hoveredNode.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{hoveredNode.type}</p>
                    {hoveredNode.performer && (
                      <p className="text-xs text-muted-foreground">
                        Rooli: {hoveredNode.performer}
                      </p>
                    )}
                    {hoveredNode.type === "process" && (
                      <p className="text-xs text-primary mt-1">Klikkaa avataksesi →</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-card/90 border rounded-lg px-3 py-2 text-xs space-y-1.5">
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
