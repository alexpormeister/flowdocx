import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Shield, Search, ArrowLeft, UserPlus, Building2, Crown, Trash2, Users,
  Activity, FileText, Settings, BarChart3, Archive, RotateCcw, Pause, Play,
  AlertTriangle, Clock, Layers, Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminOrganizations, suspendOrganization, unsuspendOrganization,
  getOrgQuotas, upsertOrgQuotas, getOrgFeatureFlags, toggleFeatureFlag,
  getAuditLogs, getDeletedOrganizations, archiveOrganization, restoreOrganization,
  getUsageMetrics, AVAILABLE_FEATURES,
  type AdminOrg, type AuditLog, type DeletedOrg,
} from "@/lib/superAdminApi";
import { format } from "date-fns";

// --- Types ---
interface UserProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  organizations: { id: string; name: string; role: string }[];
  is_superadmin: boolean;
}

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("organizations");

  // Check superadmin
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-superadmin"],
    queryFn: async () => {
      const { data } = await supabase.from("superadmins").select("id").eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  if (authLoading || checkingAdmin) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Ladataan...</div></div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md"><CardContent className="p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Pääsy estetty</h2>
          <p className="text-muted-foreground mb-4">Sinulla ei ole superadmin-oikeuksia.</p>
          <Button onClick={() => navigate("/")}>Takaisin</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Superadmin Panel</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="organizations" className="gap-1.5"><Building2 className="w-4 h-4" />Organisaatiot</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" />Käyttäjät</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5"><FileText className="w-4 h-4" />Audit Log</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-4 h-4" />Analytiikka</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5"><Layers className="w-4 h-4" />Mallipohjat</TabsTrigger>
            <TabsTrigger value="recovery" className="gap-1.5"><RotateCcw className="w-4 h-4" />Palautus</TabsTrigger>
          </TabsList>

          <TabsContent value="organizations"><OrganizationsTab /></TabsContent>
          <TabsContent value="users"><UsersTab user={user!} /></TabsContent>
          <TabsContent value="audit"><AuditTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab user={user!} /></TabsContent>
          <TabsContent value="recovery"><RecoveryTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ======================== ORGANIZATIONS TAB ========================
function OrganizationsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<AdminOrg | null>(null);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [featureFlagDialogOpen, setFeatureFlagDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: getAdminOrganizations,
  });

  // Get member/project counts
  const { data: memberCounts = {} } = useQuery({
    queryKey: ["admin-org-member-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("organization_members").select("organization_id");
      const counts: Record<string, number> = {};
      (data || []).forEach(m => { counts[m.organization_id] = (counts[m.organization_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: projectCounts = {} } = useQuery({
    queryKey: ["admin-org-project-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("organization_id").not("organization_id", "is", null);
      const counts: Record<string, number> = {};
      (data || []).forEach(p => { if (p.organization_id) counts[p.organization_id] = (counts[p.organization_id] || 0) + 1; });
      return counts;
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ orgId, suspend }: { orgId: string; suspend: boolean }) => {
      if (suspend) await suspendOrganization(orgId, suspendReason);
      else await unsuspendOrganization(orgId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      setSuspendDialogOpen(false);
      toast.success("Organisaation tila päivitetty");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      setArchiveDialogOpen(false);
      toast.success("Organisaatio arkistoitu ja voidaan palauttaa Palautus-välilehdeltä");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const filtered = orgs.filter(o => !search.trim() || o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hae organisaatiota..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Badge variant="outline">{orgs.length} organisaatiota</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisaatio</TableHead>
                <TableHead>Tila</TableHead>
                <TableHead>Jäsenet</TableHead>
                <TableHead>Projektit</TableHead>
                <TableHead>Luotu</TableHead>
                <TableHead className="text-right">Toiminnot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Ladataan...</TableCell></TableRow>
              ) : filtered.map(org => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{org.name}</p>
                      {org.business_id && <p className="text-xs text-muted-foreground">{org.business_id}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(org as any).suspended_at ? (
                      <Badge variant="destructive" className="gap-1"><Pause className="w-3 h-3" />Jäädytetty</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800"><Play className="w-3 h-3" />Aktiivinen</Badge>
                    )}
                  </TableCell>
                  <TableCell>{memberCounts[org.id] || 0}</TableCell>
                  <TableCell>{projectCounts[org.id] || 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(org.created_at), "d.M.yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedOrg(org); setQuotaDialogOpen(true); }}>
                        <Settings className="w-3 h-3 mr-1" />Kiintiöt
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedOrg(org); setFeatureFlagDialogOpen(true); }}>
                        <Eye className="w-3 h-3 mr-1" />Ominaisuudet
                      </Button>
                      <Button
                        variant={(org as any).suspended_at ? "default" : "outline"}
                        size="sm" className="text-xs h-7"
                        onClick={() => {
                          setSelectedOrg(org);
                          if ((org as any).suspended_at) {
                            suspendMutation.mutate({ orgId: org.id, suspend: false });
                          } else {
                            setSuspendReason("");
                            setSuspendDialogOpen(true);
                          }
                        }}
                      >
                        {(org as any).suspended_at ? <><Play className="w-3 h-3 mr-1" />Aktivoi</> : <><Pause className="w-3 h-3 mr-1" />Jäädytä</>}
                      </Button>
                      <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => { setSelectedOrg(org); setArchiveDialogOpen(true); }}>
                        <Archive className="w-3 h-3 mr-1" />Arkistoi
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jäädytä organisaatio</DialogTitle>
            <DialogDescription>Organisaatio "{selectedOrg?.name}" jäädytetään. Käyttäjät eivät voi käyttää sitä.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Syy jäädytykselle..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => selectedOrg && suspendMutation.mutate({ orgId: selectedOrg.id, suspend: true })} disabled={suspendMutation.isPending}>
              Jäädytä
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arkistoi organisaatio</DialogTitle>
            <DialogDescription>
              Organisaatio "{selectedOrg?.name}" arkistoidaan. Kaikki data tallennetaan ja voidaan palauttaa myöhemmin.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm">Tämä poistaa organisaation käytöstä. Palautus onnistuu Palautus-välilehdeltä.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>Peruuta</Button>
            <Button variant="destructive" onClick={() => selectedOrg && archiveMutation.mutate(selectedOrg.id)} disabled={archiveMutation.isPending}>
              Arkistoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotas Dialog */}
      {selectedOrg && <QuotasDialog orgId={selectedOrg.id} orgName={selectedOrg.name} open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen} />}

      {/* Feature Flags Dialog */}
      {selectedOrg && <FeatureFlagsDialog orgId={selectedOrg.id} orgName={selectedOrg.name} open={featureFlagDialogOpen} onOpenChange={setFeatureFlagDialogOpen} />}
    </div>
  );
}

function QuotasDialog({ orgId, orgName, open, onOpenChange }: { orgId: string; orgName: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [maxProjects, setMaxProjects] = useState(50);
  const [maxUsers, setMaxUsers] = useState(20);
  const [maxSystems, setMaxSystems] = useState(30);

  const { data: quotas } = useQuery({
    queryKey: ["admin-quotas", orgId],
    queryFn: () => getOrgQuotas(orgId),
    enabled: open,
  });

  useEffect(() => {
    if (quotas) {
      setMaxProjects(quotas.max_projects);
      setMaxUsers(quotas.max_users);
      setMaxSystems(quotas.max_systems);
    }
  }, [quotas]);

  const saveMutation = useMutation({
    mutationFn: () => upsertOrgQuotas(orgId, { max_projects: maxProjects, max_users: maxUsers, max_systems: maxSystems }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quotas", orgId] });
      toast.success("Kiintiöt päivitetty");
      onOpenChange(false);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kiintiöt: {orgName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Max projektit</label>
            <Input type="number" value={maxProjects} onChange={e => setMaxProjects(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max käyttäjät</label>
            <Input type="number" value={maxUsers} onChange={e => setMaxUsers(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max järjestelmät</label>
            <Input type="number" value={maxSystems} onChange={e => setMaxSystems(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Tallenna</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureFlagsDialog({ orgId, orgName, open, onOpenChange }: { orgId: string; orgName: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();

  const { data: flags = [] } = useQuery({
    queryKey: ["admin-feature-flags", orgId],
    queryFn: () => getOrgFeatureFlags(orgId),
    enabled: open,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => toggleFeatureFlag(orgId, key, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags", orgId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const getFlagState = (key: string) => {
    const flag = flags.find(f => f.feature_key === key);
    return flag ? flag.enabled : true; // Default enabled
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ominaisuudet: {orgName}</DialogTitle>
          <DialogDescription>Kytke ominaisuuksia päälle tai pois organisaatiokohtaisesti.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {AVAILABLE_FEATURES.map(f => (
            <div key={f.key} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{f.label}</span>
              <Switch
                checked={getFlagState(f.key)}
                onCheckedChange={(checked) => toggleMutation.mutate({ key: f.key, enabled: checked })}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ======================== USERS TAB ========================
function UsersTab({ user }: { user: { id: string } }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addToOrgDialogOpen, setAddToOrgDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [selectedOrgForAdd, setSelectedOrgForAdd] = useState("");
  const [selectedRoleForAdd, setSelectedRoleForAdd] = useState("viewer");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-all-users", search],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, created_at");
      const { data: memberships } = await supabase.from("organization_members").select("user_id, organization_id, role, email");
      const { data: orgs } = await supabase.from("organizations").select("id, name");
      const { data: superadmins } = await supabase.from("superadmins").select("user_id");

      const orgMap = new Map((orgs || []).map(o => [o.id, o.name]));
      const superadminSet = new Set((superadmins || []).map(s => s.user_id));
      const userMap = new Map<string, UserProfile>();

      for (const p of profiles || []) {
        userMap.set(p.user_id, { user_id: p.user_id, email: "", display_name: p.display_name, created_at: p.created_at, organizations: [], is_superadmin: superadminSet.has(p.user_id) });
      }
      for (const m of memberships || []) {
        if (m.user_id) {
          const existing = userMap.get(m.user_id);
          if (existing) {
            if (!existing.email && m.email) existing.email = m.email;
            existing.organizations.push({ id: m.organization_id, name: orgMap.get(m.organization_id) || "Unknown", role: m.role });
          } else {
            userMap.set(m.user_id, { user_id: m.user_id, email: m.email, display_name: null, created_at: "", organizations: [{ id: m.organization_id, name: orgMap.get(m.organization_id) || "Unknown", role: m.role }], is_superadmin: superadminSet.has(m.user_id) });
          }
        }
      }

      let result = Array.from(userMap.values());
      if (search.trim()) {
        const q = search.toLowerCase();
        result = result.filter(u => u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.organizations.some(o => o.name.toLowerCase().includes(q)));
      }
      return result.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    },
  });

  const { data: allOrgs = [] } = useQuery({
    queryKey: ["admin-all-orgs"],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("id, name").order("name");
      return data || [];
    },
  });

  const toggleSuperadminMutation = useMutation({
    mutationFn: async ({ userId, email, add }: { userId: string; email: string; add: boolean }) => {
      if (add) { await supabase.from("superadmins").insert({ user_id: userId, email, granted_by: user.id }); }
      else { await supabase.from("superadmins").delete().eq("user_id", userId); }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-all-users"] }); toast.success("Superadmin-oikeus päivitetty"); },
    onError: (err) => toast.error((err as Error).message),
  });

  const addToOrgMutation = useMutation({
    mutationFn: async ({ orgId, email, role }: { orgId: string; email: string; role: string }) => {
      const { error } = await supabase.from("organization_members").insert({ organization_id: orgId, email, role: role as any, invited_by: user.id, user_id: selectedUserId, accepted_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-all-users"] }); setAddToOrgDialogOpen(false); toast.success("Käyttäjä lisätty organisaatioon"); },
    onError: (err) => toast.error((err as Error).message),
  });

  const removeFromOrgMutation = useMutation({
    mutationFn: async ({ userId, orgId }: { userId: string; orgId: string }) => {
      const { error } = await supabase.from("organization_members").delete().eq("user_id", userId).eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-all-users"] }); toast.success("Käyttäjä poistettu organisaatiosta"); },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hae käyttäjää..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{users.length} käyttäjää</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-muted-foreground">Ladataan...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Käyttäjä</TableHead>
                  <TableHead>Organisaatiot</TableHead>
                  <TableHead>Rooli</TableHead>
                  <TableHead className="text-right">Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {u.display_name || "—"}
                          {u.is_superadmin && <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0"><Crown className="w-3 h-3 mr-0.5" />SA</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email || "Ei sähköpostia"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.organizations.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : u.organizations.map(o => (
                          <div key={o.id} className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-[10px] gap-1"><Building2 className="w-3 h-3" />{o.name} <span className="text-muted-foreground">({o.role})</span></Badge>
                            <button onClick={() => removeFromOrgMutation.mutate({ userId: u.user_id, orgId: o.id })} className="text-destructive/60 hover:text-destructive p-0.5" title="Poista"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant={u.is_superadmin ? "destructive" : "outline"} size="sm" className="text-xs h-7"
                        onClick={() => toggleSuperadminMutation.mutate({ userId: u.user_id, email: u.email, add: !u.is_superadmin })}
                        disabled={u.user_id === user.id}
                      >
                        <Crown className="w-3 h-3 mr-1" />{u.is_superadmin ? "Poista SA" : "Tee SA"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedUserId(u.user_id); setSelectedUserEmail(u.email); setSelectedOrgForAdd(""); setSelectedRoleForAdd("viewer"); setAddToOrgDialogOpen(true); }}>
                        <UserPlus className="w-3 h-3 mr-1" />Lisää org:iin
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addToOrgDialogOpen} onOpenChange={setAddToOrgDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lisää käyttäjä organisaatioon</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Käyttäjä: <strong>{selectedUserEmail}</strong></p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Organisaatio</label>
              <Select value={selectedOrgForAdd} onValueChange={setSelectedOrgForAdd}>
                <SelectTrigger><SelectValue placeholder="Valitse organisaatio" /></SelectTrigger>
                <SelectContent>{allOrgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rooli</label>
              <Select value={selectedRoleForAdd} onValueChange={setSelectedRoleForAdd}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addToOrgMutation.mutate({ orgId: selectedOrgForAdd, email: selectedUserEmail, role: selectedRoleForAdd })} disabled={!selectedOrgForAdd || addToOrgMutation.isPending}>Lisää</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================== AUDIT TAB ========================
function AuditTab() {
  const [actionFilter, setActionFilter] = useState<string>("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-logs", actionFilter],
    queryFn: () => getAuditLogs({ action: actionFilter || undefined, limit: 200 }),
  });

  const actionLabels: Record<string, string> = {
    delete: "Poisto",
    add_member: "Jäsen lisätty",
    remove_member: "Jäsen poistettu",
    change_role: "Rooli muutettu",
  };

  const actionColors: Record<string, string> = {
    delete: "destructive",
    remove_member: "destructive",
    add_member: "secondary",
    change_role: "outline",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Kaikki tapahtumat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kaikki tapahtumat</SelectItem>
            <SelectItem value="delete">Poistot</SelectItem>
            <SelectItem value="add_member">Jäsen lisätty</SelectItem>
            <SelectItem value="remove_member">Jäsen poistettu</SelectItem>
            <SelectItem value="change_role">Rooli muutettu</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline"><FileText className="w-3 h-3 mr-1" />{logs.length} tapahtumaa</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-muted-foreground">Ladataan...</div> : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Ei lokitapahtumia</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aika</TableHead>
                  <TableHead>Toiminto</TableHead>
                  <TableHead>Kohde</TableHead>
                  <TableHead>Tiedot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(log.created_at), "d.M.yyyy HH:mm")}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(actionColors[log.action] as any) || "outline"} className="text-[10px]">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{log.entity_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{log.entity_type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-xs text-muted-foreground bg-muted/50 p-1 rounded max-w-xs overflow-hidden">
                          {JSON.stringify(log.details, null, 1)}
                        </pre>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== ANALYTICS TAB ========================
function AnalyticsTab() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-usage-metrics"],
    queryFn: getUsageMetrics,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Ladataan analytiikkaa...</div>;
  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{metrics.total_orgs}</p>
          <p className="text-xs text-muted-foreground">Organisaatiot</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{metrics.total_users}</p>
          <p className="text-xs text-muted-foreground">Käyttäjät</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{metrics.total_projects}</p>
          <p className="text-xs text-muted-foreground">Projektit yht.</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{metrics.recent_projects_30d}</p>
          <p className="text-xs text-muted-foreground">Uudet (30pv)</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Organisaatioiden aktiivisuus</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisaatio</TableHead>
                <TableHead>Projektit</TableHead>
                <TableHead>Jäsenet</TableHead>
                <TableHead>Viimeisin aktiviteetti</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.org_stats.map(os => (
                <TableRow key={os.org_id}>
                  <TableCell className="font-medium text-sm">{os.org_name}</TableCell>
                  <TableCell>{os.project_count}</TableCell>
                  <TableCell>{os.member_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(os.last_activity), "d.M.yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== TEMPLATES TAB ========================
function TemplatesTab({ user }: { user: { id: string } }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newBpmn, setNewBpmn] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("is_template", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-templates"] }); toast.success("Mallipohja poistettu"); },
    onError: (err) => toast.error((err as Error).message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const defaultBpmn = newBpmn || `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="StartEvent_1" /></bpmn:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"><bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="173" y="102" width="36" height="36" /></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
      const { error } = await supabase.from("projects").insert({
        name: newName,
        bpmn_xml: defaultBpmn,
        user_id: user.id,
        is_template: true,
        template_category: newCategory || null,
        status: "published",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
      setNewName("");
      setNewCategory("");
      setNewBpmn("");
      toast.success("Mallipohja luotu");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Luo uusi mallipohja</CardTitle>
          <CardDescription>Mallipohjat näkyvät kaikille käyttäjille uuden projektin luonnissa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Mallipohjan nimi" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="Kategoria (valinnainen)" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
          </div>
          <Textarea placeholder="BPMN XML (valinnainen, jätä tyhjäksi oletuspohjalle)" value={newBpmn} onChange={e => setNewBpmn(e.target.value)} rows={3} />
          <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>Luo mallipohja</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nykyiset mallipohjat ({templates.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-muted-foreground">Ladataan...</div> : templates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Ei mallipohjia</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nimi</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Luotu</TableHead>
                  <TableHead className="text-right">Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{t.template_category || "Yleinen"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "d.M.yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => deleteMutation.mutate(t.id)}>
                        <Trash2 className="w-3 h-3 mr-1" />Poista
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================== RECOVERY TAB ========================
function RecoveryTab() {
  const queryClient = useQueryClient();

  const { data: deletedOrgs = [], isLoading } = useQuery({
    queryKey: ["admin-deleted-orgs"],
    queryFn: getDeletedOrganizations,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deleted-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      toast.success("Organisaatio palautettu onnistuneesti!");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="w-5 h-5" />Poistetut organisaatiot</CardTitle>
          <CardDescription>Palauta vahingossa poistetut organisaatiot kaikkine kaavioiden ja jäsenien kanssa.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-muted-foreground">Ladataan...</div> : deletedOrgs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Ei poistettuja organisaatioita</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisaatio</TableHead>
                  <TableHead>Projekteja</TableHead>
                  <TableHead>Jäseniä</TableHead>
                  <TableHead>Poistettu</TableHead>
                  <TableHead className="text-right">Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedOrgs.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">{(d.org_data as any)?.name || "Tuntematon"}</TableCell>
                    <TableCell>{(d.projects_data as any[])?.length || 0}</TableCell>
                    <TableCell>{(d.members_data as any[])?.length || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(d.deleted_at), "d.M.yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" className="text-xs h-7 gap-1" onClick={() => restoreMutation.mutate(d.id)} disabled={restoreMutation.isPending}>
                        <RotateCcw className="w-3 h-3" />Bring back to life
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
