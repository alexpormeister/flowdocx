import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getOrganizations } from "@/lib/organizationApi";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AppWindow,
  Monitor,
  Users,
  GitBranch,
  LayoutGrid,
} from "lucide-react";
import RoleInventory from "@/components/applications/RoleInventory";
import SystemDependencyGraph from "@/components/applications/SystemDependencyGraph";
import SystemsInventory from "@/components/applications/SystemsInventory";
import CapabilityMapPanel from "@/components/applications/CapabilityMapPanel";

type ToolTab = "systems" | "role-inventory" | "dependency-graph" | "capability-map";

const TOOLS: { id: ToolTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "systems", label: "Systems", icon: Monitor, description: "Manage systems & impact analysis" },
  { id: "role-inventory", label: "Role Inventory", icon: Users, description: "RACI & role coverage" },
  { id: "dependency-graph", label: "Dependency Graph", icon: GitBranch, description: "System dependency visualization" },
  { id: "capability-map", label: "Capability Map", icon: LayoutGrid, description: "Business capability overview" },
];

export default function Applications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const [activeTab, setActiveTab] = useState<ToolTab>("systems");

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    enabled: !!user,
  });

  const selectedOrg = organizations.find((o) => o.id === orgId);

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
        <h1 className="text-sm sm:text-lg font-semibold truncate">{selectedOrg.name} — Applications & Tools</h1>
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
      </div>
    </div>
  );
}
