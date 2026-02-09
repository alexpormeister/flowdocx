import { useState, useRef } from "react";
import { Image, Upload, Trash2, X, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Default background options
const DEFAULT_BACKGROUNDS = [
  { id: "none", url: null, label: "None" },
  { id: "gradient-1", url: "linear-gradient(135deg, hsl(220 40% 20%) 0%, hsl(220 30% 10%) 100%)", label: "Dark Blue" },
  { id: "gradient-2", url: "linear-gradient(135deg, hsl(180 40% 15%) 0%, hsl(200 30% 8%) 100%)", label: "Dark Teal" },
  { id: "gradient-3", url: "linear-gradient(135deg, hsl(260 30% 15%) 0%, hsl(280 20% 8%) 100%)", label: "Dark Purple" },
  { id: "gradient-4", url: "linear-gradient(135deg, hsl(0 0% 15%) 0%, hsl(0 0% 5%) 100%)", label: "Dark Gray" },
  { id: "gradient-5", url: "linear-gradient(135deg, hsl(30 40% 15%) 0%, hsl(20 30% 8%) 100%)", label: "Dark Warm" },
];

interface BackgroundSettingsProps {
  currentBackground: string | null;
  onBackgroundChange: (url: string | null) => Promise<void>;
  userId: string;
  inline?: boolean;
}

export function BackgroundSettings({
  currentBackground,
  onBackgroundChange,
  userId,
  inline = false,
}: BackgroundSettingsProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(currentBackground);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("background.invalidType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("background.tooLarge"));
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("backgrounds")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("backgrounds")
        .getPublicUrl(fileName);

      setSelectedBackground(publicUrl);
      await onBackgroundChange(publicUrl);
      toast.success(t("background.uploaded"));
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("background.uploadError"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSelectPreset = async (url: string | null) => {
    setSelectedBackground(url);
    await onBackgroundChange(url);
    toast.success(url ? t("background.changed") : t("background.removed"));
  };

  const isGradient = (url: string | null) => url?.startsWith("linear-gradient");
  const isCustomImage = currentBackground && !isGradient(currentBackground);

  const content = (
    <div className="space-y-4">
      {/* Upload custom background */}
      <div>
        <p className="text-sm font-medium mb-2">{t("background.uploadCustom")}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="background-upload"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full gap-2"
        >
          <Upload className="w-4 h-4" />
          {isUploading ? t("common.loading") : t("background.uploadImage")}
        </Button>
      </div>

      {/* Current custom background */}
      {isCustomImage && (
        <div className="relative">
          <p className="text-sm font-medium mb-2">{t("background.current")}</p>
          <div className="relative rounded-lg overflow-hidden border">
            <img
              src={currentBackground}
              alt="Current background"
              className="w-full h-24 object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => handleSelectPreset(null)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Preset backgrounds */}
      <div>
        <p className="text-sm font-medium mb-2">{t("background.presets")}</p>
        <div className="grid grid-cols-3 gap-2">
          {DEFAULT_BACKGROUNDS.map((bg) => {
            const isSelected = selectedBackground === bg.url;
            return (
              <button
                key={bg.id}
                onClick={() => handleSelectPreset(bg.url)}
                className={`relative h-16 rounded-lg border-2 transition-all ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-border hover:border-accent/50"
                }`}
                style={{
                  background: bg.url || "hsl(var(--background))",
                }}
              >
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
                {bg.id === "none" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Inline mode: render content directly without dialog
  if (inline) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Image className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            {t("background.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
