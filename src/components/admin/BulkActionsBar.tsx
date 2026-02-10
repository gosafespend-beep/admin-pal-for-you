import { Ban, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onSuspend: () => void;
  onExport: () => void;
  isProcessing?: boolean;
}

export function BulkActionsBar({ selectedCount, onClear, onSuspend, onExport, isProcessing }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-2xl rounded-xl px-6 py-3 animate-fade-in">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} selected
      </span>
      <div className="h-6 w-px bg-border" />
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-warning border-warning/30 hover:bg-warning/10"
        onClick={onSuspend}
        disabled={isProcessing}
      >
        <Ban className="h-3.5 w-3.5" /> Suspend
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onExport}
        disabled={isProcessing}
      >
        <Download className="h-3.5 w-3.5" /> Export
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
