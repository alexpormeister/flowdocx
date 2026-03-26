import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FOLDER_COLORS } from "./CreateFolderDialog";

interface EditFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  folderColor: string;
  onSave: (name: string, color: string) => void;
}

export function EditFolderDialog({
  open,
  onOpenChange,
  folderName,
  folderColor,
  onSave,
}: EditFolderDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(folderName);
  const [color, setColor] = useState(folderColor || FOLDER_COLORS[0]);

  useEffect(() => {
    if (open) {
      setName(folderName);
      setColor(folderColor || FOLDER_COLORS[0]);
    }
  }, [open, folderName, folderColor]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), color);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dashboard.editFolder") || "Edit Folder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("dashboard.folderName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("dashboard.folderColor") || "Color"}</Label>
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
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {t("common.save") || "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
