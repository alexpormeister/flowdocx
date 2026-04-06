import { useState } from "react";
import { Building2, Palette, Network, FolderTree, Plus, X, ChevronRight, ChevronLeft, Wand2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DepartmentNode {
  id: string;
  name: string;
  children: DepartmentNode[];
}

const DEMO_STRUCTURE = [
  { id: "ceo", name: "Toimitusjohtaja", parent_position_id: null },
  { id: "cfo", name: "Talousjohtaja", parent_position_id: "ceo" },
  { id: "coo", name: "Operatiivinen johtaja", parent_position_id: "ceo" },
  { id: "cto", name: "Teknologiajohtaja", parent_position_id: "ceo" },
  { id: "hr", name: "HR-päällikkö", parent_position_id: "coo" },
];

interface OrgCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: {
    name: string;
    primaryColor: string;
    accentColor: string;
    structureType: "blank" | "demo";
    departments: DepartmentNode[];
  }) => Promise<void>;
  isCreating: boolean;
}

let nodeIdCounter = 0;
function generateId() {
  return `dept_${++nodeIdCounter}_${Date.now()}`;
}

function DepartmentTreeEditor({
  departments,
  onChange,
}: {
  departments: DepartmentNode[];
  onChange: (deps: DepartmentNode[]) => void;
}) {
  const addChild = (parentPath: number[]) => {
    const newDeps = JSON.parse(JSON.stringify(departments)) as DepartmentNode[];
    let target: DepartmentNode[] = newDeps;
    for (const idx of parentPath) {
      target = target[idx].children;
    }
    target.push({ id: generateId(), name: "", children: [] });
    onChange(newDeps);
  };

  const updateName = (path: number[], name: string) => {
    const newDeps = JSON.parse(JSON.stringify(departments)) as DepartmentNode[];
    let node: DepartmentNode = newDeps[path[0]];
    for (let i = 1; i < path.length; i++) {
      node = node.children[path[i]];
    }
    node.name = name;
    onChange(newDeps);
  };

  const removeNode = (path: number[]) => {
    const newDeps = JSON.parse(JSON.stringify(departments)) as DepartmentNode[];
    if (path.length === 1) {
      newDeps.splice(path[0], 1);
    } else {
      let parent: DepartmentNode = newDeps[path[0]];
      for (let i = 1; i < path.length - 1; i++) {
        parent = parent.children[path[i]];
      }
      parent.children.splice(path[path.length - 1], 1);
    }
    onChange(newDeps);
  };

  const renderNode = (node: DepartmentNode, path: number[], depth: number) => (
    <div key={node.id} style={{ marginLeft: depth * 24 }} className="mt-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary/50 shrink-0" />
        <Input
          value={node.name}
          onChange={(e) => updateName(path, e.target.value)}
          placeholder={depth === 0 ? "Osasto..." : "Alaosasto..."}
          className="h-8 text-sm flex-1"
        />
        <button
          onClick={() => addChild(path)}
          className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-primary transition-colors"
          title="Lisää alaosasto"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => removeNode(path)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Poista"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {node.children.map((child, i) => renderNode(child, [...path, i], depth + 1))}
    </div>
  );

  return (
    <div className="space-y-1">
      {departments.map((dept, i) => renderNode(dept, [i], 0))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...departments, { id: generateId(), name: "", children: [] }])}
        className="mt-3 gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Lisää osasto
      </Button>
    </div>
  );
}

export function OrgCreationWizard({ open, onOpenChange, onComplete, isCreating }: OrgCreationWizardProps) {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#0891b2");
  const [structureType, setStructureType] = useState<"blank" | "demo">("blank");
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);

  const steps = [
    { icon: Building2, label: "Yrityksen nimi" },
    { icon: Palette, label: "Brändivärit" },
    { icon: Network, label: "Organisaatiorakenne" },
    { icon: FolderTree, label: "Osastot" },
  ];

  const canNext = () => {
    if (step === 0) return orgName.trim().length > 0;
    return true;
  };

  const handleComplete = async () => {
    await onComplete({
      name: orgName.trim(),
      primaryColor,
      accentColor,
      structureType,
      departments: departments.filter((d) => d.name.trim()),
    });
    // Reset
    setStep(0);
    setOrgName("");
    setPrimaryColor("#0f172a");
    setAccentColor("#0891b2");
    setStructureType("blank");
    setDepartments([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Nexus Process Wizard
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 0: Company name */}
        {step === 0 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Yrityksen nimi</Label>
              <p className="text-sm text-muted-foreground">Anna yrityksen tai organisaation nimi</p>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Esim. Yhtiö Oy"
                className="text-base"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 1: Brand colors */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-semibold">Brändivärit</Label>
            <p className="text-sm text-muted-foreground">Valitse organisaation pää- ja korostusvärit</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Pääväri</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-24 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Korostusväri</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-24 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="rounded-lg border p-4 flex items-center gap-4" style={{ backgroundColor: primaryColor }}>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{orgName}</p>
                <p className="text-xs text-white/70">Esikatselu</p>
              </div>
              <div className="px-3 py-1.5 rounded text-xs font-medium text-white" style={{ backgroundColor: accentColor }}>
                Toiminto
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Structure type */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-semibold">Organisaatiorakenne</Label>
            <p className="text-sm text-muted-foreground">Valitse aloitusrakenne</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStructureType("blank")}
                className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                  structureType === "blank"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-semibold">Tyhjä rakenne</p>
                <p className="text-xs text-muted-foreground mt-1">Aloita puhtaalta pöydältä</p>
              </button>
              <button
                onClick={() => setStructureType("demo")}
                className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                  structureType === "demo"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Network className="w-8 h-8 text-primary mb-2" />
                <p className="text-sm font-semibold">Esimerkkirakenne</p>
                <p className="text-xs text-muted-foreground mt-1">TJ, CFO, COO, CTO, HR</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Departments */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <Label className="text-base font-semibold">Osastot ja kansiot</Label>
            <p className="text-sm text-muted-foreground">
              Lisää yrityksen osastot. Nämä luodaan kansioina organisaation alle. Voit myös luoda alaosastoja.
            </p>
            <div className="max-h-[300px] overflow-auto pr-1">
              <DepartmentTreeEditor departments={departments} onChange={setDepartments} />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Edellinen
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="gap-1">
              Seuraava
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isCreating || !canNext()} className="gap-1">
              {isCreating ? "Luodaan..." : "Luo organisaatio"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DEMO_STRUCTURE };
export type { DepartmentNode };
