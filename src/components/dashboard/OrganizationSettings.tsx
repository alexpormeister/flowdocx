import { useState } from "react";
import { Settings, Users, Tags, Building2, Trash2, Crown, Shield, Edit3, Eye, Mail, X, Plus, Network, FileText, Download, FolderOpen } from "lucide-react";
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
import type { Organization, OrganizationMember, OrganizationSystemTag, OrgRole, OrganizationPosition, MemberFolderRestriction } from "@/lib/organizationApi";
import type { Folder } from "@/lib/api";
import { MemberFolderAccessDialog } from "./MemberFolderAccessDialog";

interface OrganizationSettingsProps {
  organization: Organization;
  members: OrganizationMember[];
  tags: OrganizationSystemTag[];
  positions: OrganizationPosition[];
  folders: Folder[];
  folderRestrictions: MemberFolderRestriction[];
  currentUserRole: OrgRole | null;
  onUpdateOrg: (updates: { name?: string; notes?: string }) => Promise<void>;
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

  const renderPositionNode = (position: OrganizationPosition, depth: number = 0) => {
    const children = buildPositionTree(position.id);
    const membersInPosition = (members || []).filter(m => m.position_id === position.id);
    
    return (
      <div key={position.id} className="space-y-1">
        <div 
          className="flex items-center justify-between p-2 rounded-md bg-muted hover:bg-muted/80"
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{position.name}</span>
            {membersInPosition.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({membersInPosition.map(m => m.email).join(", ")})
              </span>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => onDeletePosition(position.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {children.map(child => renderPositionNode(child, depth + 1))}
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
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
            <TabsTrigger value="profile" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.profile")}</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.members")}</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="text-xs flex flex-col sm:flex-row gap-1 py-2">
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">{t("org.structure")}</span>
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
                      <div className="flex items-center gap-2">
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

            <div className="space-y-2">
              {buildPositionTree(null).map(position => renderPositionNode(position))}
              {(!positions || positions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("folder.noTags")}
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
