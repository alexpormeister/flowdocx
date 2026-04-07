import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Search, ArrowLeft, UserPlus, Building2, Crown, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  organizations: { id: string; name: string; role: string }[];
  is_superadmin: boolean;
}

interface OrgOption {
  id: string;
  name: string;
}

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addToOrgDialogOpen, setAddToOrgDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");
  const [selectedOrgForAdd, setSelectedOrgForAdd] = useState<string>("");
  const [selectedRoleForAdd, setSelectedRoleForAdd] = useState<string>("viewer");

  // Check if current user is superadmin
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-superadmin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("superadmins")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch all users with their profiles and org memberships
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-all-users", search],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, created_at");
      if (profilesError) throw profilesError;

      // Get all org memberships
      const { data: memberships, error: membError } = await supabase
        .from("organization_members")
        .select("user_id, organization_id, role, email");
      if (membError) throw membError;

      // Get all orgs
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name");
      if (orgsError) throw orgsError;

      const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

      // Get superadmins
      const { data: superadmins } = await supabase.from("superadmins").select("user_id");
      const superadminSet = new Set((superadmins || []).map((s) => s.user_id));

      // Build user list from memberships (which have emails)
      const userMap = new Map<string, UserProfile>();

      // Add from profiles first
      for (const p of profiles || []) {
        userMap.set(p.user_id, {
          user_id: p.user_id,
          email: "",
          display_name: p.display_name,
          created_at: p.created_at,
          organizations: [],
          is_superadmin: superadminSet.has(p.user_id),
        });
      }

      // Add org info from memberships
      for (const m of memberships || []) {
        if (m.user_id) {
          const existing = userMap.get(m.user_id);
          if (existing) {
            if (!existing.email && m.email) existing.email = m.email;
            existing.organizations.push({
              id: m.organization_id,
              name: orgMap.get(m.organization_id) || "Unknown",
              role: m.role,
            });
          } else {
            userMap.set(m.user_id, {
              user_id: m.user_id,
              email: m.email,
              display_name: null,
              created_at: "",
              organizations: [{
                id: m.organization_id,
                name: orgMap.get(m.organization_id) || "Unknown",
                role: m.role,
              }],
              is_superadmin: superadminSet.has(m.user_id),
            });
          }
        }
      }

      let result = Array.from(userMap.values());

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        result = result.filter(
          (u) =>
            u.email?.toLowerCase().includes(q) ||
            u.display_name?.toLowerCase().includes(q) ||
            u.organizations.some((o) => o.name.toLowerCase().includes(q))
        );
      }

      return result.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    },
    enabled: !!user && isSuperAdmin === true,
  });

  // All organizations for the "add to org" dialog
  const { data: allOrgs = [] } = useQuery({
    queryKey: ["admin-all-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      return data as OrgOption[];
    },
    enabled: !!user && isSuperAdmin === true,
  });

  // Toggle superadmin
  const toggleSuperadminMutation = useMutation({
    mutationFn: async ({ userId, email, add }: { userId: string; email: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("superadmins").insert({
          user_id: userId,
          email,
          granted_by: user!.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("superadmins").delete().eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Superadmin-oikeus päivitetty");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  // Add user to organization
  const addToOrgMutation = useMutation({
    mutationFn: async ({
      orgId,
      email,
      role,
    }: {
      orgId: string;
      email: string;
      role: string;
    }) => {
      const { error } = await supabase.from("organization_members").insert({
        organization_id: orgId,
        email,
        role: role as any,
        invited_by: user!.id,
        user_id: selectedUserId,
        accepted_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      setAddToOrgDialogOpen(false);
      toast.success("Käyttäjä lisätty organisaatioon");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  // Remove user from organization
  const removeFromOrgMutation = useMutation({
    mutationFn: async ({ userId, orgId }: { userId: string; orgId: string }) => {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Käyttäjä poistettu organisaatiosta");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Ladataan...</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Pääsy estetty</h2>
            <p className="text-muted-foreground mb-4">Sinulla ei ole superadmin-oikeuksia.</p>
            <Button onClick={() => navigate("/")}>Takaisin</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOpenAddToOrg = (userId: string, email: string) => {
    setSelectedUserId(userId);
    setSelectedUserEmail(email);
    setSelectedOrgForAdd("");
    setSelectedRoleForAdd("viewer");
    setAddToOrgDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Superadmin Panel</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {users.length} käyttäjää
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hae käyttäjää nimellä, sähköpostilla tai organisaatiolla..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Käyttäjät</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{allOrgs.length}</p>
              <p className="text-xs text-muted-foreground">Organisaatiot</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{users.filter((u) => u.is_superadmin).length}</p>
              <p className="text-xs text-muted-foreground">Superadminit</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {users.filter((u) => u.organizations.length === 0).length}
              </p>
              <p className="text-xs text-muted-foreground">Ilman organisaatiota</p>
            </CardContent>
          </Card>
        </div>

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Käyttäjähallinta</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="py-8 text-center text-muted-foreground">Ladataan käyttäjiä...</div>
            ) : (
              <div className="overflow-x-auto">
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
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {u.display_name || "—"}
                              {u.is_superadmin && (
                                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                                  <Crown className="w-3 h-3 mr-0.5" />
                                  SA
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email || "Ei sähköpostia"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.organizations.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              u.organizations.map((o) => (
                                <div key={o.id} className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[10px] gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {o.name}
                                    <span className="text-muted-foreground">({o.role})</span>
                                  </Badge>
                                  <button
                                    onClick={() => removeFromOrgMutation.mutate({ userId: u.user_id, orgId: o.id })}
                                    className="text-destructive/60 hover:text-destructive p-0.5"
                                    title="Poista organisaatiosta"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={u.is_superadmin ? "destructive" : "outline"}
                            size="sm"
                            className="text-xs h-7"
                            onClick={() =>
                              toggleSuperadminMutation.mutate({
                                userId: u.user_id,
                                email: u.email,
                                add: !u.is_superadmin,
                              })
                            }
                            disabled={u.user_id === user?.id}
                          >
                            <Crown className="w-3 h-3 mr-1" />
                            {u.is_superadmin ? "Poista SA" : "Tee SA"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleOpenAddToOrg(u.user_id, u.email)}
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Lisää org:iin
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add to org dialog */}
      <Dialog open={addToOrgDialogOpen} onOpenChange={setAddToOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lisää käyttäjä organisaatioon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Käyttäjä: <strong>{selectedUserEmail}</strong>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Organisaatio</label>
              <Select value={selectedOrgForAdd} onValueChange={setSelectedOrgForAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Valitse organisaatio" />
                </SelectTrigger>
                <SelectContent>
                  {allOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rooli</label>
              <Select value={selectedRoleForAdd} onValueChange={setSelectedRoleForAdd}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button
              onClick={() =>
                addToOrgMutation.mutate({
                  orgId: selectedOrgForAdd,
                  email: selectedUserEmail,
                  role: selectedRoleForAdd,
                })
              }
              disabled={!selectedOrgForAdd || addToOrgMutation.isPending}
            >
              Lisää
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
