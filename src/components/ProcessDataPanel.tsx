import { useState, useRef } from "react";
import { Plus, Trash2, Tag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SystemTagBadge from "./SystemTagBadge";

export type BpmnElementType = "task" | "event" | "gateway" | "subprocess" | "other";

export interface ProcessStep {
  id: string;
  step: number;
  task: string;
  performer: string;
  system: string[];
  decision: string;
  elementType?: BpmnElementType;
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
}: ProcessDataPanelProps) {
  const [newSystemTag, setNewSystemTag] = useState<{ stepId: string; value: string } | null>(null);
  const [customTagInput, setCustomTagInput] = useState("");

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
      // Auto-add to org global tags
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

  const handleCustomTagAdd = (stepId: string) => {
    if (customTagInput.trim()) {
      addSystemTag(stepId, customTagInput.trim());
      setCustomTagInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-end">
        <Button
          size="sm"
          onClick={addStep}
          className="bg-accent text-accent-foreground hover:bg-accent/90 h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Step
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Description field */}
        {onDescriptionChange && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Add a description for this project..."
              className="w-full h-16 px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        {steps.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Tag className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p>No process steps yet.</p>
            <p className="text-xs mt-1">Click "Add Step" to begin mapping.</p>
          </div>
        )}

        {steps.map((step) => {
          const typeStyles = getElementTypeStyles(step.elementType);
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
              <button
                onClick={() => removeStep(step.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <Input
              placeholder="Task name..."
              value={step.task}
              onChange={(e) => updateStep(step.id, "task", e.target.value)}
              className="h-8 text-sm bg-background"
            />

            <div className="grid grid-cols-2 gap-2">
              <PerformerCombobox
                value={step.performer}
                onChange={(val) => updateStep(step.id, "performer", val)}
                positions={availablePositions}
              />
              <Input
                placeholder="Decision"
                value={step.decision}
                onChange={(e) => updateStep(step.id, "decision", e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>


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
                <div className="flex gap-1 items-center">
                  {availableTags.length > 0 ? (
                    <select
                      className="h-6 text-xs rounded border border-border bg-background px-1 text-foreground"
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          // Show custom input
                        } else if (e.target.value) {
                          addSystemTag(step.id, e.target.value);
                        }
                      }}
                      autoFocus
                      onBlur={() => {
                        if (!customTagInput) setNewSystemTag(null);
                      }}
                    >
                      <option value="">Select...</option>
                      {availableTags.filter(o => !step.system.includes(o)).map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                      <option value="__custom__">+ Custom...</option>
                    </select>
                  ) : (
                    <div className="flex gap-1">
                      <Input
                        className="h-6 text-xs w-24"
                        placeholder="Tag name..."
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCustomTagAdd(step.id);
                          } else if (e.key === "Escape") {
                            setNewSystemTag(null);
                            setCustomTagInput("");
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleCustomTagAdd(step.id)}
                        disabled={!customTagInput.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
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
        badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      };
    case "gateway":
      return {
        label: "Gateway",
        bg: "bg-amber-500/5 border-amber-500/20",
        border: "border-amber-500/30",
        badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      };
    case "subprocess":
      return {
        label: "Sub-process",
        bg: "bg-purple-500/5 border-purple-500/20",
        border: "border-purple-500/30",
        badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
      };
    case "task":
      return {
        label: "Task",
        bg: "bg-sky-500/5 border-sky-500/20",
        border: "border-sky-500/30",
        badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
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
