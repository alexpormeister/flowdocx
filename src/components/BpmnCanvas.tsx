import { useEffect, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Maximize } from "lucide-react";

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="sample-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn"
  xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd">
  <bpmn2:collaboration id="Collaboration_1">
    <bpmn2:participant id="Participant_1" name="Process" processRef="Process_1" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:startEvent id="StartEvent_1" name="Start" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="222" y="182" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="228" y="225" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

interface BpmnCanvasProps {
  onModelerReady?: (modeler: BpmnModeler | BpmnViewer) => void;
  onSelectionChange?: (element: any) => void;
  readOnly?: boolean;
}

export default function BpmnCanvas({ onModelerReady, onSelectionChange, readOnly = false }: BpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | BpmnViewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const modeler = readOnly ? new BpmnViewer({
      container: containerRef.current,
    }) : new BpmnModeler({
      container: containerRef.current,
    });

    modelerRef.current = modeler;

    modeler.importXML(EMPTY_BPMN).then(() => {
      const canvas = modeler.get("canvas") as any;
      canvas.zoom("fit-viewport");
      onModelerReady?.(modeler);
    });

    // Listen for selection changes
    const eventBus = modeler.get("eventBus") as any;
    eventBus.on("selection.changed", (e: any) => {
      const selected = e.newSelection?.[0];
      onSelectionChange?.(selected || null);
    });

    return () => {
      modeler.destroy();
    };
  }, [readOnly]);

  const handleZoomIn = () => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas") as any;
    canvas.zoom(canvas.zoom() * 1.2);
  };

  const handleZoomOut = () => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas") as any;
    canvas.zoom(canvas.zoom() / 1.2);
  };

  const handleFitViewport = () => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas") as any;
    canvas.zoom("fit-viewport");
  };

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-canvas"
        style={{ minHeight: "100%" }}
      />
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-md"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-md"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-md"
          onClick={handleFitViewport}
          title="Fit to viewport"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { EMPTY_BPMN };
