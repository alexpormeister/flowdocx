import { useState } from "react";
import { Building2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Organization } from "@/lib/organizationApi";

interface OrganizationSelectorProps {
  organizations: Organization[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
  onCreateOrg: (name: string, businessId?: string) => Promise<void>;
  isCreating?: boolean;
  triggerStyle?: React.CSSProperties;
}

export function OrganizationSelector({
  organizations,
  selectedOrgId,
  onSelectOrg,
  onCreateOrg,
  isCreating,
  triggerStyle,
}: OrganizationSelectorProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    await onCreateOrg(newOrgName.trim());
    setNewOrgName("");
    setCreateDialogOpen(false);
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
                    setCreateDialogOpen(true);
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
              onClick={handleCreate}
              disabled={!newOrgName.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? t("common.loading") : t("org.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
