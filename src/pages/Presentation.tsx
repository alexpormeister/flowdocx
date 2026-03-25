import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getProject } from "@/lib/api";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { ArrowLeft, Mail, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";

export default function Presentation() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (!containerRef.current || !project) return;

    const viewer = new NavigatedViewer({ container: containerRef.current });
    viewerRef.current = viewer;

    viewer.importXML(project.bpmn_xml).then(() => {
      const canvas = viewer.get("canvas") as any;
      canvas.zoom("fit-viewport");
    });

    const eventBus = viewer.get("eventBus") as any;
    eventBus.on("element.click", (e: any) => {
      const el = e.element;
      if (el.type === "bpmn:Process" || el.type === "bpmn:Collaboration") {
        setSelectedElement(null);
        return;
      }
      const bo = el.businessObject;
      setSelectedElement({
        id: el.id,
        type: el.type,
        name: bo?.name || el.id,
        documentation: bo?.documentation?.[0]?.text || "",
      });
    });

    return () => viewer.destroy();
  }, [project]);

  const handleBack = () => {
    const orgId = searchParams.get("org") || project?.organization_id;
    if (orgId) navigate(`/dashboard?org=${orgId}`);
    else navigate("/dashboard");
  };

  if (authLoading || !user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Info Bar */}
      <header className="border-b bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold truncate">{project.name}</h1>
              <StatusBadge status={project.status || "draft"} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
            {project.owner_name && (
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {project.owner_name}
              </span>
            )}
            {project.owner_email && (
              <a
                href={`mailto:${project.owner_email}`}
                className="flex items-center gap-1.5 hover:text-accent transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {project.owner_email}
              </a>
            )}
          </div>
        </div>
        {project.description && (
          <p className="text-xs text-muted-foreground mt-1 ml-11 truncate">{project.description}</p>
        )}
      </header>

      {/* Canvas */}
      <div className="flex flex-1 overflow-hidden relative">
        <div ref={containerRef} className="w-full h-full bg-canvas" />

        {/* Element Detail Panel */}
        {selectedElement && (
          <div className="absolute right-4 top-4 w-80 bg-card border rounded-lg shadow-lg z-10 animate-in slide-in-from-right-5 duration-200">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="text-sm font-semibold truncate">{selectedElement.name}</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedElement(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</span>
                <p className="text-xs mt-0.5">{selectedElement.type.replace("bpmn:", "")}</p>
              </div>
              {selectedElement.documentation && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Documentation</span>
                  <p className="text-xs mt-0.5 whitespace-pre-wrap">{selectedElement.documentation}</p>
                </div>
              )}
              {!selectedElement.documentation && (
                <p className="text-xs text-muted-foreground italic">No documentation available for this element.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
