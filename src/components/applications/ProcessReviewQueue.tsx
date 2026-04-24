import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { getCurrentUserMembership } from "@/lib/organizationApi";
import {
  approveProcessChangeRequest,
  getProcessChangeRequests,
  rejectProcessChangeRequest,
  type ProcessChangeRequest,
} from "@/lib/processChangeApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, ClipboardCheck, GitPullRequest, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "Odottaa käsittelyä",
  approved: "Hyväksytty",
  rejected: "Hylätty",
};

export default function ProcessReviewQueue({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ProcessChangeRequest | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["process-change-requests", orgId],
    queryFn: () => getProcessChangeRequests(orgId),
    enabled: !!user && !!orgId,
  });

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: getProjects, enabled: !!user });
  const { data: membership } = useQuery({
    queryKey: ["org-membership", orgId],
    queryFn: () => getCurrentUserMembership(orgId),
    enabled: !!user && !!orgId,
  });

  const canReview = membership?.role === "owner" || membership?.role === "admin";
  const pendingRequests = requests.filter((request) => request.status === "pending");

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const approveMutation = useMutation({
    mutationFn: (request: ProcessChangeRequest) => approveProcessChangeRequest(request, projects),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-change-requests", orgId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelected(null);
      toast.success("Muutosehdotus hyväksytty ja virallinen malli päivitetty.");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: (request: ProcessChangeRequest) => rejectProcessChangeRequest(request.id, rejectComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-change-requests", orgId] });
      setSelected(null);
      setRejectComment("");
      toast.success("Muutosehdotus hylätty.");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Prosessipäällikön hyväksyntäjono
          </div>
          <h2 className="mt-1 text-2xl font-bold">Muutosehdotusten hallinta</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tarkista työntekijöiden ilmoittamat poikkeamat ja päivitä virallinen BPMN-malli ehdotuksen pohjalta.
          </p>
        </div>
        {!canReview && (
          <Badge variant="secondary" className="w-fit">Vain ylläpitäjä tai omistaja voi hyväksyä</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={GitPullRequest} label="Odottaa" value={pendingRequests.length} />
        <Metric icon={CheckCircle2} label="Hyväksytty" value={requests.filter((r) => r.status === "approved").length} />
        <Metric icon={XCircle} label="Hylätty" value={requests.filter((r) => r.status === "rejected").length} />
        <Metric icon={ClipboardCheck} label="Yhteensä" value={requests.length} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
          <div className="col-span-4">Prosessi</div>
          <div className="col-span-3">Vaihe</div>
          <div className="col-span-2">Tila</div>
          <div className="col-span-2">Luotu</div>
          <div className="col-span-1 text-right">Avaa</div>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Muutosehdotuksia ei ole vielä.</div>
        ) : requests.map((request) => {
          const sourceProject = projectMap.get(request.source_project_id);
          return (
            <div key={request.id} className="grid grid-cols-12 items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/30">
              <div className="col-span-4 min-w-0">
                <p className="truncate font-medium">{sourceProject?.name || "Tuntematon prosessi"}</p>
                <p className="truncate text-xs text-muted-foreground">Versio: {request.review_project_id ? projectMap.get(request.review_project_id)?.name || "Luotu" : "Ei luotu"}</p>
              </div>
              <div className="col-span-3 min-w-0 text-sm"><span className="truncate block">{request.step_name}</span></div>
              <div className="col-span-2"><Badge variant={request.status === "pending" ? "default" : "secondary"}>{statusLabels[request.status] || request.status}</Badge></div>
              <div className="col-span-2 text-sm text-muted-foreground">{new Date(request.created_at).toLocaleDateString("fi-FI")}</div>
              <div className="col-span-1 text-right">
                <Button variant="ghost" size="icon" onClick={() => setSelected(request)}><Eye className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Muutosehdotuksen tarkistus</DialogTitle>
            <DialogDescription>{selected?.step_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextBlock title="Nykyinen kuvaus" text={selected?.current_description || "Ei aiempaa kuvausta."} />
              <TextBlock title="Ehdotettu todellinen toimintatapa" text={selected?.proposed_description || ""} accent />
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="font-medium">Vaikutus</p>
              <p className="mt-1 text-muted-foreground">
                Hyväksyntä päivittää alkuperäisen prosessin vaihedataan ehdotetun version tiedot. Automaattisesti luotu tarkastusversio säilyy historiassa.
              </p>
            </div>
            {canReview && selected?.status === "pending" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hylkäyksen kommentti</label>
                <Textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Kirjoita tarvittaessa kommentti..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Sulje</Button>
            {canReview && selected?.status === "pending" && (
              <>
                <Button variant="outline" onClick={() => rejectMutation.mutate(selected)} disabled={rejectMutation.isPending}>Hylkää</Button>
                <Button onClick={() => approveMutation.mutate(selected)} disabled={approveMutation.isPending}>Hyväksy ja päivitä malli</Button>
              </>
            )}
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

function TextBlock({ title, text, accent = false }: { title: string; text: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${accent ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}
