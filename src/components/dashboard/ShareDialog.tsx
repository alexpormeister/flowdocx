import { useState } from "react";
import { Share2, Users, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ShareEntry {
  id: string;
  email: string;
  permission: "view" | "edit";
  created_at: string;
}

interface ShareDialogProps {
  type: "folder" | "project";
  name: string;
  shares: ShareEntry[];
  onShare: (email: string, permission: "view" | "edit") => Promise<void>;
  onRemoveShare: (shareId: string) => Promise<void>;
  isLoading?: boolean;
}

export function ShareDialog({
  type,
  name,
  shares,
  onShare,
  onRemoveShare,
  isLoading,
}: ShareDialogProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleShare = async () => {
    if (!email.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onShare(email.trim(), permission);
      setEmail("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (shareId: string) => {
    await onRemoveShare(shareId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          {t("share.share")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("share.shareTitle")} "{name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite form */}
          <div className="space-y-3">
            <Label>{t("share.inviteUser")}</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t("share.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={permission} onValueChange={(v: "view" | "edit") => setPermission(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">{t("share.view")}</SelectItem>
                  <SelectItem value="edit">{t("share.edit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleShare}
              disabled={!email.trim() || isSubmitting}
              className="w-full"
            >
              <Mail className="w-4 h-4 mr-2" />
              {isSubmitting ? t("common.loading") : t("share.sendInvite")}
            </Button>
          </div>

          {/* Current shares */}
          {shares.length > 0 && (
            <div className="space-y-2">
              <Label>{t("share.currentAccess")}</Label>
              <div className="space-y-2 max-h-48 overflow-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{share.email}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                        {share.permission === "edit" ? t("share.edit") : t("share.view")}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemove(share.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shares.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("share.noShares")}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {type === "folder" ? t("share.folderShareHelp") : t("share.projectShareHelp")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
