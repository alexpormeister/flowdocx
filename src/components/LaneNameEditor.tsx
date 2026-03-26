import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown, Users } from "lucide-react";

interface LaneNameEditorProps {
  element: any;
  modeler: any;
  positions: string[];
}

export default function LaneNameEditor({ element, modeler, positions }: LaneNameEditorProps) {
  const currentName = element?.businessObject?.name || "";
  const [inputValue, setInputValue] = useState(currentName);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(element?.businessObject?.name || "");
  }, [element?.id, element?.businessObject?.name]);

  const applyName = (name: string) => {
    if (!modeler || !element) return;
    try {
      const modeling = modeler.get("modeling") as any;
      modeling.updateLabel(element, name);
    } catch {
      // Fallback: update businessObject directly
      try {
        const modeling = modeler.get("modeling") as any;
        modeling.updateProperties(element, { name });
      } catch (e) {
        console.error("Failed to update lane name:", e);
      }
    }
  };

  const handleChange = (val: string) => {
    setInputValue(val);
    applyName(val);
  };

  const filtered = positions.filter(
    (p) => p.toLowerCase().includes(inputValue.toLowerCase()) && p !== inputValue
  );

  const hasPositions = positions.length > 0;

  // Only show for lanes and participants
  const type = element?.type;
  if (type !== "bpmn:Lane" && type !== "bpmn:Participant") return null;

  const label = type === "bpmn:Lane" ? "Uimarata (Lane)" : "Osallistuja (Participant)";

  return (
    <div className="border-t px-3 py-3 space-y-2">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
        <Users className="w-3 h-3" />
        {label}
      </h3>
      <div className="relative">
        <div className="relative">
          <Input
            ref={inputRef}
            placeholder="Kirjoita nimi tai valitse..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              applyName(e.target.value);
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
            {/* Groups first */}
            {filtered.filter(p => p.startsWith("[")).length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b bg-muted/30">
                  Ryhmät
                </div>
                {filtered.filter(p => p.startsWith("[")).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInputValue(pos);
                      applyName(pos);
                      setOpen(false);
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </>
            )}
            {/* Positions */}
            {filtered.filter(p => !p.startsWith("[")).length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b bg-muted/30">
                  Positiot
                </div>
                {filtered.filter(p => !p.startsWith("[")).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInputValue(pos);
                      applyName(pos);
                      setOpen(false);
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Valitse organisaation asema tai kirjoita vapaamuotoinen nimi.
      </p>
    </div>
  );
}
