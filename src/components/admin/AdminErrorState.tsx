import { LucideIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminErrorStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function AdminErrorState({ icon: Icon, title, description, onRetry, retrying }: AdminErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[400px]">
      <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <Icon className="h-10 w-10 text-destructive" />
      </div>
      <p className="text-destructive font-semibold text-lg">{title}</p>
      {description && <p className="text-sm text-muted-foreground text-center max-w-md">{description}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          Try Again
        </Button>
      )}
    </div>
  );
}
