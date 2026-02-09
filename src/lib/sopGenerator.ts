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

export function generateSOPDocument(
  projectName: string,
  steps: ProcessStep[],
  swot: SwotData,
  sipoc: SipocData,
  systemTags: string[]
): string {
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let doc = `
================================================================================
STANDARD OPERATING PROCEDURE (SOP)
================================================================================

Document Title: ${projectName}
Generated Date: ${now}
Version: 1.0

--------------------------------------------------------------------------------
1. PURPOSE
--------------------------------------------------------------------------------
This document describes the standard operating procedure for the "${projectName}" 
process flow.

--------------------------------------------------------------------------------
2. SCOPE
--------------------------------------------------------------------------------
`;

  if (sipoc.suppliers || sipoc.customers) {
    doc += `
Suppliers: ${sipoc.suppliers || "N/A"}
Customers: ${sipoc.customers || "N/A"}
`;
  }

  doc += `
--------------------------------------------------------------------------------
3. SYSTEMS & TOOLS INVOLVED
--------------------------------------------------------------------------------
`;

  if (systemTags.length > 0) {
    systemTags.forEach((tag, i) => {
      doc += `  ${i + 1}. ${tag}\n`;
    });
  } else {
    doc += "  No systems documented.\n";
  }

  doc += `
--------------------------------------------------------------------------------
4. INPUTS & OUTPUTS
--------------------------------------------------------------------------------
INPUTS:
${sipoc.inputs || "  Not specified."}

OUTPUTS:
${sipoc.outputs || "  Not specified."}

--------------------------------------------------------------------------------
5. PROCEDURE STEPS
--------------------------------------------------------------------------------
`;

  if (steps.length === 0) {
    doc += "  No steps documented.\n";
  } else {
    steps.forEach((step) => {
      doc += `
Step ${step.step}: ${step.task || "[Untitled Task]"}
  Performer: ${step.performer || "N/A"}
  Systems Used: ${step.system.length > 0 ? step.system.join(", ") : "None"}
  Decision Point: ${step.decision || "None"}
`;
    });
  }

  doc += `
--------------------------------------------------------------------------------
6. SWOT ANALYSIS
--------------------------------------------------------------------------------

STRENGTHS:
${swot.strengths || "  Not documented."}

WEAKNESSES:
${swot.weaknesses || "  Not documented."}

OPPORTUNITIES:
${swot.opportunities || "  Not documented."}

THREATS:
${swot.threats || "  Not documented."}

--------------------------------------------------------------------------------
7. REVISION HISTORY
--------------------------------------------------------------------------------
| Version | Date       | Author        | Changes                |
|---------|------------|---------------|------------------------|
| 1.0     | ${now.padEnd(10)} | Auto-Generated | Initial document       |

================================================================================
                            END OF DOCUMENT
================================================================================
`;

  return doc;
}

export function downloadSOP(content: string, projectName: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, "_")}_SOP.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
