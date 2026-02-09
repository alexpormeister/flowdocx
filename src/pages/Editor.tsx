import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getProject, updateProject } from "@/lib/api";
import { PanelRightClose, PanelRightOpen, Workflow, ArrowLeft, Save, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BpmnCanvas from "@/components/BpmnCanvas";
import ProcessDataPanel, { type ProcessStep } from "@/components/ProcessDataPanel";
import ExportMenu from "@/components/ExportMenu";
import { toast } from "sonner";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [modeler, setModeler] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id && !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof updateProject>[1]) => updateProject(id!, updates),
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      toast.error("Failed to save: " + (error as Error).message);
    },
  });

  // Load project data into state
  useEffect(() => {
    if (project) {
      setProjectName(project.name);
      setSteps(project.process_steps || []);
    }
  }, [project]);

  // Import BPMN XML when project and modeler are ready
  useEffect(() => {
    if (project && modeler) {
      modeler.importXML(project.bpmn_xml).then(() => {
        const canvas = modeler.get("canvas") as any;
        canvas.zoom("fit-viewport");
        lastSavedRef.current = project.bpmn_xml;
      });
    }
  }, [project, modeler]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(async () => {
    if (!modeler || !id) return;

    try {
      const { xml } = await modeler.saveXML({ format: true });
      
      // Only save if something changed
      if (xml !== lastSavedRef.current || hasUnsavedChanges) {
        setIsSaving(true);
        await updateMutation.mutateAsync({
          name: projectName,
          bpmn_xml: xml,
          process_steps: steps,
          system_tags: [...new Set(steps.flatMap(s => s.system))],
        });
        lastSavedRef.current = xml;
        setIsSaving(false);
      }
    } catch (err) {
      console.error("Auto-save failed:", err);
      setIsSaving(false);
    }
  }, [modeler, id, projectName, steps, hasUnsavedChanges, updateMutation]);

  // Debounced auto-save on changes
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (hasUnsavedChanges) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        triggerAutoSave();
      }, 2000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, triggerAutoSave]);

  // Listen for BPMN changes
  useEffect(() => {
    if (!modeler) return;

    const eventBus = modeler.get("eventBus") as any;
    const handleChange = () => {
      setHasUnsavedChanges(true);
    };

    eventBus.on("commandStack.changed", handleChange);
    eventBus.on("element.changed", handleChange);

    return () => {
      eventBus.off("commandStack.changed", handleChange);
      eventBus.off("element.changed", handleChange);
    };
  }, [modeler]);

  // Mark unsaved when steps change
  const handleStepsChange = (newSteps: ProcessStep[]) => {
    setSteps(newSteps);
    setHasUnsavedChanges(true);
  };

  const handleNameChange = (newName: string) => {
    setProjectName(newName);
    setHasUnsavedChanges(true);
  };

  const handleExport = useCallback(async (format: "png" | "svg") => {
    if (!modeler) return;

    try {
      if (format === "svg") {
        const { svg } = await modeler.saveSVG();
        downloadFile(svg, `${projectName}.svg`, "image/svg+xml");
      } else {
        const { svg } = await modeler.saveSVG();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new window.Image();
        const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx!.scale(2, 2);
          ctx!.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (blob) {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${projectName}.png`;
              a.click();
            }
          }, "image/png");
        };
        img.src = url;
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed");
    }
  }, [modeler, projectName]);

  const handleManualSave = () => {
    triggerAutoSave();
    toast.success("Project saved");
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Workflow className="w-5 h-5 text-accent" />
          <Input
            value={projectName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-8 w-48 text-sm font-medium border-none bg-transparent focus-visible:bg-background"
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Cloud className="w-3 h-3 animate-pulse" />
                Saving...
              </>
            ) : hasUnsavedChanges ? (
              <>
                <CloudOff className="w-3 h-3" />
                Unsaved
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-accent" />
                Saved
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleManualSave} className="h-8 text-xs gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
          <ExportMenu onExport={handleExport} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen(!panelOpen)}
            className="h-8 w-8 p-0"
          >
            {panelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <BpmnCanvas
            onModelerReady={setModeler}
            onSelectionChange={setSelectedElement}
          />
        </div>

        {/* Side Panel */}
        {panelOpen && (
          <div className="w-80 border-l bg-card flex flex-col shrink-0">
            <ProcessDataPanel
              steps={steps}
              onStepsChange={handleStepsChange}
              selectedElementId={selectedElement?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
