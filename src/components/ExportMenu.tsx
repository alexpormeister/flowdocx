import { Download, FileImage, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  onExport: (format: "png" | "svg") => void;
}

export default function ExportMenu({ onExport }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50">
        <DropdownMenuItem onClick={() => onExport("png")} className="text-xs gap-2 cursor-pointer">
          <FileImage className="w-3.5 h-3.5" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("svg")} className="text-xs gap-2 cursor-pointer">
          <Image className="w-3.5 h-3.5" />
          Export as SVG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
