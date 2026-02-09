import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, getFolders, createFolder, deleteFolder, deleteProject, createProject, updateProject, updateFolder, type Project, type Folder } from "@/lib/api";
import { getFolderShares, createFolderShare, deleteFolderShare, getProjectShares, createProjectShare, deleteProjectShare } from "@/lib/sharingApi";
import { BPMN_TEMPLATES, type TemplateId } from "@/data/bpmnTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import LanguageToggle from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FolderSidebar } from "@/components/dashboard/FolderSidebar";
import { BreadcrumbNav } from "@/components/dashboard/BreadcrumbNav";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { ProjectStats } from "@/components/dashboard/ProjectStats";
import {
  Workflow,
  Plus,
  Search,
  LogOut,
  User,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled: !!user,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: getFolders,
    enabled: !!user,
  });

  // Folder shares for the selected folder
  const { data: folderShares = [] } = useQuery({
    queryKey: ["folder-shares", selectedFolder],
    queryFn: () => selectedFolder ? getFolderShares(selectedFolder) : Promise.resolve([]),
    enabled: !!user && !!selectedFolder,
  });

  // Build breadcrumb path from selected folder to root
  const currentPath = useMemo(() => {
    if (!selectedFolder) return [];
    const path: Folder[] = [];
    let current = folders.find((f) => f.id === selectedFolder);
    while (current) {
      path.unshift(current);
      current = current.parent_id
        ? folders.find((f) => f.id === current!.parent_id)
        : undefined;
    }
    return path;
  }, [selectedFolder, folders]);

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId, color }: { name: string; parentId: string | null; color: string }) =>
      createFolder(name, color, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder created");
    },
    onError: (error) => {
      toast.error("Failed to create folder: " + (error as Error).message);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedFolder(null);
      toast.success("Folder deleted");
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/editor/${project.id}`);
    },
  });

  const moveProjectMutation = useMutation({
    mutationFn: ({ projectId, folderId }: { projectId: string; folderId: string | null }) =>
      updateProject(projectId, { folder_id: folderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("dashboard.projectMoved"));
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { system_tags?: string[] } }) =>
      updateFolder(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });

  const shareFolderMutation = useMutation({
    mutationFn: ({ folderId, email, permission }: { folderId: string; email: string; permission: "view" | "edit" }) =>
      createFolderShare(folderId, email, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-shares", selectedFolder] });
      toast.success(t("share.shareCreated"));
    },
    onError: (error) => {
      toast.error("Failed to share: " + (error as Error).message);
    },
  });

  const removeFolderShareMutation = useMutation({
    mutationFn: deleteFolderShare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-shares", selectedFolder] });
      toast.success(t("share.shareRemoved"));
    },
  });

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = selectedFolder ? p.folder_id === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  const handleNewProject = () => {
    const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="sample-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:collaboration id="Collaboration_1">
    <bpmn2:participant id="Participant_1" name="Process" processRef="Process_1" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1" name="Start" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="222" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

    createProjectMutation.mutate({
      name: "Untitled Project",
      bpmn_xml: emptyBpmn,
      folder_id: selectedFolder,
    });
  };

  const handleCreateFromTemplate = (templateId: TemplateId) => {
    const template = BPMN_TEMPLATES[templateId];
    createProjectMutation.mutate({
      name: template.name,
      bpmn_xml: template.bpmnXml,
      process_steps: template.processSteps.map((s, i) => ({
        id: `step-${Date.now()}-${i}`,
        ...s,
      })),
      system_tags: template.systemTags,
      folder_id: selectedFolder,
      description: template.description,
    });
    setTemplateGalleryOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId");
    if (projectId) {
      moveProjectMutation.mutate({ projectId, folderId });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Workflow className="w-6 h-6 text-accent" />
          <h1 className="text-lg font-semibold">BPMN Modeler</h1>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-50">
              <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                {t("nav.profile")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <FolderSidebar
          folders={folders}
          selectedFolderId={selectedFolder}
          currentPath={currentPath}
          onSelectFolder={setSelectedFolder}
          onCreateFolder={(name, parentId, color) =>
            createFolderMutation.mutate({ name, parentId, color })
          }
          onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
          onUpdateFolderTags={(folderId, tags) =>
            updateFolderMutation.mutate({ id: folderId, updates: { system_tags: tags } })
          }
          onNewProject={handleNewProject}
          onOpenTemplateGallery={() => setTemplateGalleryOpen(true)}
          isCreatingFolder={createFolderMutation.isPending}
          folderShares={folderShares.map(s => ({
            id: s.id,
            email: s.shared_with_email,
            permission: s.permission,
            created_at: s.created_at,
          }))}
          onShareFolder={async (folderId, email, permission) => {
            await shareFolderMutation.mutateAsync({ folderId, email, permission });
          }}
          onRemoveFolderShare={async (shareId) => {
            await removeFolderShareMutation.mutateAsync(shareId);
          }}
        />

        {/* Main Content */}
        <main
          className="flex-1 p-6 overflow-auto"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleFolderDrop(e, selectedFolder)}
        >
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <BreadcrumbNav currentPath={currentPath} onNavigate={setSelectedFolder} />

            {/* Project Stats */}
            <ProjectStats
              projects={filteredProjects}
              currentFolderName={currentPath[currentPath.length - 1]?.name || null}
            />

            {/* Search */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("dashboard.searchProjects")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {projectsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-muted-foreground mb-4">
                  {search ? t("dashboard.noMatch") : t("dashboard.noProjects")}
                </p>
                <Button onClick={handleNewProject}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("dashboard.createFirst")}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    folders={folders}
                    onOpen={(id) => navigate(`/editor/${id}`)}
                    onDelete={(id) => deleteProjectMutation.mutate(id)}
                    onMoveToFolder={(projectId, folderId) =>
                      moveProjectMutation.mutate({ projectId, folderId })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Template Gallery Dialog */}
      <Dialog open={templateGalleryOpen} onOpenChange={setTemplateGalleryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("dashboard.chooseTemplate")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {Object.entries(BPMN_TEMPLATES).map(([id, template]) => (
              <Card
                key={id}
                className="cursor-pointer hover:border-accent transition-colors"
                onClick={() => handleCreateFromTemplate(id as TemplateId)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {template.category}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <p className="line-clamp-2">{template.description}</p>
                  {template.systemTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.systemTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-tag text-tag-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
