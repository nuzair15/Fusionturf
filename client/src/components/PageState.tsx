import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 ${className}`} aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export function PageError({ title = "We couldn't load this page", description = "Please check your connection and try again.", onRetry, action }: { title?: string; description?: string; onRetry?: () => void; action?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[48vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertCircle className="h-6 w-6" aria-hidden="true" /></div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onRetry && <Button onClick={onRetry} className="gap-2"><RefreshCw className="h-4 w-4" /> Try again</Button>}
        {action}
      </div>
    </div>
  );
}

export function PageEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed bg-secondary/20 px-6 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
