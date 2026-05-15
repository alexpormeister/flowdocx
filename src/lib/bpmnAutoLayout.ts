/**
 * Custom BPMN auto-layout that preserves pools and lanes.
 * Repositions flow nodes (tasks, events, gateways) within their parent
 * by topological column from sources, then re-routes sequence flows.
 */
export function reorganizeDiagram(modeler: any) {
  const elementRegistry = modeler.get("elementRegistry");
  const modeling = modeler.get("modeling");

  const COL_W = 160;
  const ROW_H = 100;
  const PADDING_X = 60;

  // All flow nodes (tasks, events, gateways, subprocesses)
  const flowNodes: any[] = elementRegistry.filter((el: any) => {
    if (el.waypoints) return false; // skip connections
    if (!el.parent) return false;
    const bo = el.businessObject;
    if (!bo || !bo.$instanceOf) return false;
    try {
      return bo.$instanceOf("bpmn:FlowNode");
    } catch {
      return false;
    }
  });

  // All sequence flows
  const flows: any[] = elementRegistry.filter(
    (el: any) => el.type === "bpmn:SequenceFlow" && el.source && el.target,
  );

  // Build adjacency
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  flowNodes.forEach((n) => {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  });
  flows.forEach((f) => {
    if (outgoing.has(f.source.id)) outgoing.get(f.source.id)!.push(f.target.id);
    if (incoming.has(f.target.id)) incoming.get(f.target.id)!.push(f.source.id);
  });

  // Compute column = longest path from any source (no incoming)
  const col = new Map<string, number>();
  const visiting = new Set<string>();
  function getCol(id: string): number {
    if (col.has(id)) return col.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const ins = incoming.get(id) || [];
    const c = ins.length === 0 ? 0 : Math.max(...ins.map((s) => getCol(s) + 1));
    visiting.delete(id);
    col.set(id, c);
    return c;
  }
  flowNodes.forEach((n) => getCol(n.id));

  // Group nodes by parent (lane / participant / process)
  const byParent = new Map<string, any[]>();
  flowNodes.forEach((n) => {
    const pid = n.parent.id;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(n);
  });

  // Position nodes inside each parent
  byParent.forEach((nodes, parentId) => {
    const parent = elementRegistry.get(parentId);
    if (!parent) return;

    const baseX = parent.x + PADDING_X;
    const centerY = parent.y + parent.height / 2;

    // Group by column index
    const byCol = new Map<number, any[]>();
    nodes.forEach((n) => {
      const c = col.get(n.id) || 0;
      if (!byCol.has(c)) byCol.set(c, []);
      byCol.get(c)!.push(n);
    });

    // Sort nodes within a column by current y for stability
    byCol.forEach((colNodes, c) => {
      colNodes.sort((a, b) => a.y - b.y);
      const colCenterX = baseX + c * COL_W + 50;
      const total = colNodes.length;
      colNodes.forEach((node, i) => {
        const targetCenterY = centerY + (i - (total - 1) / 2) * ROW_H;
        const dx = Math.round(colCenterX - (node.x + node.width / 2));
        const dy = Math.round(targetCenterY - (node.y + node.height / 2));
        if (dx !== 0 || dy !== 0) {
          try {
            modeling.moveShape(node, { x: dx, y: dy });
          } catch (err) {
            console.warn("moveShape failed", node.id, err);
          }
        }
      });
    });
  });

  // Re-route all sequence flows
  flows.forEach((f) => {
    try {
      modeling.layoutConnection(f);
    } catch {
      /* ignore */
    }
  });
}
