import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import type { Project, Folder } from "@/lib/api";
import type {
  OrganizationPosition,
  OrganizationMember,
  OrganizationGroup,
} from "@/lib/organizationApi";

interface ExportOptions {
  orgId: string;
  orgName: string;
  projects: Project[];
  folders: Folder[];
  positions: OrganizationPosition[];
  members: OrganizationMember[];
  groups: { id: string; name: string; positionNames: string[] }[];
  systemTags: {
    tag_name: string;
    description?: string | null;
    link_url?: string | null;
    admin_position_id?: string | null;
  }[];
}

function sanitize(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

function getDate() {
  return new Date().toISOString().slice(0, 10);
}

const LOGO_TEXT = "Nexus OS";
const FONT = "Inter, system-ui, -apple-system, sans-serif";

// Render a BPMN XML to a PNG blob using an offscreen bpmn-js canvas
async function renderBpmnToPng(bpmnXml: string): Promise<Blob | null> {
  try {
    const BpmnViewer = (await import("bpmn-js")).default;
    const container = document.createElement("div");
    container.style.width = "2400px";
    container.style.height = "1600px";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    const viewer = new BpmnViewer({ container });

    await new Promise<void>((resolve, reject) => {
      viewer.importXML(bpmnXml, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const canvas = viewer.get("canvas") as any;
    canvas.zoom("fit-viewport");

    // Get SVG from bpmn-js
    const { svg } = await viewer.saveSVG();
    viewer.destroy();
    document.body.removeChild(container);

    // Parse SVG to get dimensions
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = svgDoc.documentElement;
    const viewBox = svgEl.getAttribute("viewBox");
    let svgW = 1200, svgH = 800;
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      if (parts.length === 4) { svgW = parts[2]; svgH = parts[3]; }
    }

    // Render to canvas with logo
    const dpr = 2;
    const logoH = 40;
    const totalH = svgH + logoH;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = svgW * dpr;
    offCanvas.height = totalH * dpr;
    const ctx = offCanvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, svgW, totalH);

    // Draw the BPMN SVG
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    return new Promise<Blob | null>((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, svgW, svgH);
        URL.revokeObjectURL(url);

        // Draw Nexus OS logo text at bottom-left
        ctx.fillStyle = "#94a3b8";
        ctx.font = `bold 14px ${FONT}`;
        ctx.textAlign = "left";
        ctx.fillText(LOGO_TEXT, 16, totalH - 14);

        offCanvas.toBlob((blob) => resolve(blob), "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch (err) {
    console.error("Failed to render BPMN to PNG:", err);
    return null;
  }
}

// Build full folder path for a folder (recursive)
function buildFolderPath(folderId: string | null, folderMap: Map<string, Folder>): string {
  if (!folderId) return "Ei_kansiota";
  const folder = folderMap.get(folderId);
  if (!folder) return "Tuntematon";
  if (folder.parent_id) {
    return buildFolderPath(folder.parent_id, folderMap) + "/" + sanitize(folder.name);
  }
  return sanitize(folder.name);
}

export async function exportOrgZip(opts: ExportOptions) {
  const zip = new JSZip();
  const rootName = `EXPORT_${sanitize(opts.orgName)}`;
  const root = zip.folder(rootName)!;

  // Build folder lookup
  const folderMap = new Map<string, Folder>();
  for (const f of opts.folders) {
    folderMap.set(f.id, f);
  }

  // --- Prosessit ---
  const prosessitFolder = root.folder("Prosessit")!;
  const orgProjects = opts.projects.filter(
    (p) => p.organization_id === opts.orgId && !p.is_template
  );

  for (const project of orgProjects) {
    const folderPath = buildFolderPath(project.folder_id, folderMap);
    const subFolder = prosessitFolder.folder(folderPath)!;
    const safeName = sanitize(project.name);

    // BPMN XML
    if (project.bpmn_xml) {
      subFolder.file(`${safeName}.bpmn`, project.bpmn_xml);

      // PNG render of BPMN
      try {
        const pngBlob = await renderBpmnToPng(project.bpmn_xml);
        if (pngBlob) {
          subFolder.file(`${safeName}.png`, pngBlob);
        }
      } catch (err) {
        console.warn(`Could not render PNG for ${project.name}:`, err);
      }
    }

    // Metadata JSON
    const steps = (project.process_steps as any[]) || [];
    const systemsUsed = new Set<string>();
    const performers = new Set<string>();
    for (const step of steps) {
      for (const sys of step.system || []) systemsUsed.add(sys);
      if (step.performer) performers.add(step.performer);
    }
    for (const tag of project.system_tags || []) systemsUsed.add(tag);

    const metadata = {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      owner_name: project.owner_name,
      owner_email: project.owner_email,
      created_at: project.created_at,
      updated_at: project.updated_at,
      systems: Array.from(systemsUsed),
      performers: Array.from(performers),
      steps: steps.map((s: any) => ({
        step: s.step,
        task: s.task,
        performer: s.performer,
        systems: s.system || [],
        description: s.description || null,
      })),
    };
    subFolder.file(`${safeName}_metadata.json`, JSON.stringify(metadata, null, 2));
  }

  // --- Organisaatio ---
  const orgFolder = root.folder("Organisaatio")!;
  const groupsData = {
    groups: opts.groups.map((g) => ({
      name: g.name,
      positions: g.positionNames,
    })),
    positions: opts.positions.map((p) => ({
      name: p.name,
      parent: opts.positions.find((pp) => pp.id === p.parent_position_id)?.name || null,
      order_index: p.order_index,
    })),
    members: opts.members.map((m) => ({
      email: m.email,
      role: m.role,
      title: m.title,
      position: opts.positions.find((p) => p.id === m.position_id)?.name || null,
      accepted: !!m.accepted_at,
    })),
  };
  orgFolder.file("ryhmat_ja_roolit.json", JSON.stringify(groupsData, null, 2));

  // --- IT Järjestelmät ---
  const itFolder = root.folder("IT_Jarjestelmat")!;
  const systemsData = opts.systemTags.map((tag) => ({
    name: tag.tag_name,
    description: tag.description || null,
    link_url: tag.link_url || null,
    admin: tag.admin_position_id
      ? opts.positions.find((p) => p.id === tag.admin_position_id)?.name || null
      : null,
  }));
  itFolder.file("jarjestelmalistaus.json", JSON.stringify(systemsData, null, 2));

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${sanitize(opts.orgName)}_org_${getDate()}.zip`;
  saveAs(blob, filename);
}
