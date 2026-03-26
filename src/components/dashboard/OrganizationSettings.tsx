import { useState, useEffect, useRef, useCallback } from "react";
import { Settings, Users, Tags, Building2, Trash2, Crown, Shield, Edit3, Eye, Mail, X, Plus, Network, FileText, Download, FolderOpen, Palette, GripVertical, Check, Pencil, UsersRound } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Organization, OrganizationMember, OrganizationSystemTag, OrgRole, OrganizationPosition, MemberFolderRestriction, OrganizationGroup } from "@/lib/organizationApi";
import type { Folder } from "@/lib/api";
import { MemberFolderAccessDialog } from "./MemberFolderAccessDialog";

interface OrganizationSettingsProps {
  organization: Organization;
  members: OrganizationMember[];
  tags: OrganizationSystemTag[];
  positions: OrganizationPosition[];
  groups: (OrganizationGroup & { position_ids: string[] })[];
  folders: Folder[];
  folderRestrictions: MemberFolderRestriction[];
  currentUserRole: OrgRole | null;
  onUpdateOrg: (updates: { name?: string; notes?: string; primary_color?: string; accent_color?: string }) => Promise<void>;
  onInviteMember: (email: string, role: OrgRole, options?: { title?: string; positionId?: string; sendEmailInvite?: boolean }) => Promise<void>;
  onUpdateMemberRole: (memberId: string, role: OrgRole) => Promise<void>;
  onUpdateMemberDetails: (memberId: string, updates: { title?: string; position_id?: string | null }) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onAddTag: (tagName: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onAddPosition: (name: string, parentId?: string) => Promise<void>;
  onUpdatePosition: (positionId: string, updates: { name?: string; parent_position_id?: string | null }) => Promise<void>;
  onDeletePosition: (positionId: string) => Promise<void>;
  onAddFolderRestriction: (memberId: string, folderId: string) => Promise<void>;
  onRemoveFolderRestriction: (memberId: string, folderId: string) => Promise<void>;
  onCreateGroup: (name: string) => Promise<void>;
  onUpdateGroup: (groupId: string, updates: { name?: string }) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onAddGroupPosition: (groupId: string, positionId: string) => Promise<void>;
  onRemoveGroupPosition: (groupId: string, positionId: string) => Promise<void>;
}

const roleIcons: Record<OrgRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  editor: Edit3,
  viewer: Eye,
};

function downloadOrgStructure(orgName: string, positions: OrganizationPosition[], members: OrganizationMember[]) {
  const buildTree = (parentId: string | null, indent: number): string[] => {
    const children = positions
      .filter(p => p.parent_position_id === parentId)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    
    const lines: string[] = [];
    for (const pos of children) {
      const prefix = "  ".repeat(indent);
      const posMembers = members.filter(m => m.position_id === pos.id);
      const memberStr = posMembers.length > 0
        ? ` (${posMembers.map(m => `${m.email}${m.title ? ` - ${m.title}` : ""}`).join(", ")})`
        : "";
      lines.push(`${prefix}├── ${pos.name}${memberStr}`);
      lines.push(...buildTree(pos.id, indent + 1));
    }
    return lines;
  };

  const content = [`${orgName} - Organization Structure`, "=".repeat(40), "", ...buildTree(null, 0)].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${orgName.replace(/\s+/g, "_")}_structure.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function OrganizationSettings({
  organization,
  members,
  tags,
  positions,
  groups,
  folders,
  folderRestrictions,
  currentUserRole,
  onUpdateOrg,
  onInviteMember,
  onUpdateMemberRole,
  onUpdateMemberDetails,
  onRemoveMember,
  onAddTag,
  onRemoveTag,
  onAddPosition,
  onUpdatePosition,
  onDeletePosition,
  onAddFolderRestriction,
  onRemoveFolderRestriction,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddGroupPosition,
  onRemoveGroupPosition,
}: OrganizationSettingsProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [orgName, setOrgName] = useState(organization.name);
  const [orgNotes, setOrgNotes] = useState(organization.notes || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("viewer");
  const [inviteTitle, setInviteTitle] = useState("");
  const [invitePositionId, setInvitePositionId] = useState("");
  const [sendEmailInvite, setSendEmailInvite] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionParentId, setNewPositionParentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(organization.primary_color || "#0f172a");
  const [accentColor, setAccentColor] = useState(organization.accent_color || "#0891b2");
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editingPositionName, setEditingPositionName] = useState("");
  const [draggedPositionId, setDraggedPositionId] = useState<string | null>(null);
  const [dragOverPositionId, setDragOverPositionId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  useEffect(() => {
    setPrimaryColor(organization.primary_color || "#0f172a");
    setAccentColor(organization.accent_color || "#0891b2");
    setOrgName(organization.name);
    setOrgNotes(organization.notes || "");
  }, [organization]);
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  const handleSaveProfile = async () => {
    setIsSubmitting(true);
    try {
      await onUpdateOrg({ name: orgName, notes: orgNotes || undefined });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsSubmitting(true);
    try {
      await onInviteMember(inviteEmail.trim(), inviteRole, {
        title: inviteTitle.trim() || undefined,
        positionId: invitePositionId || undefined,
        sendEmailInvite,
      });
      setInviteEmail("");
      setInviteTitle("");
      setInvitePositionId("");
      setSendEmailInvite(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddTag(newTag.trim());
      setNewTag("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPosition = async () => {
    if (!newPositionName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddPosition(newPositionName.trim(), newPositionParentId || undefined);
      setNewPositionName("");
      setNewPositionParentId("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildPositionTree = (parentId: string | null = null): OrganizationPosition[] => {
    if (!positions || positions.length === 0) return [];
    return positions
      .filter(p => p.parent_position_id === parentId)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  };

  const handleStartEditPosition = (position: OrganizationPosition) => {
    setEditingPositionId(position.id);
    setEditingPositionName(position.name);
  };

  const handleSavePositionName = async (positionId: string) => {
    if (!editingPositionName.trim()) return;
    setIsSubmitting(true);
    try {
      await onUpdatePosition(positionId, { name: editingPositionName.trim() });
      setEditingPositionId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDescendant = (positionId: string, potentialAncestorId: string): boolean => {
    let current = positions.find(p => p.id === positionId);
    while (current) {
      if (current.parent_position_id === potentialAncestorId) return true;
      current = positions.find(p => p.id === current!.parent_position_id);
    }
    return false;
  };

  const handleDrop = async (targetPositionId: string | null) => {
    if (!draggedPositionId || draggedPositionId === targetPositionId) {
      setDraggedPositionId(null);
      setDragOverPositionId(null);
      return;
    }
    // Prevent dropping onto a descendant
    if (targetPositionId && isDescendant(targetPositionId, draggedPositionId)) {
      setDraggedPositionId(null);
      setDragOverPositionId(null);
      return;
    }
    setIsSubmitting(true);
    try {
      await onUpdatePosition(draggedPositionId, { parent_position_id: targetPositionId });
    } finally {
      setIsSubmitting(false);
      setDraggedPositionId(null);
      setDragOverPositionId(null);
    }
  };

  const renderVisualPositionNode = (position: OrganizationPosition, depth: number = 0, isLast: boolean = false) => {
    const children = buildPositionTree(position.id);
    const membersInPosition = (members || []).filter(m => m.position_id === position.id);
    const isDragging = draggedPositionId === position.id;
    const isDragOver = dragOverPositionId === position.id;
    const isEditing = editingPositionId === position.id;
    
    return (
      <div key={position.id} className="relative">
        <div className="flex items-start" style={{ paddingLeft: `${depth * 40}px` }}>
          {/* Connecting lines */}
          {depth > 0 && (
            <>
              <div
                className="absolute border-l-2 border-border"
                style={{ left: `${(depth - 1) * 40 + 18}px`, top: 0, height: isLast ? '24px' : '100%' }}
              />
              <div
                className="absolute border-t-2 border-border"
                style={{ left: `${(depth - 1) * 40 + 18}px`, top: '24px', width: '22px' }}
              />
            </>
          )}
          
          {/* Node card */}
          <div
            draggable={isAdmin && !isEditing}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDraggedPositionId(position.id);
            }}
            onDragEnd={() => {
              setDraggedPositionId(null);
              setDragOverPositionId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (draggedPositionId && draggedPositionId !== position.id) {
                setDragOverPositionId(position.id);
              }
            }}
            onDragLeave={() => setDragOverPositionId(null)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDrop(position.id);
            }}
            className={`bg-card border-2 rounded-lg p-3 my-1 min-w-[220px] shadow-sm transition-all relative ${
              isDragging ? "opacity-40 scale-95" : "hover:shadow-md"
            } ${isDragOver ? "border-primary ring-2 ring-primary/30" : "border-border"} ${
              isAdmin && !isEditing ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAdmin && !isEditing && (
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                )}
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Network className="w-4 h-4 text-accent" />
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editingPositionName}
                      onChange={(e) => setEditingPositionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSavePositionName(position.id);
                        if (e.key === "Escape") setEditingPositionId(null);
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSavePositionName(position.id)}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingPositionId(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-semibold truncate">{position.name}</span>
                )}
              </div>
              {isAdmin && !isEditing && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEditPosition(position)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeletePosition(position.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            {membersInPosition.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {membersInPosition.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {m.email}
                      {m.title && <span className="text-accent ml-1">• {m.title}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {membersInPosition.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">No members assigned</p>
            )}
          </div>
        </div>
        {children.map((child, i) => renderVisualPositionNode(child, depth + 1, i === children.length - 1))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {organization.name} - {t("org.settings")}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto">
            <TabsTrigger value="profile" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.profile")}</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.members")}</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.structure")}</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Ryhmät</span>
            </TabsTrigger>
            <TabsTrigger value="tags" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Tags className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.globalTags")}</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.notes")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <div className="space-y-2">
              <Label>{t("org.organizationName")}</Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            {isAdmin && (
              <Button onClick={handleSaveProfile} disabled={isSubmitting}>
                {t("common.save")}
              </Button>
            )}
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Customize your organization's brand colors. These colors will be visible to all members when viewing the organization dashboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <p className="text-xs text-muted-foreground">Used for the sidebar, header accents, and headings</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!isAdmin}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!isAdmin}
                    className="w-28 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <p className="text-xs text-muted-foreground">Used for buttons, links, and highlights</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!isAdmin}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!isAdmin}
                    className="w-28 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="rounded-lg border p-4 flex items-center gap-4"
                style={{ backgroundColor: primaryColor }}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "#fff" }}>{organization.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Organization Dashboard</p>
                </div>
                <div
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ backgroundColor: accentColor, color: "#fff" }}
                >
                  Action
                </div>
              </div>
            </div>

            {isAdmin && (
              <Button
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onUpdateOrg({ primary_color: primaryColor, accent_color: accentColor });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
              >
                Save Branding
              </Button>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            {isAdmin && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <Label>{t("org.inviteMember")}</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={t("share.emailPlaceholder")}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v: OrgRole) => setInviteRole(v)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">{t("org.roleViewer")}</SelectItem>
                      <SelectItem value="editor">{t("org.roleEditor")}</SelectItem>
                      <SelectItem value="admin">{t("org.roleAdmin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder={t("org.memberTitle")}
                    value={inviteTitle}
                    onChange={(e) => setInviteTitle(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={invitePositionId || "none"} onValueChange={(v) => setInvitePositionId(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t("org.assignPosition")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("org.noParent")}</SelectItem>
                      {(positions || []).map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendEmailInvite"
                    checked={sendEmailInvite}
                    onCheckedChange={(checked) => setSendEmailInvite(checked === true)}
                  />
                  <label htmlFor="sendEmailInvite" className="text-sm">
                    {t("org.sendEmailInvite")}
                  </label>
                </div>

                <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isSubmitting} className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  {t("share.sendInvite")}
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-auto">
              {(members || []).map((member) => {
                const RoleIcon = roleIcons[member.role];
                const position = (positions || []).find(p => p.id === member.position_id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <RoleIcon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(`org.role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`)}
                          {member.title && ` • ${member.title}`}
                          {position && ` • ${position.name}`}
                          {!member.accepted_at && ` (${t("org.pending")})`}
                        </p>
                      </div>
                    </div>
                    {isAdmin && member.role !== "owner" && (
                      <div className="flex items-center gap-1">
                        <MemberFolderAccessDialog
                          member={member}
                          folders={folders}
                          restrictions={folderRestrictions}
                          onAddRestriction={onAddFolderRestriction}
                          onRemoveRestriction={onRemoveFolderRestriction}
                        />
                        <Select
                          value={member.role}
                          onValueChange={(v: OrgRole) => onUpdateMemberRole(member.id, v)}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">{t("org.roleViewer")}</SelectItem>
                            <SelectItem value="editor">{t("org.roleEditor")}</SelectItem>
                            <SelectItem value="admin">{t("org.roleAdmin")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => onRemoveMember(member.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Structure Tab */}
          <TabsContent value="structure" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("org.positions")}
              </p>
              {positions && positions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => downloadOrgStructure(organization.name, positions, members || [])}
                >
                  <Download className="w-3 h-3" />
                  {t("org.exportStructure")}
                </Button>
              )}
            </div>

            {isAdmin && (
              <div className="flex gap-2 p-3 rounded-lg border bg-muted/30">
                <Input
                  placeholder={t("org.positionName")}
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  className="flex-1"
                />
                <Select value={newPositionParentId || "none"} onValueChange={(v) => setNewPositionParentId(v === "none" ? "" : v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("org.parentPosition")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("org.noParent")}</SelectItem>
                    {(positions || []).map((pos) => (
                      <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddPosition} disabled={!newPositionName.trim() || isSubmitting}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Root-level drop zone */}
            {draggedPositionId && (
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverPositionId("root"); }}
                onDragLeave={() => setDragOverPositionId(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(null); }}
                className={`border-2 border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground transition-colors ${
                  dragOverPositionId === "root" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                Drop here to make root-level
              </div>
            )}

            <div className="space-y-1 overflow-x-auto pb-4">
              {buildPositionTree(null).map((position, i, arr) => renderVisualPositionNode(position, 0, i === arr.length - 1))}
              {(!positions || positions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("folder.noTags")}
                </p>
              )}
            </div>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Luo ryhmiä, jotka kokoavat yhteen organisaation positioita. Ryhmiä voi käyttää BPMN-kaavioissa uimaratojen ja tehtävien suorittajina.
            </p>

            {isAdmin && (
              <div className="flex gap-2 p-3 rounded-lg border bg-muted/30">
                <Input
                  placeholder="Ryhmän nimi (esim. Johtoryhmä)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      onCreateGroup(newGroupName.trim());
                      setNewGroupName("");
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (newGroupName.trim()) {
                      onCreateGroup(newGroupName.trim());
                      setNewGroupName("");
                    }
                  }}
                  disabled={!newGroupName.trim() || isSubmitting}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {groups.map((group) => {
                const isEditing = editingGroupId === group.id;
                const groupPositionNames = group.position_ids
                  .map(pid => positions.find(p => p.id === pid)?.name)
                  .filter(Boolean);

                return (
                  <div key={group.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <UsersRound className="w-5 h-5 text-primary" />
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingGroupName.trim()) {
                                  onUpdateGroup(group.id, { name: editingGroupName.trim() });
                                  setEditingGroupId(null);
                                }
                                if (e.key === "Escape") setEditingGroupId(null);
                              }}
                              className="h-7 text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                if (editingGroupName.trim()) {
                                  onUpdateGroup(group.id, { name: editingGroupName.trim() });
                                  setEditingGroupId(null);
                                }
                              }}
                              className="text-primary hover:text-primary/80"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingGroupId(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-semibold text-sm">{group.name}</span>
                        )}
                      </div>
                      {isAdmin && !isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingGroupId(group.id);
                              setEditingGroupName(group.name);
                            }}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDeleteGroup(group.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Position chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {groupPositionNames.map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/20 text-accent-foreground text-xs">
                          {name}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                const posId = group.position_ids.find(pid => positions.find(p => p.id === pid)?.name === name);
                                if (posId) onRemoveGroupPosition(group.id, posId);
                              }}
                              className="hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      {groupPositionNames.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Ei positioita lisätty</p>
                      )}
                    </div>

                    {/* Add position to group */}
                    {isAdmin && positions.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(posId) => {
                          if (posId && !group.position_ids.includes(posId)) {
                            onAddGroupPosition(group.id, posId);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-48">
                          <SelectValue placeholder="Lisää positio ryhmään..." />
                        </SelectTrigger>
                        <SelectContent>
                          {positions
                            .filter(p => !group.position_ids.includes(p.id))
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ei ryhmiä vielä. Luo ensimmäinen ryhmä yllä.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Global Tags Tab */}
          <TabsContent value="tags" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("org.globalTagsHelp")}
            </p>

            {(currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "editor") && (
              <div className="flex gap-2">
                <Input
                  placeholder={t("folder.addTagPlaceholder")}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                />
                <Button onClick={handleAddTag} disabled={!newTag.trim() || isSubmitting}>
                  {t("common.create")}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-accent-foreground text-sm"
                >
                  {tag.tag_name}
                  {(currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "editor") && (
                    <button
                      onClick={() => onRemoveTag(tag.id)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("folder.noTags")}</p>
              )}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <Textarea
              placeholder={t("org.notesPlaceholder")}
              value={orgNotes}
              onChange={(e) => setOrgNotes(e.target.value)}
              disabled={!isAdmin}
              rows={8}
              className="resize-none"
            />
            {isAdmin && (
              <Button onClick={handleSaveProfile} disabled={isSubmitting}>
                {t("common.save")}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
