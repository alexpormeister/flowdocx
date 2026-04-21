import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProjects, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles,
  Plus,
  X,
  Zap,
  FileText,
  ArrowRight,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface AutomationProposalPanelProps {
  orgId: string;
}

interface MatchedStep {
  project: Project;
  stepId: string;
  stepNumber: number;
  task: string;
  performer?: string;
  matchedKeywords: string[];
}

// Distinct, accessible color palette for keyword chips/highlights
const KEYWORD_COLORS = [
  { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/40", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/40", dot: "bg-emerald-500" },
  { bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-300", border: "border-purple-500/40", dot: "bg-purple-500" },
  { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/40", dot: "bg-amber-500" },
  { bg: "bg-pink-500/15", text: "text-pink-700 dark:text-pink-300", border: "border-pink-500/40", dot: "bg-pink-500" },
  { bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-500/40", dot: "bg-cyan-500" },
  { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/40", dot: "bg-orange-500" },
  { bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-500/40", dot: "bg-indigo-500" },
];

const storageKey = (orgId: string) => `automation-keywords:${orgId}`;

export default function AutomationProposalPanel({ orgId }: AutomationProposalPanelProps) {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [input, setInput] = useState("");

  // Load saved keywords on mount / org change
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(orgId));
      if (raw) setKeywords(JSON.parse(raw));
      else setKeywords([]);
    } catch {
      setKeywords([]);
    }
  }, [orgId]);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(orgId), JSON.stringify(keywords));
    } catch {
      /* ignore */
    }
  }, [keywords, orgId]);

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const orgProjects = useMemo(
    () => allProjects.filter((p) => p.organization_id === orgId),
    [allProjects, orgId],
  );

  const colorFor = (kw: string) => {
    const idx = keywords.indexOf(kw);
    return KEYWORD_COLORS[(idx >= 0 ? idx : 0) % KEYWORD_COLORS.length];
  };

  const addKeyword = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (keywords.some((k) => k.toLowerCase() === lower)) {
      toast.error("Avainsana on jo lisätty");
      return;
    }
    setKeywords([...keywords, trimmed]);
    setInput("");
    toast.success(`Lisätty: ${trimmed}`);
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const matches: MatchedStep[] = useMemo(() => {
    if (keywords.length === 0) return [];
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    const results: MatchedStep[] = [];

    for (const project of orgProjects) {
      const steps = (project.process_steps as any[]) || [];
      steps.forEach((step, idx) => {
        const task = (step.task || "").toString();
        const taskLower = task.toLowerCase();
        const matched: string[] = [];
        keywords.forEach((kw, i) => {
          if (taskLower.includes(lowerKeywords[i])) matched.push(kw);
        });
        if (matched.length > 0) {
          results.push({
            project,
            stepId: step.id || `${project.id}-${idx}`,
            stepNumber: idx + 1,
            task,
            performer: step.performer,
            matchedKeywords: matched,
          });
        }
      });
    }
    return results;
  }, [orgProjects, keywords]);

  const matchesByKeyword = useMemo(() => {
    const map: Record<string, number> = {};
    keywords.forEach((k) => (map[k] = 0));
    matches.forEach((m) => m.matchedKeywords.forEach((k) => (map[k] = (map[k] || 0) + 1)));
    return map;
  }, [matches, keywords]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project: Project; steps: MatchedStep[] }>();
    for (const m of matches) {
      const existing = map.get(m.project.id);
      if (existing) existing.steps.push(m);
      else map.set(m.project.id, { project: m.project, steps: [m] });
    }
    return Array.from(map.values());
  }, [matches]);

  // Highlight matched substrings inside a task text
  const renderHighlightedTask = (task: string, matched: string[]) => {
    if (matched.length === 0) return task;
    // Build regex from matched keywords (escape special chars)
    const escaped = matched.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = task.split(re);
    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      const matchKw = keywords.find((k) => k.toLowerCase() === lower);
      if (matchKw) {
        const c = colorFor(matchKw);
        return (
          <mark
            key={i}
            className={`${c.bg} ${c.text} px-1 py-0.5 rounded font-semibold`}
          >
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Hero / Intro */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-10">
          <Sparkles className="w-32 h-32" />
        </div>
        <div className="relative flex items-start gap-4">
          <div className="rounded-lg bg-primary/15 p-3">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">Automatisoinnin ehdotukset</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Lisää avainsanoja (esim. <span className="font-semibold">"Lähetetään"</span>,{" "}
              <span className="font-semibold">"Tallennetaan"</span>) ja löydä kaikki prosessivaiheet,
              jotka voitaisiin mahdollisesti automatisoida. Isot/pienet kirjaimet eivät vaikuta.
            </p>
          </div>
        </div>
      </div>

      {/* Keyword input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-4 h-4 text-primary" />
            Automatisoinnin avainsanat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              placeholder='esim. "Lähetetään", "Tallennetaan", "Lähetä"'
              className="flex-1"
            />
            <Button onClick={addKeyword} disabled={!input.trim()} className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />
              Lisää
            </Button>
          </div>

          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Ei avainsanoja vielä. Lisää avainsana yllä aloittaaksesi.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => {
                const c = colorFor(kw);
                const count = matchesByKeyword[kw] || 0;
                return (
                  <div
                    key={kw}
                    className={`group inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full border ${c.bg} ${c.border} ${c.text} text-sm font-medium transition-all`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span>{kw}</span>
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] bg-background/60"
                    >
                      {count}
                    </Badge>
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="rounded-full p-1 hover:bg-background/40 transition-colors"
                      aria-label={`Poista ${kw}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats summary */}
      {keywords.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{matches.length}</div>
                <div className="text-xs text-muted-foreground">Automatisoitavaa vaihetta</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{groupedByProject.length}</div>
                <div className="text-xs text-muted-foreground">Prosessia, joissa osumia</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{keywords.length}</div>
                <div className="text-xs text-muted-foreground">Avainsanaa seurannassa</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {keywords.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Automatisointiehdotukset</h3>
            {matches.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Klikkaa vaihetta avataksesi prosessin
              </span>
            )}
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Ladataan…
              </CardContent>
            </Card>
          ) : matches.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Ei osumia. Kokeile eri avainsanoja tai tarkista, että prosesseissa on
                  vaiheita, jotka sisältävät hakemiasi sanoja.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedByProject.map(({ project, steps }) => (
                <Card key={project.id} className="overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <CardTitle className="text-base truncate">{project.name}</CardTitle>
                        <Badge variant="secondary" className="text-[10px]">
                          {steps.length} {steps.length === 1 ? "vaihe" : "vaihetta"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 shrink-0"
                        onClick={() => navigate(`/presentation/${project.id}`)}
                      >
                        Avaa
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 divide-y">
                    {steps.map((m) => (
                      <button
                        key={m.stepId}
                        onClick={() => navigate(`/presentation/${project.id}?step=${m.stepId}`)}
                        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3 group"
                      >
                        <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {m.stepNumber}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="text-sm leading-relaxed">
                            {renderHighlightedTask(m.task, m.matchedKeywords)}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {m.performer && (
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {m.performer}
                              </Badge>
                            )}
                            {m.matchedKeywords.map((kw) => {
                              const c = colorFor(kw);
                              return (
                                <span
                                  key={kw}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text} border ${c.border}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                                  {kw}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
