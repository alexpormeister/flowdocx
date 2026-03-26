import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { ArrowLeft, Mail, User, X, ExternalLink, FolderOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";

async function fetchPresentationData(token: string) {
  const { data, error } = await supabase.functions.invoke("get-presentation-data", {
    body: { token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as {
    token: any;
    organization: any;
    projects: any[];
    folders: any[];
    elementLinks: any[];
  };
}

export default function PublicPresentation() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get("project") || null
  );
  const [sidebarOpen, setSidebarOpen] = useState(!searchParams.get("project"));

  const { data: presentationData, isLoading, error: loadError } = useQuery({
    queryKey: ["presentation-data", token],
    queryFn: () => fetchPresentationData(token!),
    enabled: !!token,
  });

  const projects = presentationData?.projects || [];
  const folders = presentationData?.folders || [];
  const elementLinks = presentationData?.elementLinks || [];
  const org = presentationData?.organization;

  // Check if user is org member
  const { data: membership } = useQuery({
    queryKey: ["org-membership-public", org?.id],
    queryFn: async () => {
      if (!user || !org?.id) return null;
      const { data } = await supabase
        .from("organization_members")
        .select("id, role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!org?.id,
  });

  const isOrgMember = !!membership;

  const selectedProject = useMemo(
    () => projects.find((p: any) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedStep = useMemo(() => {
    if (!selectedElement || !selectedProject) return null;
    const steps = selectedProject.process_steps || [];
    return steps.find((s: any) => s.id === selectedElement.id) || null;
  }, [selectedElement, selectedProject]);

  const selectedLink = useMemo(() => {
    if (!selectedElement || !selectedProjectId) return null;
    return elementLinks.find(
      (l: any) => l.element_id === selectedElement.id && l.project_id === selectedProjectId
    ) || null;
  }, [selectedElement, elementLinks, selectedProjectId]);

  const linkedProject = useMemo(() => {
    if (!selectedLink) return null;
    return projects.find((p: any) => p.id === selectedLink.linked_project_id) || null;
  }, [selectedLink, projects]);

  // Build folder tree
  const folderTree = useMemo(() => {
    const rootFolders = folders.filter((f: any) => !f.parent_id);
    const getChildren = (parentId: string): any[] =>
      folders.filter((f: any) => f.parent_id === parentId);
    const getProjectsInFolder = (folderId: string) =>
      projects.filter((p: any) => p.folder_id === folderId);
    return { rootFolders, getChildren, getProjectsInFolder };
  }, [folders, projects]);

  useEffect(() => {
    if (!containerRef.current || !selectedProject) return;
    const viewer = new NavigatedViewer({ container: containerRef.current });
    viewerRef.current = viewer;

    viewer.importXML(selectedProject.bpmn_xml).then(() => {
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
  }, [selectedProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (loadError || !presentationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">Invalid or expired link</p>
          <p className="text-sm text-muted-foreground">This presentation link is no longer active.</p>
        </div>
      </div>
    );
  }

  const renderFolderItem = (folder: any, depth = 0) => {
    const children = folderTree.getChildren(folder.id);
    const folderProjects = folderTree.getProjectsInFolder(folder.id);

    return (
      <div key={folder.id}>
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/50 rounded cursor-default"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate font-medium text-xs">{folder.name}</span>
        </div>
        {folderProjects.map((p: any) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProjectId(p.id);
              setSelectedElement(null);
              if (window.innerWidth < 768) setSidebarOpen(false);
            }}
            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50 rounded transition-colors ${
              selectedProjectId === p.id ? "bg-accent text-accent-foreground" : ""
            }`}
            style={{ paddingLeft: `${28 + depth * 16}px` }}
          >
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
        {children.map((c: any) => renderFolderItem(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-72 border-r bg-card flex flex-col shrink-0">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold">{org?.name || "Presentation"}</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {presentationData.token.name} — Presentation Mode
            </p>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            {folderTree.rootFolders.map((f: any) => renderFolderItem(f))}
            {projects
              .filter((p: any) => !p.folder_id)
              .map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setSelectedElement(null);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50 rounded transition-colors ${
                    selectedProjectId === p.id ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
          </div>
          {isOrgMember && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> Back to Dashboard
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedProject ? (
          <>
            <header className="border-b bg-card px-4 py-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-base font-semibold truncate">{selectedProject.name}</h1>
                    <StatusBadge status={selectedProject.status || "draft"} />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                  {selectedProject.owner_name && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {selectedProject.owner_name}
                    </span>
                  )}
                  {selectedProject.owner_email && (
                    <a
                      href={`mailto:${selectedProject.owner_email}`}
                      className="flex items-center gap-1.5 hover:text-accent transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {selectedProject.owner_email}
                    </a>
                  )}
                </div>
              </div>
              {selectedProject.description && (
                <p className="text-xs text-muted-foreground mt-1 ml-11 truncate">
                  {selectedProject.description}
                </p>
              )}
            </header>

            <div className="flex flex-1 overflow-hidden relative">
              <div ref={containerRef} className="w-full h-full bg-canvas" />

              {selectedElement && (
                <div className="absolute right-4 top-4 w-80 bg-card border rounded-lg shadow-lg z-10 animate-in slide-in-from-right-5 duration-200">
                  <div className="flex items-center justify-between p-3 border-b">
                    <h3 className="text-sm font-semibold truncate">{selectedElement.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setSelectedElement(null)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Type
                      </span>
                      <p className="text-xs mt-0.5">{selectedElement.type.replace("bpmn:", "")}</p>
                    </div>

                    {selectedStep && (
                      <>
                        {selectedStep.performer && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Performer
                            </span>
                            <p className="text-xs mt-0.5">{selectedStep.performer}</p>
                          </div>
                        )}
                        {selectedStep.system?.length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Systems
                            </span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {selectedStep.system.map((s: string) => (
                                <span
                                  key={s}
                                  className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[10px]"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedStep.decision && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Decision
                            </span>
                            <p className="text-xs mt-0.5">{selectedStep.decision}</p>
                          </div>
                        )}
                      </>
                    )}

                    {selectedElement.documentation && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Documentation
                        </span>
                        <p className="text-xs mt-0.5 whitespace-pre-wrap">
                          {selectedElement.documentation}
                        </p>
                      </div>
                    )}

                    {!selectedElement.documentation && !selectedStep && (
                      <p className="text-xs text-muted-foreground italic">
                        No documentation available.
                      </p>
                    )}

                    {linkedProject && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        onClick={() => {
                          setSelectedProjectId(linkedProject.id);
                          setSelectedElement(null);
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open: {linkedProject.name}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">Select a process to view</p>
              {!sidebarOpen && (
                <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)}>
                  Show processes
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
