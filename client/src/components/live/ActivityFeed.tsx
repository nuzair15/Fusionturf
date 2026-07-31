import { memo } from "react";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityTone = "success" | "error" | "warning" | "info";

export interface ActivityItem {
  id: number;
  text: string;
  tone: ActivityTone;
  time: string;
}

export const ActivityFeed = memo(function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const dot: Record<ActivityTone, string> = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
  };
  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
        <ListChecks className="h-4 w-4 text-muted-foreground" /> Activity
      </p>
      {items.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", dot[item.tone])} />
              <span className="flex-1 leading-tight">{item.text}</span>
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{item.time}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
