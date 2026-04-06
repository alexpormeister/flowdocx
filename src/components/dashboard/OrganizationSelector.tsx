import { useState } from "react";
import { Building2, Plus, Check, ChevronsUpDown, Wand2, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { OrgCreationWizard, type DepartmentNode } from "./OrgCreationWizard";
import type { Organization } from "@/lib/organizationApi";

interface OrganizationSelectorProps {
  organizations: Organization[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
  onCreateOrg: (name: string, businessId?: string) => Promise<void>;
  onCreateOrgWithWizard?: (data: {
    name: string;
    primaryColor: string;
    accentColor: string;
    structureType: "blank" | "demo";
    departments: DepartmentNode[];
  }) => Promise<void>;
  isCreating?: boolean;
  triggerStyle?: React.CSSProperties;
}

export function OrganizationSelector({
  organizations,
  selectedOrgId,
  onSelectOrg,
  onCreateOrg,
  onCreateOrgWithWizard,
  isCreating,
  triggerStyle,
}: OrganizationSelectorProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [blankDialogOpen, setBlankDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const handleCreateBlank = async () => {
    if (!newOrgName.trim()) return;
    await onCreateOrg(newOrgName.trim());
    setNewOrgName("");
    setBlankDialogOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
            style={triggerStyle}
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {selectedOrg ? selectedOrg.name : t("org.personal")}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder={t("org.searchOrg")} />
            <CommandList>
              <CommandEmpty>{t("org.noOrgsFound")}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onSelectOrg(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOrgId === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {t("org.personal")}
                </CommandItem>
                {organizations.map((org) => (
                  <CommandItem
                    key={org.id}
                    onSelect={() => {
                      onSelectOrg(org.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedOrgId === org.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {org.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setModeDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("org.createNew")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Mode selection dialog */}
      <Dialog open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t("org.createOrganization")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Valitse miten haluat luoda organisaation</p>
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => {
                setModeDialogOpen(false);
                setWizardOpen(true);
              }}
              className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 text-left transition-all hover:shadow-lg hover:border-primary hover:scale-[1.02] group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Wand2 className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold">Nexus Process Wizard</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ohjattu luonti: nimi, värit, rakenne ja osastot
              </p>
            </button>
            <button
              onClick={() => {
                setModeDialogOpen(false);
                setBlankDialogOpen(true);
              }}
              className="p-5 rounded-xl border-2 border-border text-left transition-all hover:shadow-lg hover:border-muted-foreground/40 hover:scale-[1.02] group"
            >
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3 group-hover:bg-muted/80 transition-colors">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Aloita tyhjästä</p>
              <p className="text-xs text-muted-foreground mt-1">
                Luo tyhjä organisaatio ja muokkaa myöhemmin
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blank create dialog */}
      <Dialog open={blankDialogOpen} onOpenChange={setBlankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {t("org.createOrganization")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("org.organizationName")}</Label>
              <Input
                placeholder={t("org.namePlaceholder")}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateBlank}
              disabled={!newOrgName.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? t("common.loading") : t("org.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wizard dialog */}
      <OrgCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={async (data) => {
          if (onCreateOrgWithWizard) {
            await onCreateOrgWithWizard(data);
          }
          setWizardOpen(false);
        }}
        isCreating={isCreating || false}
      />
    </div>
  );
}
