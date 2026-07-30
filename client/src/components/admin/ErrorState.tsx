import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ message = "Something went wrong", onRetry, compact }: ErrorStateProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
        <span className="text-destructive">{message}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-destructive/60" />
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}
