import type { OrganizationPosition, OrganizationMember, OrganizationGroup } from "@/lib/organizationApi";

interface NodeLayout {
  position: OrganizationPosition;
  members: OrganizationMember[];
  x: number;
  y: number;
  width: number;
  height: number;
  children: NodeLayout[];
}

const CARD_MIN_W = 200;
const CARD_PAD_X = 20;
const CARD_PAD_Y = 16;
const H_GAP = 28;
const V_GAP = 60;
const FONT = "Inter, system-ui, -apple-system, sans-serif";

function measureText(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}

function buildLayoutTree(
  ctx: CanvasRenderingContext2D,
  positions: OrganizationPosition[],
  members: OrganizationMember[],
  parentId: string | null
): NodeLayout[] {
  const children = positions
    .filter(p => p.parent_position_id === parentId)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  return children.map(pos => {
    const posMembers = members.filter(m => m.position_id === pos.id);
    const childNodes = buildLayoutTree(ctx, positions, members, pos.id);

    // Calculate card dimensions
    const titleW = measureText(ctx, pos.name, `bold 14px ${FONT}`) + CARD_PAD_X * 2;
    let memberMaxW = 0;
    for (const m of posMembers) {
      const label = m.title ? `${m.email} • ${m.title}` : m.email;
      const w = measureText(ctx, label, `11px ${FONT}`);
      if (w > memberMaxW) memberMaxW = w;
    }
    memberMaxW += CARD_PAD_X * 2;

    const cardW = Math.max(CARD_MIN_W, titleW, memberMaxW);
    const memberH = posMembers.length > 0 ? posMembers.length * 18 + 12 : 0;
    const cardH = CARD_PAD_Y + 20 + memberH + CARD_PAD_Y;

    return {
      position: pos,
      members: posMembers,
      x: 0,
      y: 0,
      width: cardW,
      height: cardH,
      children: childNodes,
    };
  });
}

function getSubtreeWidth(node: NodeLayout): number {
  if (node.children.length === 0) return node.width;
  const childrenWidth = node.children.reduce((sum, c) => sum + getSubtreeWidth(c), 0) + H_GAP * (node.children.length - 1);
  return Math.max(node.width, childrenWidth);
}

function layoutTree(nodes: NodeLayout[], startX: number, startY: number): void {
  let currentX = startX;
  for (const node of nodes) {
    const subtreeW = getSubtreeWidth(node);
    node.x = currentX + (subtreeW - node.width) / 2;
    node.y = startY;

    if (node.children.length > 0) {
      layoutTree(node.children, currentX, startY + node.height + V_GAP);
    }
    currentX += subtreeW + H_GAP;
  }
}

function getTreeBounds(nodes: NodeLayout[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
    if (n.children.length > 0) {
      const cb = getTreeBounds(n.children);
      minX = Math.min(minX, cb.minX);
      minY = Math.min(minY, cb.minY);
      maxX = Math.max(maxX, cb.maxX);
      maxY = Math.max(maxY, cb.maxY);
    }
  }
  return { minX, minY, maxX, maxY };
}

function drawConnections(ctx: CanvasRenderingContext2D, node: NodeLayout, accentColor: string): void {
  if (node.children.length === 0) return;

  const parentCx = node.x + node.width / 2;
  const parentBottom = node.y + node.height;
  const midY = parentBottom + V_GAP / 2;

  ctx.strokeStyle = accentColor + "60";
  ctx.lineWidth = 2;

  for (const child of node.children) {
    const childCx = child.x + child.width / 2;
    const childTop = child.y;

    ctx.beginPath();
    ctx.moveTo(parentCx, parentBottom);
    ctx.lineTo(parentCx, midY);
    ctx.lineTo(childCx, midY);
    ctx.lineTo(childCx, childTop);
    ctx.stroke();

    drawConnections(ctx, child, accentColor);
  }
}

function drawNode(ctx: CanvasRenderingContext2D, node: NodeLayout, primaryColor: string, accentColor: string): void {
  const { x, y, width, height, position, members } = node;
  const r = 10;

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.10)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Card background
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.fill();
  ctx.restore();

  // Left accent stripe
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(x, y, 4, height, [r, 0, 0, r]);
  ctx.fill();

  // Border
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.stroke();

  // Position name
  ctx.fillStyle = primaryColor;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(position.name, x + CARD_PAD_X, y + CARD_PAD_Y + 14);

  // Members
  if (members.length > 0) {
    let my = y + CARD_PAD_Y + 32;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `11px ${FONT}`;
    for (const m of members) {
      const label = m.title ? `${m.email} • ${m.title}` : m.email;
      ctx.fillText(label, x + CARD_PAD_X, my);
      my += 18;
    }
  }

  // Draw children
  for (const child of node.children) {
    drawNode(ctx, child, primaryColor, accentColor);
  }
}

export function exportStructurePng(
  orgName: string,
  positions: OrganizationPosition[],
  members: OrganizationMember[],
  primaryColor = "#0f172a",
  accentColor = "#0891b2"
): void {
  const dpr = 2;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext("2d")!;

  const tree = buildLayoutTree(tempCtx, positions, members, null);
  if (tree.length === 0) return;

  layoutTree(tree, 80, 100);

  const bounds = getTreeBounds(tree);
  const MARGIN = 80;
  const HEADER_H = 80;
  const canvasW = (bounds.maxX - bounds.minX + MARGIN * 2);
  const canvasH = (bounds.maxY - bounds.minY + MARGIN * 2 + HEADER_H);

  // Offset nodes so they start at MARGIN
  const offsetX = MARGIN - bounds.minX;
  const offsetY = MARGIN + HEADER_H - bounds.minY;
  function offsetNodes(nodes: NodeLayout[]) {
    for (const n of nodes) {
      n.x += offsetX;
      n.y += offsetY;
      offsetNodes(n.children);
    }
  }
  offsetNodes(tree);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  bgGrad.addColorStop(0, "#f8fafc");
  bgGrad.addColorStop(1, "#f1f5f9");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Subtle dot pattern
  ctx.fillStyle = "rgba(148,163,184,0.08)";
  for (let px = 0; px < canvasW; px += 20) {
    for (let py = 0; py < canvasH; py += 20) {
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Header
  ctx.fillStyle = primaryColor;
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(orgName, MARGIN, 50);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `13px ${FONT}`;
  ctx.fillText("Organization Structure", MARGIN, 72);

  // Accent line under header
  ctx.fillStyle = accentColor;
  ctx.fillRect(MARGIN, HEADER_H + 4, 60, 3);

  // Connections
  for (const node of tree) {
    drawConnections(ctx, node, accentColor);
  }

  // Nodes
  for (const node of tree) {
    drawNode(ctx, node, primaryColor, accentColor);
  }

  // Watermark
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("Nexus OS", canvasW - MARGIN, canvasH - 20);
  ctx.textAlign = "left";

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${orgName.replace(/\s+/g, "_")}_structure.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

export function exportGroupsPng(
  orgName: string,
  groups: { name: string; positionNames: string[] }[],
  primaryColor = "#0f172a",
  accentColor = "#0891b2"
): void {
  if (groups.length === 0) return;

  const dpr = 2;
  const MARGIN = 60;
  const HEADER_H = 80;
  const GROUP_CARD_W = 320;
  const COLS = Math.min(groups.length, 3);
  const GAP = 24;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext("2d")!;

  // Measure each group card height
  const cardHeights = groups.map(g => {
    const titleH = 36;
    const membersH = Math.max(g.positionNames.length, 1) * 22 + 16;
    return titleH + membersH + 24;
  });

  // Arrange in columns
  const rows = Math.ceil(groups.length / COLS);
  let maxColH = 0;
  for (let r = 0; r < rows; r++) {
    let rowH = 0;
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (idx < cardHeights.length) rowH = Math.max(rowH, cardHeights[idx]);
    }
    maxColH += rowH + GAP;
  }

  const canvasW = MARGIN * 2 + COLS * GROUP_CARD_W + (COLS - 1) * GAP;
  const canvasH = MARGIN * 2 + HEADER_H + maxColH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  bgGrad.addColorStop(0, "#f8fafc");
  bgGrad.addColorStop(1, "#f1f5f9");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Dot pattern
  ctx.fillStyle = "rgba(148,163,184,0.08)";
  for (let px = 0; px < canvasW; px += 20) {
    for (let py = 0; py < canvasH; py += 20) {
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Header
  ctx.fillStyle = primaryColor;
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(orgName, MARGIN, 50);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `13px ${FONT}`;
  ctx.fillText("Ryhmät / Groups", MARGIN, 72);

  ctx.fillStyle = accentColor;
  ctx.fillRect(MARGIN, HEADER_H + 4, 60, 3);

  // Draw group cards
  let curY = MARGIN + HEADER_H + 16;
  for (let r = 0; r < rows; r++) {
    let rowMaxH = 0;
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (idx >= groups.length) break;
      const g = groups[idx];
      const x = MARGIN + c * (GROUP_CARD_W + GAP);
      const h = cardHeights[idx];
      rowMaxH = Math.max(rowMaxH, h);

      // Card shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(x, curY, GROUP_CARD_W, h, 10);
      ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, curY, GROUP_CARD_W, h, 10);
      ctx.stroke();

      // Top accent bar
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(x, curY, GROUP_CARD_W, 4, [10, 10, 0, 0]);
      ctx.fill();

      // Group icon circle
      ctx.fillStyle = accentColor + "20";
      ctx.beginPath();
      ctx.arc(x + 28, curY + 28, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(g.name.charAt(0).toUpperCase(), x + 28, curY + 33);
      ctx.textAlign = "left";

      // Group name
      ctx.fillStyle = primaryColor;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(g.name, x + 52, curY + 33);

      // Position chips
      let chipY = curY + 52;
      if (g.positionNames.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = `italic 11px ${FONT}`;
        ctx.fillText("Ei positioita", x + 16, chipY + 4);
      } else {
        for (const pName of g.positionNames) {
          // Chip background
          ctx.fillStyle = accentColor + "15";
          const chipW = measureText(ctx, pName, `12px ${FONT}`) + 20;
          ctx.beginPath();
          ctx.roundRect(x + 16, chipY - 8, chipW, 20, 4);
          ctx.fill();

          // Chip text
          ctx.fillStyle = primaryColor;
          ctx.font = `12px ${FONT}`;
          ctx.fillText(pName, x + 26, chipY + 5);
          chipY += 22;
        }
      }
    }
    curY += rowMaxH + GAP;
  }

  // Watermark
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("Nexus OS", canvasW - MARGIN, canvasH - 20);
  ctx.textAlign = "left";

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${orgName.replace(/\s+/g, "_")}_groups.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}
