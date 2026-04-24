import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  getOrganizations,
  getOrganizationTags,
  getOrganizationPositions,
  getOrganizationMembers,
  getOrganizationGroupsWithPositions,
  getCurrentUserMembership,
} from "@/lib/organizationApi";
import { getProjects, getFolders } from "@/lib/api";
import { getAllSystemTagGroups } from "@/lib/presentationApi";
import { exportOrgZip } from "@/lib/orgExportZip";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AppWindow,
  BarChart3,
  Monitor,
  Users,
  GitBranch,
  LayoutGrid,
  Heart,
  Download,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import RoleInventory from "@/components/applications/RoleInventory";
import SystemDependencyGraph from "@/components/applications/SystemDependencyGraph";
import SystemsInventory from "@/components/applications/SystemsInventory";
import GlobalSystemManager from "@/components/applications/GlobalSystemManager";
import ProcessReviewQueue from "@/components/applications/ProcessReviewQueue";
import CapabilityMapPanel from "@/components/applications/CapabilityMapPanel";
import CustomerLifecyclePanel from "@/components/applications/CustomerLifecyclePanel";
import AutomationProposalPanel from "@/components/applications/AutomationProposalPanel";
import { toast } from "sonner";
import { hexToContrastHslString, hexToHslString } from "@/lib/utils";

type ToolTab = "dashboard" | "systems" | "admin-panel" | "role-inventory" | "dependency-graph" | "capability-map" | "customer-lifecycle" | "automation-proposal";

const TOOLS: { id: ToolTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "dashboard", label: "Yleiskuva", icon: BarChart3, description: "Työkalujen koontinäkymä" },
  { id: "systems", label: "Järjestelmät", icon: Monitor, description: "Järjestelmät ja vaikutusanalyysi" },
  { id: "admin-panel", label: "Admin-paneeli", icon: ShieldCheck, description: "Massahallinta ja muutosehdotukset" },
  { id: "role-inventory", label: "Roolit", icon: Users, description: "RACI ja roolien kattavuus" },
  { id: "dependency-graph", label: "Riippuvuuskartta", icon: GitBranch, description: "Järjestelmien riippuvuudet" },
  { id: "capability-map", label: "Kyvykkyyskartta", icon: LayoutGrid, description: "Liiketoimintakyvykkyydet" },
  { id: "customer-lifecycle", label: "Asiakaspolku", icon: Heart, description: "Asiakaselinkaaren hallinta" },
  { id: "automation-proposal", label: "Automaatio", icon: Sparkles, description: "Automatisoitavat prosessivaiheet" },
];

export default function Applications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const initialTab = searchParams.get("tab") as ToolTab | null;
  const [activeTab, setActiveTab] = useState<ToolTab>(initialTab && TOOLS.some(t => t.id === initialTab) ? initialTab : "dashboard");
  const [exporting, setExporting] = useState(false);

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    enabled: !!user,
  });

  const selectedOrg = organizations.find((o) => o.id === orgId);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user && !!orgId,
  });

  const { data: systemTags = [] } = useQuery({
    queryKey: ["org-tags", orgId],
    queryFn: () => getOrganizationTags(orgId!),
    enabled: !!user && !!orgId,
  });

  const { data: membership } = useQuery({
    queryKey: ["org-membership", orgId],
    queryFn: () => getCurrentUserMembership(orgId!),
    enabled: !!user && !!orgId,
  });

  const canUseAdminPanel = membership?.role === "owner" || membership?.role === "admin";
  const visibleTools = useMemo(
    () => TOOLS.filter((tool) => tool.id !== "admin-panel" || canUseAdminPanel),
    [canUseAdminPanel],
  );

  const orgProjects = useMemo(
    () => projects.filter((project) => project.organization_id === orgId && !project.is_template),
    [projects, orgId],
  );

  const processStepCount = useMemo(
    () => orgProjects.reduce((sum, project) => sum + ((project.process_steps as any[]) || []).length, 0),
    [orgProjects],
  );

  const orgThemeStyle = useMemo(() => {
    if (!selectedOrg) return undefined;
    const primary = selectedOrg.primary_color || "#0f172a";
    const accent = selectedOrg.accent_color || "#0891b2";
    const primaryHsl = hexToHslString(primary);
    const accentHsl = hexToHslString(accent);
    if (!primaryHsl && !accentHsl) return undefined;

    return {
      ...(primaryHsl
        ? {
            "--primary": primaryHsl,
            "--ring": primaryHsl,
            "--primary-foreground": hexToContrastHslString(primary),
            "--sidebar-primary": primaryHsl,
            "--sidebar-ring": primaryHsl,
          }
        : {}),
      ...(accentHsl
        ? {
            "--accent": accentHsl,
            "--accent-foreground": hexToContrastHslString(accent),
            "--tag": accentHsl,
            "--tag-foreground": hexToContrastHslString(accent),
            "--sidebar-accent": accentHsl,
          }
        : {}),
    } as React.CSSProperties;
  }, [selectedOrg]);

  const handleExportOrg = async () => {
    if (!orgId || !selectedOrg) return;
    setExporting(true);
    try {
      const [projects, folders, tags, positions, members, groups] = await Promise.all([
        getProjects(),
        getFolders(),
        getOrganizationTags(orgId),
        getOrganizationPositions(orgId),
        getOrganizationMembers(orgId),
        getOrganizationGroupsWithPositions(orgId),
      ]);

      // Resolve position names for groups
      const positionMap = new Map(positions.map((p) => [p.id, p.name]));

      await exportOrgZip({
        orgId,
        orgName: selectedOrg.name,
        projects,
        folders,
        positions,
        members,
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          positionNames: g.position_ids.map((pid) => positionMap.get(pid) || "—"),
        })),
        systemTags: tags.map((t: any) => ({
          tag_name: t.tag_name,
          description: t.description,
          link_url: t.link_url,
          admin_position_id: t.admin_position_id,
        })),
      });
      toast.success("Export valmis!");
    } catch (err) {
      console.error(err);
      toast.error("Export epäonnistui");
    } finally {
      setExporting(false);
    }
  };

  if (!orgId || !selectedOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={orgThemeStyle} data-org-theme>
      <header className="h-14 border-b flex items-center gap-2 sm:gap-3 px-3 md:px-6 bg-primary text-primary-foreground shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard?org=${orgId}`)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <AppWindow className="w-5 h-5 text-accent shrink-0 hidden sm:block" />
        <h1 className="text-sm sm:text-lg font-semibold truncate flex-1">{selectedOrg.name} — Sovellukset ja työkalut</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
          onClick={handleExportOrg}
          disabled={exporting}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{exporting ? "Viedään..." : "Vie organisaatio"}</span>
        </Button>
      </header>

      <div className="flex-1 overflow-hidden bg-muted/20 lg:flex">
        <aside className="border-b bg-card/80 p-3 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-4">
          <div className="mb-3 h-1.5 rounded-full bg-accent" />
          <div className="mb-3 hidden lg:block">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Työkalukeskus</p>
            <p className="mt-1 text-sm text-muted-foreground">Valitse näkymä tai aloita yleiskuvasta.</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {visibleTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTab === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                className={`flex min-w-[150px] items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors lg:min-w-0 ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-primary"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">{tool.label}</span>
                  <span className={`hidden text-xs lg:block lg:truncate ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{tool.description}</span>
                </span>
                <ChevronRight className="hidden h-4 w-4 shrink-0 lg:block" />
              </button>
            );
          })}
          </nav>
        </aside>

      <div className="flex-1 overflow-auto border-t-4 border-accent lg:border-t-0">
        {activeTab === "dashboard" && (
          <ApplicationsDashboard
            tools={TOOLS.filter((tool) => tool.id !== "dashboard")}
            setActiveTab={setActiveTab}
            projectCount={orgProjects.length}
            stepCount={processStepCount}
            systemCount={systemTags.length}
          />
        )}
        {activeTab === "systems" && <SystemsInventory orgId={orgId} />}
        {activeTab === "admin-panel" && canUseAdminPanel && <AdminPanel orgId={orgId} />}
        {activeTab === "role-inventory" && <RoleInventory orgId={orgId} />}
        {activeTab === "dependency-graph" && <SystemDependencyGraph orgId={orgId} />}
        {activeTab === "capability-map" && <CapabilityMapPanel orgId={orgId} />}
        {activeTab === "customer-lifecycle" && <CustomerLifecyclePanel orgId={orgId} />}
        {activeTab === "automation-proposal" && <AutomationProposalPanel orgId={orgId} />}
      </div>
      </div>
    </div>
  );
}

function AdminPanel({ orgId }: { orgId: string }) {
  const [section, setSection] = useState<"systems" | "changes">("systems");

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Ylläpitäjän työkalut
          </div>
          <h2 className="mt-1 text-2xl font-bold">Admin-paneeli</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Hallitse järjestelmien massapäivityksiä ja prosessien muutosehdotuksia samasta näkymästä.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 rounded-lg border bg-card p-1 sm:w-auto">
          <Button variant={section === "systems" ? "default" : "ghost"} onClick={() => setSection("systems")}>Massahallinta</Button>
          <Button variant={section === "changes" ? "default" : "ghost"} onClick={() => setSection("changes")}>Muutosehdotukset</Button>
        </div>
      </div>
      {section === "systems" ? <GlobalSystemManager orgId={orgId} /> : <ProcessReviewQueue orgId={orgId} />}
    </div>
  );
}

function ApplicationsDashboard({
  tools,
  setActiveTab,
  projectCount,
  stepCount,
  systemCount,
}: {
  tools: typeof TOOLS;
  setActiveTab: (tab: ToolTab) => void;
  projectCount: number;
  stepCount: number;
  systemCount: number;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <section className="rounded-lg border bg-primary p-5 text-primary-foreground md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Sovellukset ja työkalut</p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">Organisaation prosessien ohjauskeskus</h2>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
              Yleiskuva kokoaa tärkeimmät työkalut, järjestelmät ja prosessidatan yhteen selkeään näkymään.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <DashboardStat label="Prosessit" value={projectCount} />
            <DashboardStat label="Vaiheet" value={stepCount} />
            <DashboardStat label="Järjestelmät" value={systemCount} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id)}
              className="group relative overflow-hidden rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-accent" />
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{tool.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-primary-foreground/75">{label}</p>
    </div>
  );
}
