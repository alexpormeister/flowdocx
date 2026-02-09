import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, TrendingUp, Table2 } from "lucide-react";
import { ProcessStep } from "@/components/ProcessDataPanel";

interface SwotData {
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
}

interface SipocData {
  suppliers: string;
  inputs: string;
  process: string;
  outputs: string;
  customers: string;
}

interface StrategicAnalysisPanelProps {
  steps: ProcessStep[];
  swot: SwotData;
  sipoc: SipocData;
  onSwotChange: (swot: SwotData) => void;
  onSipocChange: (sipoc: SipocData) => void;
  onGenerateSOP: () => void;
}

export default function StrategicAnalysisPanel({
  steps,
  swot,
  sipoc,
  onSwotChange,
  onSipocChange,
  onGenerateSOP,
}: StrategicAnalysisPanelProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("heatmap");

  // Calculate system tag frequency for heatmap
  const systemCounts = steps.reduce((acc, step) => {
    step.system.forEach((sys) => {
      acc[sys] = (acc[sys] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const systemEntries = Object.entries(systemCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...Object.values(systemCounts), 1);

  const getHeatmapColor = (count: number) => {
    const intensity = count / maxCount;
    if (intensity > 0.7) return "bg-red-500";
    if (intensity > 0.4) return "bg-orange-400";
    if (intensity > 0.2) return "bg-yellow-400";
    return "bg-green-400";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-panel-header px-4 py-3">
        <h2 className="text-sm font-semibold text-panel-header-foreground tracking-wide uppercase flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          {t("strategic.analysis")}
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-3 h-8">
          <TabsTrigger value="heatmap" className="text-xs">Heatmap</TabsTrigger>
          <TabsTrigger value="swot" className="text-xs">SWOT</TabsTrigger>
          <TabsTrigger value="sipoc" className="text-xs">SIPOC</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="p-3">
            <TabsContent value="heatmap" className="m-0 space-y-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-medium">{t("strategic.systemHeatmap")}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {systemEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No systems tagged yet.</p>
                  ) : (
                    systemEntries.map(([system, count]) => (
                      <div key={system} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${getHeatmapColor(count)}`} />
                        <span className="text-xs flex-1">{system}</span>
                        <span className="text-xs text-muted-foreground font-mono">{count}x</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Button onClick={onGenerateSOP} className="w-full text-xs h-8 gap-1.5">
                <FileText className="w-3 h-3" />
                {t("strategic.generateSOP")}
              </Button>
            </TabsContent>

            <TabsContent value="swot" className="m-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-accent">{t("strategic.strengths")}</label>
                  <Textarea
                    value={swot.strengths}
                    onChange={(e) => onSwotChange({ ...swot, strengths: e.target.value })}
                    className="h-20 text-xs resize-none"
                    placeholder="..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-destructive">{t("strategic.weaknesses")}</label>
                  <Textarea
                    value={swot.weaknesses}
                    onChange={(e) => onSwotChange({ ...swot, weaknesses: e.target.value })}
                    className="h-20 text-xs resize-none"
                    placeholder="..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-primary">{t("strategic.opportunities")}</label>
                  <Textarea
                    value={swot.opportunities}
                    onChange={(e) => onSwotChange({ ...swot, opportunities: e.target.value })}
                    className="h-20 text-xs resize-none"
                    placeholder="..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("strategic.threats")}</label>
                  <Textarea
                    value={swot.threats}
                    onChange={(e) => onSwotChange({ ...swot, threats: e.target.value })}
                    className="h-20 text-xs resize-none"
                    placeholder="..."
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sipoc" className="m-0 space-y-2">
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <Table2 className="w-3 h-3" />
                    {t("strategic.sipoc")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {[
                    { key: "suppliers" as const, label: t("strategic.suppliers"), placeholder: "Who provides inputs?" },
                    { key: "inputs" as const, label: t("strategic.inputs"), placeholder: "What inputs are needed?" },
                    { key: "process" as const, label: t("strategic.process"), placeholder: "High-level process steps" },
                    { key: "outputs" as const, label: t("strategic.outputs"), placeholder: "What outputs are produced?" },
                    { key: "customers" as const, label: t("strategic.customers"), placeholder: "Who receives outputs?" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium">{label}</label>
                      <Textarea
                        value={sipoc[key]}
                        onChange={(e) => onSipocChange({ ...sipoc, [key]: e.target.value })}
                        className="h-14 text-xs resize-none"
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
