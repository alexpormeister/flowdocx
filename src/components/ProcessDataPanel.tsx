import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Tag, ChevronDown, Search, ArrowRight, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SystemTagBadge from "./SystemTagBadge";

export type BpmnElementType = "task" | "event" | "gateway" | "subprocess" | "other";

export interface GatewayPath {
  label: string;
  targetId: string;
  targetName: string;
}

export interface ProcessStep {
  id: string;
  step: number;
  task: string;
  performer: string;
  system: string[];
  decision: string;
  elementType?: BpmnElementType;
  gatewayPaths?: GatewayPath[];
}

interface ProcessDataPanelProps {
  steps: ProcessStep[];
  onStepsChange: (steps: ProcessStep[]) => void;
  selectedElementId?: string | null;
  availableTags?: string[];
  availablePositions?: string[];
  description?: string;
  onDescriptionChange?: (description: string) => void;
  onAddOrgTag?: (tag: string) => void;
  onSubmitChangeRequest?: (step: ProcessStep, proposedDescription: string) => Promise<void>;
  readOnly?: boolean;
}

export default function ProcessDataPanel({ 
  steps, 
  onStepsChange, 
  selectedElementId, 
  availableTags = [],
  availablePositions = [],
  description = "",
  onDescriptionChange,
  onAddOrgTag,
  onSubmitChangeRequest,
  readOnly = false,
}: ProcessDataPanelProps) {
  const [newSystemTag, setNewSystemTag] = useState<{ stepId: string; value: string } | null>(null);
  const [customTagInput, setCustomTagInput] = useState("");
  const [feedbackStep, setFeedbackStep] = useState<ProcessStep | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSystems, setFeedbackSystems] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const addStep = () => {
    const newStep: ProcessStep = {
      id: `step-${Date.now()}`,
      step: steps.length + 1,
      task: "",
      performer: "",
      system: [],
      decision: "",
    };
    onStepsChange([...steps, newStep]);
  };

  const updateStep = (id: string, field: keyof ProcessStep, value: any) => {
    onStepsChange(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStep = (id: string) => {
    onStepsChange(steps.filter(s => s.id !== id).map((s, i) => ({ ...s, step: i + 1 })));
  };

  const addSystemTag = (stepId: string, tag: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step && !step.system.includes(tag)) {
      updateStep(stepId, "system", [...step.system, tag]);
      if (onAddOrgTag) {
        onAddOrgTag(tag);
      }
    }
    setNewSystemTag(null);
  };

  const removeSystemTag = (stepId: string, tag: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step) {
      updateStep(stepId, "system", step.system.filter(t => t !== tag));
    }
  };

  const submitFeedback = async () => {
    if (!feedbackStep || !onSubmitChangeRequest || !feedbackText.trim()) return;
    const proposedDescription = [
      feedbackText.trim(),
      feedbackSystems.trim() ? `\n\nJärjestelmät mainittu ehdotuksessa:\n${feedbackSystems.trim()}` : "",
    ].join("");
    setSubmittingFeedback(true);
    try {
      await onSubmitChangeRequest(feedbackStep, proposedDescription);
      setFeedbackStep(null);
      setFeedbackText("");
      setFeedbackSystems("");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-end">
        {!readOnly && (
          <Button
            size="sm"
            onClick={addStep}
            className="bg-accent text-accent-foreground hover:bg-accent/90 h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Lisää vaihe
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {onDescriptionChange && !readOnly && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kuvaus</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Lisää prosessin kuvaus..."
              className="w-full h-16 px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        {steps.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Tag className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p>Prosessivaiheita ei ole vielä.</p>
            {!readOnly && <p className="text-xs mt-1">Lisää vaihe aloittaaksesi kartoituksen.</p>}
          </div>
        )}

        {steps.map((step) => {
          const typeStyles = getElementTypeStyles(step.elementType);
          const isGateway = step.elementType === "gateway";
          return (
          <div
            key={step.id}
            className={`rounded-lg border p-3 space-y-2 transition-colors ${typeStyles.border} ${
              selectedElementId === step.id
                ? "border-accent bg-accent/5"
                : `${typeStyles.bg} hover:border-muted-foreground/30`
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${typeStyles.badge}`}>
                  {typeStyles.label}
                </span>
                <span className="text-xs font-mono font-semibold text-muted-foreground">
                  #{step.step}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {onSubmitChangeRequest && (
                  <button
                    onClick={() => { setFeedbackStep(step); setFeedbackText(""); }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Ilmoita muutoksesta"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => removeStep(step.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <Input
              placeholder="Task name..."
              value={step.task}
              onChange={(e) => updateStep(step.id, "task", e.target.value)}
              className="h-8 text-sm bg-background"
            />

            <div className="grid grid-cols-1 gap-2">
              <PerformerCombobox
                value={step.performer}
                onChange={(val) => updateStep(step.id, "performer", val)}
                positions={availablePositions}
              />
            </div>

            {/* Gateway Decision Paths */}
            {isGateway && step.gatewayPaths && step.gatewayPaths.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Decision Paths
                </label>
                <div className="space-y-1">
                  {step.gatewayPaths.map((path, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-xs"
                    >
                      <span className="font-medium text-amber-800 min-w-0 shrink-0">
                        {path.label || "—"}
                      </span>
                      <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-amber-700 truncate">
                        {path.targetName || path.targetId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isGateway && (!step.gatewayPaths || step.gatewayPaths.length === 0) && (
              <div className="px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-600">
                Sync to detect decision paths from diagram
              </div>
            )}

            {/* System Tags */}
            <div className="flex flex-wrap gap-1 items-center">
              {step.system.map((tag) => (
                <SystemTagBadge
                  key={tag}
                  tag={tag}
                  onRemove={() => removeSystemTag(step.id, tag)}
                />
              ))}

              {newSystemTag?.stepId === step.id ? (
                <SystemTagSearchDropdown
                  availableTags={availableTags.filter(t => !step.system.includes(t))}
                  onSelect={(tag) => addSystemTag(step.id, tag)}
                  onCustomAdd={(tag) => addSystemTag(step.id, tag)}
                  onClose={() => {
                    setNewSystemTag(null);
                    setCustomTagInput("");
                  }}
                />
              ) : (
                <button
                  onClick={() => setNewSystemTag({ stepId: step.id, value: "" })}
                  className="h-5 px-1.5 text-[10px] rounded bg-tag text-tag-foreground hover:bg-accent/20 transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-2.5 h-2.5" />
                  System
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <Dialog open={!!feedbackStep} onOpenChange={(open) => !open && setFeedbackStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ilmoita muutoksesta</DialogTitle>
            <DialogDescription>
              Kuvaa, miten tämä vaihe menee todellisuudessa. Ehdotuksesta luodaan tarkastettava prosessiversio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{feedbackStep?.task || "Nimetön vaihe"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Nykyinen vastuu: {feedbackStep?.performer || "Ei määritetty"}</p>
            </div>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Miten tämä vaihe menee todellisuudessa?"
              className="min-h-32"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackStep(null)}>Peruuta</Button>
            <Button onClick={submitFeedback} disabled={!feedbackText.trim() || submittingFeedback}>Lähetä ehdotus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SystemTagSearchDropdown({
  availableTags,
  onSelect,
  onCustomAdd,
  onClose,
}: {
  availableTags: string[];
  onSelect: (tag: string) => void;
  onCustomAdd: (tag: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filtered = availableTags.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = availableTags.some(t => t.toLowerCase() === search.toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1 border rounded-md bg-background px-1.5 py-0.5">
        <Search className="w-3 h-3 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (filtered.length === 1) {
                onSelect(filtered[0]);
              } else if (search.trim() && !exactMatch) {
                onCustomAdd(search.trim());
              }
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="Search systems..."
          className="h-5 text-[10px] bg-transparent outline-none w-24"
        />
      </div>
      {(filtered.length > 0 || (search.trim() && !exactMatch)) && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 max-h-36 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((tag) => (
            <button
              key={tag}
              type="button"
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(tag);
              }}
            >
              {tag}
            </button>
          ))}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors border-t text-muted-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                onCustomAdd(search.trim());
              }}
            >
              + Add "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PerformerCombobox({
  value,
  onChange,
  positions,
}: {
  value: string;
  onChange: (val: string) => void;
  positions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  const filtered = positions.filter(
    (p) => p.toLowerCase().includes(inputValue.toLowerCase()) && p !== value
  );
  const hasPositions = positions.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Performer"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            if (hasPositions) setOpen(true);
          }}
          onFocus={() => { if (hasPositions) setOpen(true); }}
          onBlur={() => { setTimeout(() => setOpen(false), 150); }}
          className="h-8 text-xs bg-background pr-6"
        />
        {hasPositions && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(!open);
              inputRef.current?.focus();
            }}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-36 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((pos) => (
            <button
              key={pos}
              type="button"
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setInputValue(pos);
                onChange(pos);
                setOpen(false);
              }}
            >
              {pos}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getElementTypeStyles(type?: BpmnElementType) {
  switch (type) {
    case "event":
      return {
        label: "Event",
        bg: "bg-emerald-500/5 border-emerald-500/20",
        border: "border-emerald-500/30",
        badge: "bg-emerald-500/15 text-emerald-700",
      };
    case "gateway":
      return {
        label: "Gateway",
        bg: "bg-amber-500/5 border-amber-500/20",
        border: "border-amber-500/30",
        badge: "bg-amber-500/15 text-amber-700",
      };
    case "subprocess":
      return {
        label: "Sub-process",
        bg: "bg-purple-500/5 border-purple-500/20",
        border: "border-purple-500/30",
        badge: "bg-purple-500/15 text-purple-700",
      };
    case "task":
      return {
        label: "Task",
        bg: "bg-sky-500/5 border-sky-500/20",
        border: "border-sky-500/30",
        badge: "bg-sky-500/15 text-sky-700",
      };
    default:
      return {
        label: "Element",
        bg: "bg-card border-border",
        border: "border-border",
        badge: "bg-muted text-muted-foreground",
      };
  }
}
