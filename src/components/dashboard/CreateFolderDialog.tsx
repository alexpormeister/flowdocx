import { useState } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { FolderPlus } from "lucide-react";

const FOLDER_COLORS = [
  "#0891b2", // cyan
  "#059669", // emerald
  "#7c3aed", // violet
  "#db2777", // pink
  "#ea580c", // orange
  "#ca8a04", // yellow
  "#dc2626", // red
  "#4f46e5", // indigo
];

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (name: string, color: string) => void;
  isCreating: boolean;
  parentFolderName?: string | null;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onCreateFolder,
  isCreating,
  parentFolderName,
}: CreateFolderDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);

  const handleCreate = () => {
    if (name.trim()) {
      onCreateFolder(name.trim(), color);
      setName("");
      setColor(FOLDER_COLORS[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground">
          <FolderPlus className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dashboard.createFolder")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("dashboard.folderName")}</Label>
            <Input
              placeholder={t("dashboard.folderName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label>{t("dashboard.folderColor")}</Label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-accent" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {parentFolderName && (
            <p className="text-xs text-muted-foreground">
              {t("dashboard.creatingIn")}: {parentFolderName}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
          >
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FOLDER_COLORS };
