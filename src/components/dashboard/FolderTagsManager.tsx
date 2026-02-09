import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface FolderTagsManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  inheritedTags?: string[];
}

export function FolderTagsManager({ tags, onTagsChange, inheritedTags = [] }: FolderTagsManagerProps) {
  const { t } = useLanguage();
  const [newTag, setNewTag] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed) && !inheritedTags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const allTags = [...new Set([...inheritedTags, ...tags])];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag className="w-4 h-4" />
          {t("folder.manageTags")}
          {allTags.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent text-accent-foreground rounded">
              {allTags.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("folder.systemTags")}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add new tag input */}
          <div className="flex gap-2">
            <Input
              placeholder={t("folder.addTagPlaceholder")}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleAddTag} disabled={!newTag.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Inherited tags (read-only) */}
          {inheritedTags.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t("folder.inheritedTags")}</p>
              <div className="flex flex-wrap gap-2">
                {inheritedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Folder's own tags */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("folder.folderTags")}</p>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("folder.noTags")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-accent text-accent-foreground"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {t("folder.tagsHelp")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
