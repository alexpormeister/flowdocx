import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getProjects,
  getFolders,
  createFolder,
  deleteFolder,
  deleteProject,
  createProject,
  updateProject,
  updateFolder,
  duplicateProject,
  getProfile,
  updateProfile,
  type Project,
  type Folder,
  type Profile,
} from "@/lib/api";
import {
  getFolderShares,
  createFolderShare,
  deleteFolderShare,
  getProjectShares,
  createProjectShare,
  deleteProjectShare,
} from "@/lib/sharingApi";
import {
  getOrganizations,
  createOrganization,
  getOrganizationMembers,
  getOrganizationTags,
  getOrganizationPositions,
  inviteOrganizationMember,
  updateMemberRole,
  updateMemberDetails,
  removeOrganizationMember,
  addOrganizationTag,
  removeOrganizationTag,
  updateOrganization,
  getCurrentUserMembership,
  createOrganizationPosition,
  updateOrganizationPosition,
  deleteOrganizationPosition,
  getMemberFolderRestrictions,
  addFolderRestriction,
  removeFolderRestrictionByMemberAndFolder,
  getOrganizationGroupsWithPositions,
  createOrganizationGroup,
  updateOrganizationGroup,
  deleteOrganizationGroup,
  addPositionToGroup,
  removePositionFromGroup,
  type Organization,
  type OrgRole,
} from "@/lib/organizationApi";
import { BPMN_TEMPLATES, type TemplateId } from "@/data/bpmnTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FolderSidebar } from "@/components/dashboard/FolderSidebar";
import { MobileFolderSheet } from "@/components/dashboard/MobileFolderSheet";
import { BreadcrumbNav } from "@/components/dashboard/BreadcrumbNav";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { ProjectStats } from "@/components/dashboard/ProjectStats";
import { OrganizationSelector } from "@/components/dashboard/OrganizationSelector";
import { OrganizationSettings } from "@/components/dashboard/OrganizationSettings";
import { Workflow, Plus, Search, LogOut, User, FileText, FolderOpen, Folder as FolderIcon, AppWindow, LayoutGrid, LayoutTemplate, FolderPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getContrastTextColor } from "@/lib/utils";
import AdminCreateUserDialog from "@/components/dashboard/AdminCreateUserDialog";
import { FOLDER_COLORS } from "@/components/dashboard/CreateFolderDialog";
import { EditFolderDialog } from "@/components/dashboard/EditFolderDialog";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(searchParams.get("folder") || null);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [showRootProjects, setShowRootProjects] = useState(false);
  const [mainCreateFolderOpen, setMainCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  // Persist org selection via URL params
  const selectedOrgId = searchParams.get("org") || null;
  const setSelectedOrgId = (orgId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (orgId) {
      params.set("org", orgId);
    } else {
      params.delete("org");
    }
    setSearchParams(params, { replace: true });
  };

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    enabled: !!user,
  });

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members", selectedOrgId],
    queryFn: () => (selectedOrgId ? getOrganizationMembers(selectedOrgId) : Promise.resolve([])),
    enabled: !!user && !!selectedOrgId,
  });

  const { data: orgTags = [] } = useQuery({
    queryKey: ["org-tags", selectedOrgId],
    queryFn: () => (selectedOrgId ? getOrganizationTags(selectedOrgId) : Promise.resolve([])),
    enabled: !!user && !!selectedOrgId,
  });

  const { data: currentMembership } = useQuery({
    queryKey: ["org-membership", selectedOrgId],
    queryFn: () => (selectedOrgId ? getCurrentUserMembership(selectedOrgId) : Promise.resolve(null)),
    enabled: !!user && !!selectedOrgId,
  });

  const { data: orgPositions = [] } = useQuery({
    queryKey: ["org-positions", selectedOrgId],
    queryFn: () => (selectedOrgId ? getOrganizationPositions(selectedOrgId) : Promise.resolve([])),
    enabled: !!user && !!selectedOrgId,
  });

  const { data: folderRestrictions = [] } = useQuery({
    queryKey: ["folder-restrictions", selectedOrgId],
    queryFn: () => (selectedOrgId ? getMemberFolderRestrictions(selectedOrgId) : Promise.resolve([])),
    enabled: !!user && !!selectedOrgId,
  });

  const { data: orgGroups = [] } = useQuery({
    queryKey: ["org-groups", selectedOrgId],
    queryFn: () => (selectedOrgId ? getOrganizationGroupsWithPositions(selectedOrgId) : Promise.resolve([])),
    enabled: !!user && !!selectedOrgId,
  });

  // Get current user's restricted folder IDs (from restrictions table)
  const myRestrictedFolderIds = useMemo(() => {
    if (!currentMembership || !folderRestrictions.length) return new Set<string>();
    return new Set(
      folderRestrictions
        .filter((r) => r.member_id === currentMembership.id)
        .map((r) => r.folder_id)
    );
  }, [folderRestrictions, currentMembership]);

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

  // Profile for background settings
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!user,
  });

  // Check if a folder or any ancestor is restricted
  const isFolderRestricted = useCallback((folderId: string, allFolders: Folder[]): boolean => {
    let currentId: string | null = folderId;
    while (currentId) {
      if (myRestrictedFolderIds.has(currentId)) return true;
      const folder = allFolders.find((f) => f.id === currentId);
      currentId = folder?.parent_id || null;
    }
    return false;
  }, [myRestrictedFolderIds]);

  // Filter folders and projects by organization (and restrictions for non-owner/admin)
  const isAdminOrOwner = currentMembership?.role === "owner" || currentMembership?.role === "admin";

  const filteredFolders = useMemo(() => {
    let result: Folder[];
    if (!selectedOrgId) {
      result = folders.filter((f) => !f.organization_id);
    } else {
      result = folders.filter((f) => f.organization_id === selectedOrgId);
    }
    // Apply restrictions for non-admin users
    if (selectedOrgId && !isAdminOrOwner && myRestrictedFolderIds.size > 0) {
      result = result.filter((f) => !isFolderRestricted(f.id, folders));
    }
    return result;
  }, [folders, selectedOrgId, isAdminOrOwner, myRestrictedFolderIds, isFolderRestricted]);

  const filteredProjectsByOrg = useMemo(() => {
    let result: Project[];
    if (!selectedOrgId) {
      result = projects.filter((p) => !p.organization_id);
    } else {
      result = projects.filter((p) => p.organization_id === selectedOrgId);
    }
    // Hide projects inside restricted folders for non-admin users
    if (selectedOrgId && !isAdminOrOwner && myRestrictedFolderIds.size > 0) {
      result = result.filter((p) => !p.folder_id || !isFolderRestricted(p.folder_id, folders));
    }
    return result;
  }, [projects, selectedOrgId, isAdminOrOwner, myRestrictedFolderIds, isFolderRestricted, folders]);

  // Folder shares for the selected folder
  const { data: folderShares = [] } = useQuery({
    queryKey: ["folder-shares", selectedFolder],
    queryFn: () => (selectedFolder ? getFolderShares(selectedFolder) : Promise.resolve([])),
    enabled: !!user && !!selectedFolder,
  });

  // Build breadcrumb path
  const currentPath = useMemo(() => {
    if (!selectedFolder) return [];
    const path: Folder[] = [];
    let current = filteredFolders.find((f) => f.id === selectedFolder);
    while (current) {
      path.unshift(current);
      current = current.parent_id ? filteredFolders.find((f) => f.id === current!.parent_id) : undefined;
    }
    return path;
  }, [selectedFolder, filteredFolders]);

  // Projects not in any folder (root/desktop)
  const rootProjects = useMemo(() => {
    return filteredProjectsByOrg.filter((p) => !p.folder_id);
  }, [filteredProjectsByOrg]);

  // Child folders of selected folder (or root folders)
  const childFolders = useMemo(() => {
    if (showRootProjects) return [];
    if (selectedFolder) {
      return filteredFolders.filter((f) => f.parent_id === selectedFolder);
    }
    // Root-level folders
    return filteredFolders.filter((f) => !f.parent_id);
  }, [filteredFolders, selectedFolder, showRootProjects]);

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId, color }: { name: string; parentId: string | null; color: string }) =>
      createFolder(name, color, parentId, selectedOrgId || undefined),
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
      const orgParam = selectedOrgId ? `?org=${selectedOrgId}` : "";
      const folderParam = selectedFolder ? `&folder=${selectedFolder}` : "";
      navigate(`/editor/${project.id}${orgParam}${folderParam}`);
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
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; color?: string; system_tags?: string[] } }) => updateFolder(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success(t("common.saved"));
    },
  });

  const duplicateProjectMutation = useMutation({
    mutationFn: duplicateProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project duplicated");
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

  // Organization mutations
  const createOrgMutation = useMutation({
    mutationFn: ({ name, businessId }: { name: string; businessId?: string }) => createOrganization(name, businessId),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setSelectedOrgId(org.id);
      toast.success(t("org.createOrganization"));
    },
    onError: (error) => {
      toast.error("Failed to create organization: " + (error as Error).message);
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; business_id?: string; notes?: string; primary_color?: string; accent_color?: string } }) =>
      updateOrganization(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(t("common.saved"));
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: ({
      orgId,
      email,
      role,
      options,
    }: {
      orgId: string;
      email: string;
      role: OrgRole;
      options?: { title?: string; positionId?: string; sendEmailInvite?: boolean };
    }) => inviteOrganizationMember(orgId, email, role, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", selectedOrgId] });
      toast.success(t("share.shareCreated"));
    },
  });

  const updateMemberDetailsMutation = useMutation({
    mutationFn: ({
      memberId,
      updates,
    }: {
      memberId: string;
      updates: { title?: string; position_id?: string | null };
    }) => updateMemberDetails(memberId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", selectedOrgId] });
    },
  });

  const addPositionMutation = useMutation({
    mutationFn: ({ orgId, name, parentId }: { orgId: string; name: string; parentId?: string }) =>
      createOrganizationPosition(orgId, name, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-positions", selectedOrgId] });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({
      positionId,
      updates,
    }: {
      positionId: string;
      updates: { name?: string; parent_position_id?: string | null };
    }) => updateOrganizationPosition(positionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-positions", selectedOrgId] });
    },
  });

  const deletePositionMutation = useMutation({
    mutationFn: deleteOrganizationPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-positions", selectedOrgId] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) => createOrganizationGroup(orgId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-groups", selectedOrgId] });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, updates }: { groupId: string; updates: { name?: string } }) => updateOrganizationGroup(groupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-groups", selectedOrgId] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteOrganizationGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-groups", selectedOrgId] });
    },
  });

  const addGroupPositionMutation = useMutation({
    mutationFn: ({ groupId, positionId }: { groupId: string; positionId: string }) => addPositionToGroup(groupId, positionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-groups", selectedOrgId] });
    },
  });

  const removeGroupPositionMutation = useMutation({
    mutationFn: ({ groupId, positionId }: { groupId: string; positionId: string }) => removePositionFromGroup(groupId, positionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-groups", selectedOrgId] });
    },
  });


    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) => updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", selectedOrgId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeOrganizationMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", selectedOrgId] });
      toast.success(t("share.shareRemoved"));
    },
  });

  const addOrgTagMutation = useMutation({
    mutationFn: ({ orgId, tagName }: { orgId: string; tagName: string }) => addOrganizationTag(orgId, tagName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", selectedOrgId] });
    },
  });

  const removeOrgTagMutation = useMutation({
    mutationFn: removeOrganizationTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tags", selectedOrgId] });
    },
  });

  const addFolderRestrictionMutation = useMutation({
    mutationFn: ({ memberId, folderId }: { memberId: string; folderId: string }) =>
      addFolderRestriction(selectedOrgId!, memberId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-restrictions", selectedOrgId] });
    },
  });

  const removeFolderRestrictionMutation = useMutation({
    mutationFn: ({ memberId, folderId }: { memberId: string; folderId: string }) =>
      removeFolderRestrictionByMemberAndFolder(memberId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-restrictions", selectedOrgId] });
    },
  });

  // Filter by search and folder
  const displayedProjects = useMemo(() => {
    // Global search across all org projects when searching in org mode
    if (search && selectedOrgId) {
      const lowerSearch = search.toLowerCase();
      return filteredProjectsByOrg.filter((p) =>
        p.name.toLowerCase().includes(lowerSearch) ||
        (p.description || "").toLowerCase().includes(lowerSearch) ||
        p.process_steps?.some((s) => s.task?.toLowerCase().includes(lowerSearch)) ||
        p.process_steps?.some((s) => s.performer?.toLowerCase().includes(lowerSearch)) ||
        p.system_tags?.some((t) => t.toLowerCase().includes(lowerSearch))
      );
    }

    let projectsToShow = filteredProjectsByOrg;

    if (showRootProjects) {
      projectsToShow = rootProjects;
    } else if (selectedFolder) {
      projectsToShow = projectsToShow.filter((p) => p.folder_id === selectedFolder);
    } else if (selectedOrgId) {
      projectsToShow = [];
    }

    if (search) {
      projectsToShow = projectsToShow.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    }

    return projectsToShow;
  }, [filteredProjectsByOrg, rootProjects, showRootProjects, selectedFolder, search, selectedOrgId]);

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
      folder_id: showRootProjects ? null : selectedFolder,
      organization_id: selectedOrgId || undefined,
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
      folder_id: showRootProjects ? null : selectedFolder,
      description: template.description,
      organization_id: selectedOrgId || undefined,
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

  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolder(folderId);
    setShowRootProjects(false);
  };

  const handleShowRootProjects = () => {
    setSelectedFolder(null);
    setShowRootProjects(true);
  };

  // Reset folder selection when org changes
  useEffect(() => {
    setSelectedFolder(null);
    setShowRootProjects(false);
  }, [selectedOrgId]);

  // Background style
  const backgroundStyle = useMemo(() => {
    const bgUrl = profile?.dashboard_background_url;
    if (!bgUrl) return {};

    if (bgUrl.startsWith("linear-gradient")) {
      return { background: bgUrl };
    }
    return {
      backgroundImage: `url(${bgUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    };
  }, [profile?.dashboard_background_url]);

  // Org brand theme as inline CSS custom properties
  const orgThemeStyle = useMemo(() => {
    if (!selectedOrg?.primary_color && !selectedOrg?.accent_color) return {};
    const style: Record<string, string> = {};
    if (selectedOrg.primary_color) {
      style["--org-primary"] = selectedOrg.primary_color;
    }
    if (selectedOrg.accent_color) {
      style["--org-accent"] = selectedOrg.accent_color;
    }
    return style;
  }, [selectedOrg?.primary_color, selectedOrg?.accent_color]);

  const hasOrgTheme = !!(selectedOrg?.primary_color || selectedOrg?.accent_color);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  const sidebarProps = {
    folders: filteredFolders,
    selectedFolderId: selectedFolder,
    currentPath,
    onSelectFolder: handleSelectFolder,
    onCreateFolder: (name: string, parentId: string | null, color: string) =>
      createFolderMutation.mutate({ name, parentId, color }),
    onDeleteFolder: (id: string) => deleteFolderMutation.mutate(id),
    onEditFolder: (id: string, name: string, color: string) =>
      updateFolderMutation.mutate({ id, updates: { name, color } }),
    onUpdateFolderTags: (folderId: string, tags: string[]) =>
      updateFolderMutation.mutate({ id: folderId, updates: { system_tags: tags } }),
    onNewProject: handleNewProject,
    onOpenTemplateGallery: () => setTemplateGalleryOpen(true),
    isCreatingFolder: createFolderMutation.isPending,
    folderShares: folderShares.map((s) => ({
      id: s.id,
      email: s.shared_with_email,
      permission: s.permission,
      created_at: s.created_at,
    })),
    onShareFolder: async (folderId: string, email: string, permission: "view" | "edit") => {
      await shareFolderMutation.mutateAsync({ folderId, email, permission });
    },
    onRemoveFolderShare: async (shareId: string) => {
      await removeFolderShareMutation.mutateAsync(shareId);
    },
    orgPrimaryColor: selectedOrg?.primary_color || null,
  };

  return (
    <div className="min-h-screen bg-background" style={{ ...backgroundStyle, ...orgThemeStyle } as React.CSSProperties} {...(hasOrgTheme ? { "data-org-theme": "" } : {})}>
      {/* Header */}
      <header
        className="h-14 border-b flex items-center justify-between px-3 md:px-6 bg-card"
        style={hasOrgTheme ? { backgroundColor: "var(--org-primary)" } : undefined}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <MobileFolderSheet {...sidebarProps} />
          <Workflow
            className="w-5 h-5 md:w-6 md:h-6"
            style={hasOrgTheme ? { color: "var(--org-accent)" } : undefined}
          />
          <h1
            className="text-base md:text-lg font-semibold hidden sm:block"
            style={hasOrgTheme ? { color: "var(--org-accent)" } : undefined}
          >
            {selectedOrg ? selectedOrg.name : "Nexus OS"}
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3 org-header-actions">
          <OrganizationSelector
            organizations={organizations}
            selectedOrgId={selectedOrgId}
            onSelectOrg={setSelectedOrgId}
            onCreateOrg={async (name, businessId) => {
              await createOrgMutation.mutateAsync({ name, businessId });
            }}
            isCreating={createOrgMutation.isPending}
            triggerStyle={hasOrgTheme ? { backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", borderColor: "rgba(255,255,255,0.25)" } : undefined}
          />
          {selectedOrg && (
            <OrganizationSettings
              organization={selectedOrg}
              members={orgMembers}
              tags={orgTags}
              positions={orgPositions}
              groups={orgGroups}
              folders={filteredFolders}
              folderRestrictions={folderRestrictions}
              currentUserRole={currentMembership?.role || null}
              onUpdateOrg={async (updates) => {
                await updateOrgMutation.mutateAsync({ id: selectedOrg.id, updates });
              }}
              onInviteMember={async (email, role, options) => {
                await inviteMemberMutation.mutateAsync({ orgId: selectedOrg.id, email, role, options });
              }}
              onUpdateMemberRole={async (memberId, role) => {
                await updateMemberMutation.mutateAsync({ memberId, role });
              }}
              onUpdateMemberDetails={async (memberId, updates) => {
                await updateMemberDetailsMutation.mutateAsync({ memberId, updates });
              }}
              onRemoveMember={async (memberId) => {
                await removeMemberMutation.mutateAsync(memberId);
              }}
              onAddTag={async (tagName) => {
                await addOrgTagMutation.mutateAsync({ orgId: selectedOrg.id, tagName });
              }}
              onRemoveTag={async (tagId) => {
                await removeOrgTagMutation.mutateAsync(tagId);
              }}
              onAddPosition={async (name, parentId) => {
                await addPositionMutation.mutateAsync({ orgId: selectedOrg.id, name, parentId });
              }}
              onUpdatePosition={async (positionId, updates) => {
                await updatePositionMutation.mutateAsync({ positionId, updates });
              }}
              onDeletePosition={async (positionId) => {
                await deletePositionMutation.mutateAsync(positionId);
              }}
              onAddFolderRestriction={async (memberId, folderId) => {
                await addFolderRestrictionMutation.mutateAsync({ memberId, folderId });
              }}
              onRemoveFolderRestriction={async (memberId, folderId) => {
                await removeFolderRestrictionMutation.mutateAsync({ memberId, folderId });
              }}
              onCreateGroup={async (name) => {
                await createGroupMutation.mutateAsync({ orgId: selectedOrg.id, name });
              }}
              onUpdateGroup={async (groupId, updates) => {
                await updateGroupMutation.mutateAsync({ groupId, updates });
              }}
              onDeleteGroup={async (groupId) => {
                await deleteGroupMutation.mutateAsync(groupId);
              }}
              onAddGroupPosition={async (groupId, positionId) => {
                await addGroupPositionMutation.mutateAsync({ groupId, positionId });
              }}
              onRemoveGroupPosition={async (groupId, positionId) => {
                await removeGroupPositionMutation.mutateAsync({ groupId, positionId });
              }}
            />
          )}
          {selectedOrgId && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Applications"
                onClick={() => navigate(`/applications?org=${selectedOrgId}`)}
                style={hasOrgTheme ? { color: "#fff" } : undefined}
              >
                <AppWindow className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Capability Map"
                onClick={() => navigate(`/capability-map?org=${selectedOrgId}`)}
                style={hasOrgTheme ? { color: "#fff" } : undefined}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </>
          )}
          <AdminCreateUserDialog />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                style={hasOrgTheme ? { color: "#fff" } : undefined}
              >
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
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <FolderSidebar {...sidebarProps} />
        </div>

        {/* Main Content */}
        <main
          className="flex-1 p-4 md:p-6 overflow-auto org-main"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleFolderDrop(e, selectedFolder)}
        >
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <BreadcrumbNav currentPath={currentPath} onNavigate={handleSelectFolder} />

            {/* Project Stats */}
            <ProjectStats
              projects={displayedProjects}
              currentFolderName={
                showRootProjects ? t("dashboard.desktop") : currentPath[currentPath.length - 1]?.name || null
              }
            />

            {/* Info label */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {!selectedFolder && (
                <span className="text-sm text-muted-foreground">{t("dashboard.allProjects")}</span>
              )}
            </div>

            {/* Search + Actions */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={selectedOrgId ? "Search all processes (name, description, steps, systems)..." : t("dashboard.searchProjects")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {search && selectedOrgId && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {displayedProjects.length} results
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  onClick={handleNewProject}
                  size="sm"
                  style={selectedOrg?.primary_color ? { backgroundColor: selectedOrg.primary_color, color: getContrastTextColor(selectedOrg.primary_color) } : undefined}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("dashboard.newProject")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplateGalleryOpen(true)}
                >
                  <LayoutTemplate className="w-4 h-4 mr-1" />
                  {t("dashboard.newFromTemplate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMainCreateFolderOpen(true)}
                >
                  <FolderPlus className="w-4 h-4 mr-1" />
                  {t("dashboard.createFolder")}
                </Button>
              </div>
            </div>

            {projectsLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
            ) : (
              <>
                {/* Folders - Windows style */}
                {childFolders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {t("dashboard.folders")}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {childFolders.map((folder) => (
                        <div
                          key={folder.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleFolderDrop(e, folder.id)}
                          className="relative group"
                        >
                          <button
                            onClick={() => handleSelectFolder(folder.id)}
                            className="flex w-full flex-col items-center gap-2 rounded-lg border bg-card p-4 transition-all hover:border-accent hover:bg-accent/5 cursor-pointer"
                          >
                            <FolderIcon
                              className="w-10 h-10 sm:w-12 sm:h-12"
                              style={{ color: folder.color || "#0891b2" }}
                              fill={folder.color || "#0891b2"}
                            />
                            <span className="text-sm font-medium truncate w-full text-center">{folder.name}</span>
                            {(folder.system_tags?.length || 0) > 0 && (
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                {folder.system_tags?.length} tags
                              </span>
                            )}
                          </button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                            }}
                          >
                            <FolderIcon className="sr-only" />
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {displayedProjects.length === 0 && childFolders.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                    <p className="text-muted-foreground mb-4">
                      {search ? t("dashboard.noMatch") : t("dashboard.noProjects")}
                    </p>
                    <Button onClick={handleNewProject} style={selectedOrg?.primary_color ? { backgroundColor: selectedOrg.primary_color, color: getContrastTextColor(selectedOrg.primary_color) } : undefined}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t("dashboard.createFirst")}
                    </Button>
                  </div>
                ) : (
                  displayedProjects.length > 0 && (
                    <>
                      {childFolders.length > 0 && (
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                          {t("dashboard.files")}
                        </h3>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            folders={filteredFolders}
                            onOpen={(id) => {
                              const orgParam = selectedOrgId ? `?org=${selectedOrgId}` : "";
                              const folderParam = selectedFolder ? `&folder=${selectedFolder}` : "";
                              navigate(`/editor/${id}${orgParam}${folderParam}`);
                            }}
                            onDelete={(id) => deleteProjectMutation.mutate(id)}
                            onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
                            onMoveToFolder={(projectId, folderId) =>
                              moveProjectMutation.mutate({ projectId, folderId })
                            }
                          />
                        ))}
                      </div>
                    </>
                  )
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Create Folder Dialog (main area) */}
      <Dialog open={mainCreateFolderOpen} onOpenChange={setMainCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.createFolder")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("dashboard.folderName")}</Label>
              <Input
                placeholder={t("dashboard.folderName")}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    createFolderMutation.mutate({ name: newFolderName.trim(), parentId: selectedFolder, color: newFolderColor });
                    setNewFolderName("");
                    setNewFolderColor(FOLDER_COLORS[0]);
                    setMainCreateFolderOpen(false);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("dashboard.folderColor") || "Color"}</Label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${newFolderColor === c ? "ring-2 ring-offset-2 ring-accent" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {selectedFolder && currentPath.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("dashboard.creatingIn")}: {currentPath[currentPath.length - 1]?.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (newFolderName.trim()) {
                  createFolderMutation.mutate({ name: newFolderName.trim(), parentId: selectedFolder, color: newFolderColor });
                  setNewFolderName("");
                  setNewFolderColor(FOLDER_COLORS[0]);
                  setMainCreateFolderOpen(false);
                }
              }}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingFolder && (
        <EditFolderDialog
          open={!!editingFolder}
          onOpenChange={(open) => {
            if (!open) setEditingFolder(null);
          }}
          folderName={editingFolder.name}
          folderColor={editingFolder.color || FOLDER_COLORS[0]}
          onSave={(name, color) => {
            updateFolderMutation.mutate({
              id: editingFolder.id,
              updates: { name, color },
            });
            setEditingFolder(null);
          }}
        />
      )}

      {/* Template Gallery Dialog */}
      <Dialog open={templateGalleryOpen} onOpenChange={setTemplateGalleryOpen}>
        <DialogContent className="max-w-3xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>{t("dashboard.chooseTemplate")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 max-h-[60vh] overflow-auto">
            {Object.entries(BPMN_TEMPLATES).map(([id, template]) => (
              <Card
                key={id}
                className="cursor-pointer hover:border-accent transition-colors"
                onClick={() => handleCreateFromTemplate(id as TemplateId)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <CardDescription className="text-xs">{template.category}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <p className="line-clamp-2">{template.description}</p>
                  {template.systemTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.systemTags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-tag text-tag-foreground">
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
