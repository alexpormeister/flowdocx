import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProject, getProjects, updateProject, type Project } from "@/lib/api";
import { getOrganizationTags, addOrganizationTag, getOrganizationPositions, getOrganizationGroupsWithPositions, getCurrentUserMembership } from "@/lib/organizationApi";
import { getElementLinks, createElementLink, deleteElementLink, type ElementLink } from "@/lib/elementLinksApi";
import { createProcessChangeDraft, createProcessChangeRequest, getProcessChangeRequests, submitProcessChangeDraft } from "@/lib/processChangeApi";
import { PanelRightClose, PanelRightOpen, Workflow, ArrowLeft, Save, Cloud, CloudOff, Presentation, RefreshCw, FileText, Link2, Unlink, GitPullRequestCreate, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import BpmnCanvas from "@/components/BpmnCanvas";
import ProcessDataPanel, { type ProcessStep, type GatewayPath } from "@/components/ProcessDataPanel";
import LaneNameEditor from "@/components/LaneNameEditor";
import ExportMenu from "@/components/ExportMenu";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [modeler, setModeler] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState(!isMobile);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [projectDescription, setProjectDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [status, setStatus] = useState("draft");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");
  const [linkingElement, setLinkingElement] = useState<string | null>(null);

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

  const { data: membership } = useQuery({
    queryKey: ["org-membership", project?.organization_id],
    queryFn: () => getCurrentUserMembership(project!.organization_id!),
    enabled: !!user && !!project?.organization_id,
  });

  const canEditProject = !project?.organization_id || membership?.role === "owner" || membership?.role === "admin" || membership?.role === "editor";
  const canSubmitChangeRequest = !!project?.organization_id && !!membership;

  const { data: orgChangeRequests = [] } = useQuery({
    queryKey: ["process-change-requests", project?.organization_id],
    queryFn: () => getProcessChangeRequests(project!.organization_id!),
    enabled: !!user && !!project?.organization_id,
  });

  const activeDraftRequest = useMemo(
    () => orgChangeRequests.find((request) => request.review_project_id === id && request.submitted_by === user?.id && request.status === "draft"),
    [orgChangeRequests, id, user?.id],
  );

  const isOwnChangeDraft = !!activeDraftRequest;
  const canEditCurrentProject = canEditProject || isOwnChangeDraft;
  const canCreateChangeDraft = !!project?.organization_id && membership?.role === "viewer" && !isOwnChangeDraft;

  // Org tags for system tag suggestions
  const { data: orgTags = [] } = useQuery({
    queryKey: ["org-tags", project?.organization_id],
    queryFn: () => getOrganizationTags(project!.organization_id!),
    enabled: !!project?.organization_id,
  });

  // Org positions for performer dropdown
  const { data: orgPositions = [] } = useQuery({
    queryKey: ["org-positions", project?.organization_id],
    queryFn: () => getOrganizationPositions(project!.organization_id!),
    enabled: !!project?.organization_id,
  });

  // Org groups for performer dropdown
  const { data: orgGroups = [] } = useQuery({
    queryKey: ["org-groups", project?.organization_id],
    queryFn: () => getOrganizationGroupsWithPositions(project!.organization_id!),
    enabled: !!project?.organization_id,
  });

  // Element links
  const { data: elementLinks = [] } = useQuery({
    queryKey: ["element-links", id],
    queryFn: () => getElementLinks(id!),
    enabled: !!id && !!user,
  });

  // Org projects for linking
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const orgProjects = useMemo(() => {
    if (!project?.organization_id) return [];
    return allProjects.filter(
      (p) => p.organization_id === project.organization_id && p.id !== id
    );
  }, [allProjects, project?.organization_id, id]);

  const availableTags = useMemo(() => {
    return orgTags.map((t) => t.tag_name);
  }, [orgTags]);

  // Combine position names and group names for performer dropdowns
  const availablePerformers = useMemo(() => {
    const positionNames = orgPositions.map(p => p.name);
    const groupNames = orgGroups.map(g => `[${g.name}]`);
    return [...groupNames, ...positionNames];
  }, [orgPositions, orgGroups]);

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

  const linkMutation = useMutation({
    mutationFn: ({ elementId, linkedProjectId }: { elementId: string; linkedProjectId: string }) =>
      createElementLink(id!, elementId, linkedProjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["element-links", id] });
      setLinkingElement(null);
      toast.success("Element linked");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: deleteElementLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["element-links", id] });
      toast.success("Link removed");
    },
  });

  const addOrgTagMutation = useMutation({
    mutationFn: (tagName: string) => addOrganizationTag(project!.organization_id!, tagName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", project?.organization_id] });
    },
  });

  const changeRequestMutation = useMutation({
    mutationFn: ({ step, proposedDescription }: { step: ProcessStep; proposedDescription: string }) =>
      createProcessChangeRequest({
        organizationId: project!.organization_id!,
        sourceProjectId: id!,
        stepId: step.id,
        stepName: step.task || `Vaihe ${step.step}`,
        currentDescription: step.decision || null,
        proposedDescription,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["process-change-requests", project?.organization_id] });
      toast.success("Muutosehdotus lähetetty tarkastettavaksi.");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const createDraftMutation = useMutation({
    mutationFn: () => createProcessChangeDraft({
      organizationId: project!.organization_id!,
      sourceProjectId: id!,
      projectName: projectName,
    }),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["process-change-requests", project?.organization_id] });
      toast.success("Muutosehdotusversio luotu. Voit nyt muokata kopiokaaviota.");
      if (request.review_project_id) navigate(`/editor/${request.review_project_id}?org=${project!.organization_id}`);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const submitDraftMutation = useMutation({
    mutationFn: () => submitProcessChangeDraft(activeDraftRequest!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["process-change-requests", project?.organization_id] });
      toast.success("Muutosehdotus lähetetty adminpaneeliin tarkastettavaksi.");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  useEffect(() => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || "");
      setOwnerName(project.owner_name || "");
      setOwnerEmail(project.owner_email || "");
      setStatus(project.status || "draft");
      setSteps(project.process_steps || []);
    }
  }, [project]);

  useEffect(() => {
    if (project && modeler) {
      modeler.importXML(project.bpmn_xml).then(() => {
        const canvas = modeler.get("canvas") as any;
        canvas.zoom("fit-viewport");
        lastSavedRef.current = project.bpmn_xml;
      });
    }
  }, [project, modeler]);

  const triggerAutoSave = useCallback(async () => {
    if (!modeler || !id || !canEditCurrentProject) return;

    try {
      const { xml } = await modeler.saveXML({ format: true });

      if (xml !== lastSavedRef.current || hasUnsavedChanges) {
        setIsSaving(true);
        await updateMutation.mutateAsync({
          name: projectName,
          description: projectDescription,
          bpmn_xml: xml,
          process_steps: steps,
          system_tags: [...new Set(steps.flatMap((s) => s.system))],
          owner_name: ownerName,
          owner_email: ownerEmail,
          status,
        });
        lastSavedRef.current = xml;
        setIsSaving(false);
      }
    } catch (err) {
      console.error("Auto-save failed:", err);
      setIsSaving(false);
    }
  }, [modeler, id, canEditCurrentProject, projectName, projectDescription, steps, hasUnsavedChanges, updateMutation, ownerName, ownerEmail, status]);

  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    if (hasUnsavedChanges) {
      autoSaveTimeoutRef.current = setTimeout(() => triggerAutoSave(), 2000);
    }
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [hasUnsavedChanges, triggerAutoSave]);

  useEffect(() => {
    if (!modeler) return;
    const eventBus = modeler.get("eventBus") as any;
    const handleChange = () => { if (canEditCurrentProject) setHasUnsavedChanges(true); };
    eventBus.on("commandStack.changed", handleChange);
    eventBus.on("element.changed", handleChange);
    return () => {
      eventBus.off("commandStack.changed", handleChange);
      eventBus.off("element.changed", handleChange);
    };
  }, [modeler, canEditCurrentProject]);

  const handleStepsChange = (newSteps: ProcessStep[]) => {
    if (!canEditCurrentProject) return;
    setSteps(newSteps);
    setHasUnsavedChanges(true);
  };

  const handleNameChange = (newName: string) => {
    if (!canEditCurrentProject) return;
    setProjectName(newName);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (newDescription: string) => {
    if (!canEditCurrentProject) return;
    setProjectDescription(newDescription);
    setHasUnsavedChanges(true);
  };

  const handleAddOrgTag = useCallback((tagName: string) => {
    if (!project?.organization_id) return;
    // Only add if not already in org tags
    if (!orgTags.some((t) => t.tag_name === tagName)) {
      addOrgTagMutation.mutate(tagName);
    }
  }, [project?.organization_id, orgTags, addOrgTagMutation]);

  // Sync process steps from BPMN diagram
  const syncStepsFromBpmn = useCallback(() => {
    if (!modeler || !canEditCurrentProject) return;
    const elementRegistry = modeler.get("elementRegistry") as any;
    const elements = elementRegistry.getAll();

    const taskTypes = new Set([
      "bpmn:Task", "bpmn:UserTask", "bpmn:ServiceTask", "bpmn:ManualTask",
      "bpmn:BusinessRuleTask", "bpmn:ScriptTask", "bpmn:SendTask", "bpmn:ReceiveTask",
    ]);
    const eventTypes = new Set([
      "bpmn:StartEvent", "bpmn:EndEvent", "bpmn:IntermediateCatchEvent",
      "bpmn:IntermediateThrowEvent", "bpmn:BoundaryEvent",
    ]);
    const gatewayTypes = new Set([
      "bpmn:ExclusiveGateway", "bpmn:ParallelGateway", "bpmn:InclusiveGateway",
    ]);
    const subprocessTypes = new Set(["bpmn:SubProcess", "bpmn:CallActivity"]);

    const flowNodeTypes = new Set([...taskTypes, ...eventTypes, ...gatewayTypes, ...subprocessTypes]);

    const flowNodes = elements.filter((el: any) => flowNodeTypes.has(el.type));

    // Sort by position (left to right, top to bottom)
    flowNodes.sort((a: any, b: any) => {
      const ax = a.x || 0, ay = a.y || 0;
      const bx = b.x || 0, by = b.y || 0;
      return ax - bx || ay - by;
    });

    // Helper: find the lane/participant an element belongs to
    const getPerformerFromLane = (el: any): string => {
      try {
        let bo = el.businessObject;
        // Walk up to find lane
        const allElements = elementRegistry.getAll();
        for (const candidate of allElements) {
          if (candidate.type === "bpmn:Lane") {
            const laneBo = candidate.businessObject;
            if (laneBo?.flowNodeRef) {
              const refs = Array.isArray(laneBo.flowNodeRef) ? laneBo.flowNodeRef : [laneBo.flowNodeRef];
              if (refs.some((ref: any) => ref?.id === bo?.id || ref === bo?.id)) {
                return laneBo.name || "";
              }
            }
          }
          // Also check participant
          if (candidate.type === "bpmn:Participant" && candidate.children) {
            if (candidate.children.length === 0 || !allElements.some((e: any) => e.type === "bpmn:Lane" && e.parent?.id === candidate.id)) {
              // No lanes inside participant, check if element is direct child
              if (el.parent?.id === candidate.id) {
                return candidate.businessObject?.name || "";
              }
            }
          }
        }
        // Check direct parent
        if (el.parent?.type === "bpmn:Participant") {
          return el.parent.businessObject?.name || "";
        }
      } catch (e) {
        // ignore
      }
      return "";
    };

    const getElementType = (type: string) => {
      if (taskTypes.has(type)) return "task" as const;
      if (eventTypes.has(type)) return "event" as const;
      if (gatewayTypes.has(type)) return "gateway" as const;
      if (subprocessTypes.has(type)) return "subprocess" as const;
      return "other" as const;
    };

    // Preserve existing data for elements that already have steps
    const existingMap = new Map(steps.map((s) => [s.id, s]));

    const newSteps: ProcessStep[] = flowNodes.map((el: any, i: number) => {
      const existing = existingMap.get(el.id);
      const bo = el.businessObject;
      const lanePerformer = getPerformerFromLane(el);
      const elType = getElementType(el.type);

      // Extract gateway paths (outgoing sequence flows)
      let gatewayPaths: GatewayPath[] | undefined;
      if (elType === "gateway" && bo?.outgoing) {
        const outgoing = Array.isArray(bo.outgoing) ? bo.outgoing : [bo.outgoing];
        gatewayPaths = outgoing
          .filter((flow: any) => flow)
          .map((flow: any) => ({
            label: flow.name || "",
            targetId: flow.targetRef?.id || "",
            targetName: flow.targetRef?.name || flow.targetRef?.id || "",
          }));
      }

      return {
        id: el.id,
        step: i + 1,
        task: bo?.name || el.type?.replace("bpmn:", "") || el.id,
        performer: existing?.performer || lanePerformer || "",
        system: existing?.system || [],
        decision: existing?.decision || "",
        elementType: elType,
        gatewayPaths,
      };
    });

    setSteps(newSteps);
    setHasUnsavedChanges(true);
    toast.success(`Synced ${newSteps.length} elements from diagram`);
  }, [modeler, steps, canEditCurrentProject]);

  const handleExport = useCallback(async (format: "png" | "svg" | "bpmn") => {
    if (!modeler) return;
    try {
      if (format === "bpmn") {
        const { xml } = await modeler.saveXML({ format: true });
        downloadFile(xml, `${projectName}.bpmn`, "application/xml");
      } else if (format === "svg") {
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
    if (!canEditCurrentProject) return;
    triggerAutoSave();
    toast.success(t("common.saved"));
  };

  const handleBack = () => {
    const params = new URLSearchParams();
    const orgId = searchParams.get("org") || project?.organization_id;
    const folderId = searchParams.get("folder") || project?.folder_id;

    if (orgId) {
      params.set("org", orgId);
    }

    if (folderId) {
      params.set("folder", folderId);
    }

    const query = params.toString();
    navigate(query ? `/dashboard?${query}` : "/dashboard");
  };

  // Get link for selected element
  const selectedElementLink = useMemo(() => {
    if (!selectedElement) return null;
    return elementLinks.find((l) => l.element_id === selectedElement.id) || null;
  }, [selectedElement, elementLinks]);

  const linkedProject = useMemo(() => {
    if (!selectedElementLink) return null;
    return allProjects.find((p) => p.id === selectedElementLink.linked_project_id) || null;
  }, [selectedElementLink, allProjects]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Button onClick={() => navigate("/dashboard")}>{t("editor.backToDashboard")}</Button>
        </div>
      </div>
    );
  }

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Process Steps with Sync button */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-panel-header px-4 py-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-panel-header-foreground tracking-wide uppercase">
            {t("editor.processSteps")}
          </h2>
          {canEditProject && (
            <Button
              size="sm"
              variant="outline"
              onClick={syncStepsFromBpmn}
              className="h-6 text-[10px] gap-1 px-2"
              title="Synkronoi vaiheet BPMN-kaaviosta"
            >
              <RefreshCw className="w-3 h-3" />
              Synkronoi
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <ProcessDataPanel
            steps={steps}
            onStepsChange={handleStepsChange}
            selectedElementId={selectedElement?.id}
            availableTags={availableTags}
            availablePositions={availablePerformers}
            description={projectDescription}
            onDescriptionChange={canEditProject ? handleDescriptionChange : undefined}
            onAddOrgTag={canEditProject && project.organization_id ? handleAddOrgTag : undefined}
            onSubmitChangeRequest={canSubmitChangeRequest ? async (step, proposedDescription) => {
              await changeRequestMutation.mutateAsync({ step, proposedDescription });
            } : undefined}
            readOnly={!canEditProject}
          />
        </div>
      </div>

      {/* Lane/Participant Name Editor */}
      {selectedElement && modeler && project.organization_id && canEditProject && (
        <LaneNameEditor
          element={selectedElement}
          modeler={modeler}
          positions={availablePerformers}
        />
      )}

      {/* Element Link Section */}
      {selectedElement && project.organization_id && canEditProject && (
        <div className="border-t px-3 py-3 space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            Element Link
          </h3>
          <p className="text-[10px] text-muted-foreground truncate">
            Selected: {selectedElement.businessObject?.name || selectedElement.id}
          </p>

          {selectedElementLink ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 p-2 rounded bg-muted text-xs">
                <Link2 className="w-3 h-3 text-accent shrink-0" />
                <span className="truncate flex-1">{linkedProject?.name || "Unknown"}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => unlinkMutation.mutate(selectedElementLink.id)}
                >
                  <Unlink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : linkingElement === selectedElement.id ? (
            <Select
              onValueChange={(projectId) => {
                linkMutation.mutate({ elementId: selectedElement.id, linkedProjectId: projectId });
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select process..." />
              </SelectTrigger>
              <SelectContent>
                {orgProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1"
              onClick={() => setLinkingElement(selectedElement.id)}
            >
              <Link2 className="w-3 h-3" />
              Link to Process
            </Button>
          )}
        </div>
      )}

      {/* Process Settings */}
      {canEditProject && <div className="border-t px-3 py-3 space-y-3">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Process Settings</h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setHasUnsavedChanges(true); }}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (Luonnos)</SelectItem>
                <SelectItem value="review">Under Review (Tarkastuksessa)</SelectItem>
                <SelectItem value="published">Published (Julkaistu)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Owner Name</label>
            <Input
              placeholder="Process owner name..."
              value={ownerName}
              onChange={(e) => { setOwnerName(e.target.value); setHasUnsavedChanges(true); }}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Owner Email</label>
            <Input
              placeholder="owner@example.com"
              value={ownerEmail}
              onChange={(e) => { setOwnerEmail(e.target.value); setHasUnsavedChanges(true); }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>}
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-2 sm:px-4 bg-card shrink-0">
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Workflow className="w-5 h-5 text-accent shrink-0 hidden sm:block" />
          <Input
            value={projectName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-8 w-32 sm:w-48 text-sm font-medium border-none bg-transparent focus-visible:bg-background"
            readOnly={!canEditProject}
          />
          <StatusBadge status={status} />
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            {isSaving ? (
              <><Cloud className="w-3 h-3 animate-pulse" />{t("common.saving")}</>
            ) : hasUnsavedChanges ? (
              <><CloudOff className="w-3 h-3" />{t("common.unsaved")}</>
            ) : (
              <><Cloud className="w-3 h-3 text-accent" />{t("common.saved")}</>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Documentation */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const orgId = searchParams.get("org") || project.organization_id;
              navigate(`/documentation/${id}${orgId ? `?org=${orgId}` : ""}`);
            }}
            className="h-8 text-xs gap-1.5"
            title="Generate Documentation"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Docs</span>
          </Button>
          {/* Presentation */}
          {project.organization_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const orgId = searchParams.get("org") || project.organization_id;
                navigate(`/presentation/${id}${orgId ? `?org=${orgId}` : ""}`);
              }}
              className="h-8 text-xs gap-1.5"
              title="Presentation Mode"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Present</span>
            </Button>
          )}
          {canEditProject && (
            <Button variant="outline" size="sm" onClick={handleManualSave} className="h-8 text-xs gap-1.5">
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("common.save")}</span>
            </Button>
          )}
          <ExportMenu onExport={handleExport} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen(!panelOpen)}
            className="h-8 w-8 p-0"
          >
            {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <BpmnCanvas onModelerReady={setModeler} onSelectionChange={setSelectedElement} readOnly={!canEditProject} />
        </div>

        {!isMobile && panelOpen && (
          <div className="w-80 border-l bg-card flex flex-col shrink-0">
            {panelContent}
          </div>
        )}

        {isMobile && panelOpen && (
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetContent side="right" className="w-[85vw] sm:w-80 p-0">
              {panelContent}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
