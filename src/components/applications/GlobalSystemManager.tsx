import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, updateProject, type Project } from "@/lib/api";
import { getOrganizationTags, removeOrganizationTag, updateOrganizationTag, type OrganizationSystemTag } from "@/lib/organizationApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, ServerCog, GitBranch, ListChecks, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type SystemUsage = {
  name: string;
  tag?: OrganizationSystemTag;
  projects: { project: Project; steps: { id: string; step: number; task: string; performer?: string }[] }[];
  stepCount: number;
};

export default function GlobalSystemManager({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SystemUsage | null>(null);
  const [newName, setNewName] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: getProjects, enabled: !!user });
  const { data: tags = [] } = useQuery({ queryKey: ["org-tags", orgId], queryFn: () => getOrganizationTags(orgId), enabled: !!user && !!orgId });

  const orgProjects = useMemo(
    () => projects.filter((project) => project.organization_id === orgId && !project.is_template),
    [projects, orgId],
  );

  const systems = useMemo<SystemUsage[]>(() => {
    const map = new Map<string, SystemUsage>();
    const getItem = (name: string) => {
      if (!map.has(name)) map.set(name, { name, tag: tags.find((tag) => tag.tag_name === name), projects: [], stepCount: 0 });
      return map.get(name)!;
    };

    tags.forEach((tag) => getItem(tag.tag_name));

    orgProjects.forEach((project) => {
      const projectSystems = new Map<string, { id: string; step: number; task: string; performer?: string }[]>();
      project.process_steps.forEach((step) => {
        (step.system || []).forEach((system) => {
          if (!projectSystems.has(system)) projectSystems.set(system, []);
          projectSystems.get(system)!.push({ id: step.id, step: step.step, task: step.task || "Nimetön vaihe", performer: step.performer });
        });
      });

      project.system_tags.forEach((system) => {
        if (!projectSystems.has(system)) projectSystems.set(system, []);
      });

      projectSystems.forEach((steps, name) => {
        const item = getItem(name);
        item.projects.push({ project, steps });
        item.stepCount += steps.length;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.stepCount - a.stepCount || a.name.localeCompare(b.name));
  }, [orgProjects, tags]);

  const filteredSystems = useMemo(
    () => systems.filter((system) => system.name.toLowerCase().includes(search.toLowerCase().trim())),
    [systems, search],
  );

  const openEdit = (system: SystemUsage) => {
    setSelected(system);
    setNewName(system.name);
    setDescription((system.tag as any)?.description || "");
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const cleanName = newName.trim();
      if (!cleanName) throw new Error("Järjestelmän nimi ei voi olla tyhjä.");
      const targetTag = tags.find((tag) => tag.tag_name.toLowerCase() === cleanName.toLowerCase());
      const isMergingToExistingTag = !!targetTag && targetTag.id !== selected.tag?.id;

      await Promise.all(
        selected.projects.map(({ project }) => {
          const nextSteps = project.process_steps.map((step) => ({
            ...step,
            system: Array.from(new Set((step.system || []).map((system) => (system === selected.name ? cleanName : system)))),
          }));
          const nextTags = Array.from(new Set((project.system_tags || []).map((system) => (system === selected.name ? cleanName : system))));
          return updateProject(project.id, { process_steps: nextSteps, system_tags: nextTags });
        }),
      );

      if (isMergingToExistingTag) {
        if (description.trim()) await updateOrganizationTag(targetTag.id, { description: description.trim() });
        if (selected.tag) await removeOrganizationTag(selected.tag.id);
      } else if (selected.tag) {
        await updateOrganizationTag(selected.tag.id, { tag_name: cleanName, description: description.trim() || null });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["org-tags", orgId] });
      setSelected(null);
      toast.success("Järjestelmä päivitetty kaikkiin vaiheisiin.");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ServerCog className="h-4 w-4 text-primary" />
            Organisaation järjestelmien massahallinta
          </div>
          <h2 className="mt-1 text-2xl font-bold">Järjestelmien massahallinta</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Päivitä järjestelmän nimi ja tiedot kerralla kaikkiin BPMN-kaavioiden vaiheisiin.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hae järjestelmää..." className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={ServerCog} label="Järjestelmät" value={systems.length} />
        <Metric icon={ListChecks} label="Vaiheosumat" value={systems.reduce((sum, system) => sum + system.stepCount, 0)} />
        <Metric icon={GitBranch} label="Prosessit" value={orgProjects.length} />
        <Metric icon={RefreshCw} label="Massapäivitettävät" value={systems.filter((system) => system.stepCount > 0).length} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
          <div className="col-span-5">Järjestelmä</div>
          <div className="col-span-2">Vaiheet</div>
          <div className="col-span-3">Kaaviot</div>
          <div className="col-span-2 text-right">Toiminto</div>
        </div>
        {filteredSystems.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Järjestelmiä ei löytynyt.</div>
        ) : filteredSystems.map((system) => (
          <div key={system.name} className="grid grid-cols-12 items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/30">
            <div className="col-span-5 min-w-0">
              <p className="truncate font-medium">{system.name}</p>
              <p className="truncate text-xs text-muted-foreground">{(system.tag as any)?.description || "Ei kuvausta"}</p>
            </div>
            <div className="col-span-2"><Badge variant="secondary">{system.stepCount}</Badge></div>
            <div className="col-span-3 text-sm text-muted-foreground">{system.projects.length}</div>
            <div className="col-span-2 text-right">
              <Button size="sm" variant="outline" onClick={() => openEdit(system)}>Päivitä</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vahvista järjestelmän massapäivitys</DialogTitle>
            <DialogDescription>
              Muutos vaikuttaa {selected?.stepCount || 0} vaiheeseen ja {selected?.projects.length || 0} kaavioon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nykyinen nimi</label>
                <Input value={selected?.name || ""} disabled />
              </div>
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Uusi nimi</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} list="existing-systems" />
                <datalist id="existing-systems">
                  {systems.filter((system) => system.name !== selected?.name).map((system) => <option key={system.name} value={system.name} />)}
                </datalist>
                {systems.some((system) => system.name.toLowerCase() === newName.trim().toLowerCase() && system.name !== selected?.name) && (
                  <p className="text-xs text-muted-foreground">Olemassa oleva järjestelmä: osumat yhdistetään tähän ilman duplikaatteja.</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Järjestelmän tiedot</label>
              <Textarea className="min-h-24 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kuvaus, linkki tai muu lisätieto..." />
            </div>
            <div className="max-h-56 overflow-auto rounded-md border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Vaikutusalue</p>
              <div className="space-y-2">
                {selected?.projects.map(({ project, steps }) => (
                  <div key={project.id} className="rounded-md bg-background p-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{project.name}</span>
                      <span className="text-xs text-muted-foreground">{steps.length} vaihetta</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {steps.length ? steps.slice(0, 3).map((step) => `#${step.step} ${step.task}`).join(" · ") : "Käytössä vain prosessin järjestelmälistassa"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
           <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setSelected(null)}>Peruuta</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Vahvista päivitys</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
