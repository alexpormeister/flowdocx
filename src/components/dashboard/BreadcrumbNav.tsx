import { useLanguage } from "@/contexts/LanguageContext";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import { type Folder } from "@/lib/api";

interface BreadcrumbNavProps {
  currentPath: Folder[];
  onNavigate: (folderId: string | null) => void;
}

export function BreadcrumbNav({ currentPath, onNavigate }: BreadcrumbNavProps) {
  const { t } = useLanguage();

  if (currentPath.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            onClick={() => onNavigate(null)}
            className="cursor-pointer flex items-center gap-1"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t("dashboard.allProjects")}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {currentPath.map((folder, index) => (
          <BreadcrumbItem key={folder.id}>
            <BreadcrumbSeparator />
            {index === currentPath.length - 1 ? (
              <BreadcrumbPage>{folder.name}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink
                onClick={() => onNavigate(folder.id)}
                className="cursor-pointer"
              >
                {folder.name}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
