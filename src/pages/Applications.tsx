import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  getOrganizations,
  getOrganizationTags,
  getOrganizationPositions,
  getOrganizationMembers,
  getOrganizationGroupsWithPositions,
} from "@/lib/organizationApi";
import { getProjects, getFolders } from "@/lib/api";
import { getAllSystemTagGroups } from "@/lib/presentationApi";
import { exportOrgZip } from "@/lib/orgExportZip";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AppWindow,
  Monitor,
  Users,
  GitBranch,
  LayoutGrid,
  Heart,
  Download,
} from "lucide-react";
import RoleInventory from "@/components/applications/RoleInventory";
import SystemDependencyGraph from "@/components/applications/SystemDependencyGraph";
import SystemsInventory from "@/components/applications/SystemsInventory";
import CapabilityMapPanel from "@/components/applications/CapabilityMapPanel";
import CustomerLifecyclePanel from "@/components/applications/CustomerLifecyclePanel";
import { toast } from "sonner";

type ToolTab = "systems" | "role-inventory" | "dependency-graph" | "capability-map" | "customer-lifecycle";

const TOOLS: { id: ToolTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "systems", label: "Systems", icon: Monitor, description: "Manage systems & impact analysis" },
  { id: "role-inventory", label: "Role Inventory", icon: Users, description: "RACI & role coverage" },
  { id: "dependency-graph", label: "Dependency Graph", icon: GitBranch, description: "System dependency visualization" },
  { id: "capability-map", label: "Capability Map", icon: LayoutGrid, description: "Business capability overview" },
  { id: "customer-lifecycle", label: "Customer Lifecycle", icon: Heart, description: "Customer lifecycle management" },
];

export default function Applications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const [activeTab, setActiveTab] = useState<ToolTab>("systems");
  const [exporting, setExporting] = useState(false);

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    enabled: !!user,
  });

  const selectedOrg = organizations.find((o) => o.id === orgId);

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
          positionNames: g.positions?.map((p: any) => p.name) || [],
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b flex items-center gap-2 sm:gap-3 px-3 md:px-6 bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <AppWindow className="w-5 h-5 text-primary shrink-0 hidden sm:block" />
        <h1 className="text-sm sm:text-lg font-semibold truncate flex-1">{selectedOrg.name} — Applications & Tools</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={handleExportOrg}
          disabled={exporting}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export ORG"}</span>
        </Button>
      </header>

      <div className="border-b bg-card/50 px-4 md:px-6 shrink-0">
        <nav className="flex gap-1 max-w-7xl mx-auto -mb-px">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTab === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tool.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "systems" && <SystemsInventory orgId={orgId} />}
        {activeTab === "role-inventory" && <RoleInventory orgId={orgId} />}
        {activeTab === "dependency-graph" && <SystemDependencyGraph orgId={orgId} />}
        {activeTab === "capability-map" && <CapabilityMapPanel orgId={orgId} />}
        {activeTab === "customer-lifecycle" && <CustomerLifecyclePanel orgId={orgId} />}
      </div>
    </div>
  );
}
