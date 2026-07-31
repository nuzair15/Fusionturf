import { memo } from "react";
import { cn } from "@/lib/utils";

export interface FormationBadgeProps {
  formation: string | null;
  className?: string;
}

export const FormationBadge = memo(function FormationBadge({ formation, className }: FormationBadgeProps) {
  if (!formation) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-secondary/70 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground",
        className
      )}
    >
      Formation
      <span className="tabular-nums">{formation}</span>
    </span>
  );
});
