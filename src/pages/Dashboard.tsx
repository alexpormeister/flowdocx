import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, getFolders, createFolder, deleteFolder, deleteProject, createProject, type Project, type Folder } from "@/lib/api";
import { BPMN_TEMPLATES, type TemplateId } from "@/data/bpmnTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import LanguageToggle from "@/components/LanguageToggle";
import {
  Workflow,
  Plus,
  FolderPlus,
  Search,
  MoreVertical,
  Trash2,
  LogOut,
  User,
  FolderOpen,
  FileText,
  Clock,
  LayoutTemplate,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
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

  const createFolderMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => createFolder(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setNewFolderDialogOpen(false);
      setNewFolderName("");
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
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.email}
          </span>
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
        <aside className="w-64 border-r bg-card p-4 flex flex-col">
          <div className="space-y-2 mb-6">
            <Button onClick={handleNewProject} className="w-full justify-start gap-2">
              <Plus className="w-4 h-4" />
              {t("dashboard.newProject")}
            </Button>
            <Dialog open={templateGalleryOpen} onOpenChange={setTemplateGalleryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <LayoutTemplate className="w-4 h-4" />
                  {t("dashboard.newFromTemplate")}
                </Button>
              </DialogTrigger>
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

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("dashboard.folders")}
              </span>
              <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
                <DialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("dashboard.createFolder")}</DialogTitle>
                  </DialogHeader>
                  <Input
                    placeholder={t("dashboard.folderName")}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) {
                        createFolderMutation.mutate({ name: newFolderName.trim() });
                      }
                    }}
                  />
                  <DialogFooter>
                    <Button
                      onClick={() => createFolderMutation.mutate({ name: newFolderName.trim() })}
                      disabled={!newFolderName.trim()}
                    >
                      {t("common.create")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedFolder === null
                    ? "bg-accent/10 text-accent"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                {t("dashboard.allProjects")}
              </button>
              {folders.map((folder) => (
                <div key={folder.id} className="flex items-center group">
                  <button
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                      selectedFolder === folder.id
                        ? "bg-accent/10 text-accent"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: folder.color || "#0891b2" }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <button
                    onClick={() => deleteFolderMutation.mutate(folder.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
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
                  <Card
                    key={project.id}
                    className="group cursor-pointer hover:border-accent transition-colors"
                    onClick={() => navigate(`/editor/${project.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium truncate pr-2">
                          {project.name}
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover z-50">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProjectMutation.mutate(project.id);
                              }}
                              className="text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {project.description && (
                        <CardDescription className="text-xs line-clamp-1">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(project.updated_at), "MMM d, yyyy")}
                      </div>
                      {project.system_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {project.system_tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-tag text-tag-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {project.system_tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{project.system_tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
