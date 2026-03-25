import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getProject } from "@/lib/api";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { useEffect, useRef, useState } from "react";

export default function Documentation() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id && !!user,
  });

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!project) return;
    const systemTags = [...new Set(project.process_steps.flatMap((s) => s.system))];
    const now = new Date().toLocaleDateString("fi-FI");

    let doc = `${project.name}\n${"=".repeat(60)}\n\n`;
    doc += `Status: ${project.status}\n`;
    if (project.owner_name) doc += `Owner: ${project.owner_name}\n`;
    if (project.owner_email) doc += `Email: ${project.owner_email}\n`;
    doc += `Generated: ${now}\n\n`;

    if (project.description) {
      doc += `DESCRIPTION\n${"-".repeat(40)}\n${project.description}\n\n`;
    }

    doc += `PROCESS STEPS\n${"-".repeat(40)}\n`;
    if (project.process_steps.length === 0) {
      doc += "No steps documented.\n\n";
    } else {
      project.process_steps.forEach((step) => {
        doc += `\nStep ${step.step}: ${step.task || "[Untitled]"}\n`;
        doc += `  Performer: ${step.performer || "N/A"}\n`;
        doc += `  Systems: ${step.system.length > 0 ? step.system.join(", ") : "None"}\n`;
        doc += `  Decision: ${step.decision || "None"}\n`;
      });
    }

    doc += `\nSYSTEMS USED\n${"-".repeat(40)}\n`;
    if (systemTags.length > 0) {
      systemTags.forEach((t, i) => { doc += `  ${i + 1}. ${t}\n`; });
    } else {
      doc += "  None documented.\n";
    }

    const blob = new Blob([doc], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, "_")}_documentation.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleBack = () => {
    const orgId = searchParams.get("org") || project?.organization_id;
    if (orgId) navigate(`/editor/${id}?org=${orgId}`);
    else navigate(`/editor/${id}`);
  };

  if (authLoading || !user || isLoading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const systemTags = [...new Set(project.process_steps.flatMap((s) => s.system))];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden on print */}
      <header className="print:hidden border-b bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm font-semibold">Documentation</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-8 py-10 print:px-4 print:py-6">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-1">{project.name}</h1>
        <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-muted-foreground">
          <StatusBadge status={project.status} />
          {project.owner_name && <span>Owner: {project.owner_name}</span>}
          {project.owner_email && (
            <a href={`mailto:${project.owner_email}`} className="hover:text-accent transition-colors">
              {project.owner_email}
            </a>
          )}
          <span className="text-xs">Generated: {new Date().toLocaleDateString("fi-FI")}</span>
        </div>

        {/* Description */}
        {project.description && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2 border-b pb-1">Description</h2>
            <p className="text-sm leading-relaxed">{project.description}</p>
          </section>
        )}

        {/* Process Steps */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 border-b pb-1">Process Steps</h2>
          {project.process_steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No process steps documented.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-2 border border-border font-medium w-12">#</th>
                    <th className="text-left p-2 border border-border font-medium">Task</th>
                    <th className="text-left p-2 border border-border font-medium">Performer</th>
                    <th className="text-left p-2 border border-border font-medium">Systems</th>
                    <th className="text-left p-2 border border-border font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {project.process_steps.map((step) => (
                    <tr key={step.id} className="hover:bg-muted/50">
                      <td className="p-2 border border-border text-muted-foreground font-mono">{step.step}</td>
                      <td className="p-2 border border-border font-medium">{step.task || "-"}</td>
                      <td className="p-2 border border-border">{step.performer || "-"}</td>
                      <td className="p-2 border border-border">
                        {step.system.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {step.system.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-xs">
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td className="p-2 border border-border">{step.decision || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Systems Summary */}
        {systemTags.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 border-b pb-1">Systems Used</h2>
            <div className="flex flex-wrap gap-2">
              {systemTags.map((sys) => (
                <span key={sys} className="px-3 py-1.5 bg-muted rounded-md text-sm font-medium">
                  {sys}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* BPMN Diagram */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Process Diagram</h2>
          <BpmnDiagramPreview bpmnXml={project.bpmn_xml} />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-4 border-t text-xs text-muted-foreground">
          <p>Document generated on {new Date().toLocaleDateString("fi-FI")} — {project.name}</p>
        </footer>
      </main>
    </div>
  );
}

function BpmnDiagramPreview({ bpmnXml }: { bpmnXml: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !bpmnXml) return;

    let viewer: any = null;

    const render = async () => {
      try {
        const { default: NavigatedViewer } = await import("bpmn-js/lib/NavigatedViewer");
        viewer = new NavigatedViewer({ container: containerRef.current! });
        await viewer.importXML(bpmnXml);
        const canvas = viewer.get("canvas") as any;
        canvas.zoom("fit-viewport");
      } catch (e) {
        console.error("Failed to render BPMN in docs:", e);
        setError(true);
      }
    };

    render();

    return () => {
      if (viewer) {
        try { viewer.destroy(); } catch (_) {}
      }
    };
  }, [bpmnXml]);

  if (error) {
    return <p className="text-sm text-muted-foreground">Failed to render diagram.</p>;
  }

  return (
    <div
      ref={containerRef}
      className="w-full border rounded-lg bg-white overflow-hidden"
      style={{ height: "400px" }}
    />
  );
}
