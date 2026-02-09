import { useState } from "react";
import { Settings, Users, Tags, Building2, Trash2, Crown, Shield, Edit3, Eye, Mail, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Organization, OrganizationMember, OrganizationSystemTag, OrgRole } from "@/lib/organizationApi";

interface OrganizationSettingsProps {
  organization: Organization;
  members: OrganizationMember[];
  tags: OrganizationSystemTag[];
  currentUserRole: OrgRole | null;
  onUpdateOrg: (updates: { name?: string; business_id?: string }) => Promise<void>;
  onInviteMember: (email: string, role: OrgRole) => Promise<void>;
  onUpdateMemberRole: (memberId: string, role: OrgRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onAddTag: (tagName: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
}

const roleIcons: Record<OrgRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  editor: Edit3,
  viewer: Eye,
};

export function OrganizationSettings({
  organization,
  members,
  tags,
  currentUserRole,
  onUpdateOrg,
  onInviteMember,
  onUpdateMemberRole,
  onRemoveMember,
  onAddTag,
  onRemoveTag,
}: OrganizationSettingsProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [orgName, setOrgName] = useState(organization.name);
  const [businessId, setBusinessId] = useState(organization.business_id || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("viewer");
  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  const handleSaveProfile = async () => {
    setIsSubmitting(true);
    try {
      await onUpdateOrg({ name: orgName, business_id: businessId || undefined });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsSubmitting(true);
    try {
      await onInviteMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {organization.name} - {t("org.settings")}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">
              <Building2 className="w-4 h-4 mr-2" />
              {t("org.profile")}
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              {t("org.members")}
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tags className="w-4 h-4 mr-2" />
              {t("org.globalTags")}
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
            <div className="space-y-2">
              <Label>{t("org.businessId")}</Label>
              <Input
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
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
                <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isSubmitting} className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  {t("share.sendInvite")}
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-auto">
              {members.map((member) => {
                const RoleIcon = roleIcons[member.role];
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
