import { X } from "lucide-react";

const SYSTEM_COLORS: Record<string, string> = {
  iCabbi: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Outlook: "bg-blue-100 text-blue-800 border-blue-200",
  Netvisor: "bg-purple-100 text-purple-800 border-purple-200",
  SAP: "bg-amber-100 text-amber-800 border-amber-200",
  Salesforce: "bg-sky-100 text-sky-800 border-sky-200",
  Jira: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Slack: "bg-pink-100 text-pink-800 border-pink-200",
};

interface SystemTagBadgeProps {
  tag: string;
  onRemove?: () => void;
}

export default function SystemTagBadge({ tag, onRemove }: SystemTagBadgeProps) {
  const colors = SYSTEM_COLORS[tag] || "bg-tag text-tag-foreground border-tag";

  return (
    <span
      className={`inline-flex items-center gap-0.5 h-5 px-1.5 text-[10px] font-medium rounded border ${colors} transition-colors`}
    >
      {tag}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity ml-0.5"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
