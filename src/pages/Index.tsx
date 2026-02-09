import { useState, useCallback, useRef } from "react";
import { PanelRightClose, PanelRightOpen, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import BpmnCanvas from "@/components/BpmnCanvas";
import ProcessDataPanel, { type ProcessStep } from "@/components/ProcessDataPanel";
import ExportMenu from "@/components/ExportMenu";

export default function Index() {
  const [modeler, setModeler] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  const handleExport = useCallback(async (format: "png" | "svg") => {
    if (!modeler) return;

    try {
      if (format === "svg") {
        const { svg } = await modeler.saveSVG();
        downloadFile(svg, "process-diagram.svg", "image/svg+xml");
      } else {
        const { svg } = await modeler.saveSVG();
        // Convert SVG to PNG via canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new window.Image();
        const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx!.scale(2, 2);
          ctx!.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (blob) {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "process-diagram.png";
              a.click();
            }
          }, "image/png");
        };
        img.src = url;
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [modeler]);

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-accent" />
          <h1 className="text-sm font-semibold tracking-tight">
            BPMN Process Modeler
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu onExport={handleExport} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen(!panelOpen)}
            className="h-8 w-8 p-0"
          >
            {panelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <BpmnCanvas
            onModelerReady={setModeler}
            onSelectionChange={setSelectedElement}
          />
        </div>

        {/* Side Panel */}
        {panelOpen && (
          <div className="w-80 border-l bg-card flex flex-col shrink-0">
            <ProcessDataPanel
              steps={steps}
              onStepsChange={setSteps}
              selectedElementId={selectedElement?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
