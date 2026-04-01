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

export async function exportOrgZip(opts: ExportOptions) {
  const zip = new JSZip();
  const rootName = `EXPORT_${sanitize(opts.orgName)}`;
  const root = zip.folder(rootName)!;

  // Build folder lookup
  const folderNameMap = new Map<string | null, string>();
  folderNameMap.set(null, "Ei_kansiota");
  for (const f of opts.folders) {
    folderNameMap.set(f.id, sanitize(f.name));
  }

  // --- Prosessit ---
  const prosessitFolder = root.folder("Prosessit")!;
  const orgProjects = opts.projects.filter(
    (p) => p.organization_id === opts.orgId && !p.is_template
  );

  // Group by folder
  const projectsByFolder = new Map<string, Project[]>();
  for (const p of orgProjects) {
    const key = p.folder_id || "__none__";
    if (!projectsByFolder.has(key)) projectsByFolder.set(key, []);
    projectsByFolder.get(key)!.push(p);
  }

  for (const [folderId, projects] of projectsByFolder) {
    const folderDisplayName =
      folderId === "__none__"
        ? "Ei_kansiota"
        : folderNameMap.get(folderId) || "Tuntematon";
    const subFolder = prosessitFolder.folder(folderDisplayName)!;

    for (const project of projects) {
      const safeName = sanitize(project.name);

      // BPMN XML
      if (project.bpmn_xml) {
        subFolder.file(`${safeName}.bpmn`, project.bpmn_xml);
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
      subFolder.file(
        `${safeName}_metadata.json`,
        JSON.stringify(metadata, null, 2)
      );
    }
  }

  // --- Organisaatio ---
  const orgFolder = root.folder("Organisaatio")!;

  // Groups & roles
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
  orgFolder.file(
    "ryhmat_ja_roolit.json",
    JSON.stringify(groupsData, null, 2)
  );

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
  itFolder.file(
    "jarjestelmalistaus.json",
    JSON.stringify(systemsData, null, 2)
  );

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${sanitize(opts.orgName)}_org_${getDate()}.zip`;
  saveAs(blob, filename);
}
