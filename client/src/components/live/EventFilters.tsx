import { memo } from "react";
import { cn } from "@/lib/utils";

export type TimelineFilter = "all" | "goals" | "cards" | "subs" | "var";

const filters: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "goals", label: "Goals" },
  { key: "cards", label: "Cards" },
  { key: "subs", label: "Subs" },
  { key: "var", label: "VAR" },
];

export const EventFilters = memo(function EventFilters({ value, onChange, counts }: {
  value: TimelineFilter;
  onChange: (f: TimelineFilter) => void;
  counts: Record<TimelineFilter, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95",
            value === f.key
              ? "bg-primary text-primary-foreground shadow"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          {f.label}
          {counts[f.key] > 0 && <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-[10px]">{counts[f.key]}</span>}
        </button>
      ))}
    </div>
  );
});
