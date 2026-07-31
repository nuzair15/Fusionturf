import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Clock3 } from "lucide-react";
import type { TimelineEvent } from "@/types/live";
import { EventFilters, type TimelineFilter } from "./EventFilters";
import { TimelineCard } from "./TimelineCard";

export function Timeline({ events, homeTeamId, onDelete, onUndo, onCopy, onView }: {
  events: TimelineEvent[];
  homeTeamId: string;
  onDelete: (event: TimelineEvent) => void;
  onUndo: (event: TimelineEvent) => void;
  onCopy: (event: TimelineEvent) => void;
  onView: (event: TimelineEvent) => void;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const counts = useMemo(() => {
    return {
      all: events.length,
      goals: events.filter((e) => ["goal", "own-goal", "penalty"].includes(e.kind)).length,
      cards: events.filter((e) => ["yellow", "red"].includes(e.kind)).length,
      subs: events.filter((e) => e.kind === "substitution").length,
      var: events.filter((e) => ["var", "missed-penalty"].includes(e.kind)).length,
    };
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "goals") return events.filter((e) => ["goal", "own-goal", "penalty"].includes(e.kind));
    if (filter === "cards") return events.filter((e) => ["yellow", "red"].includes(e.kind));
    if (filter === "subs") return events.filter((e) => e.kind === "substitution");
    return events.filter((e) => ["var", "missed-penalty"].includes(e.kind));
  }, [events, filter]);

  return (
    <div className="flex flex-col rounded-xl border bg-card/40">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Clock3 className="h-4 w-4 text-muted-foreground" /> Timeline
        </p>
        <EventFilters value={filter} onChange={setFilter} counts={counts} />
      </div>
      <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto p-2 lg:max-h-[60vh]">
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No events yet. Use Quick Actions to add the first one.</p>
        )}
        <AnimatePresence initial={false}>
          {filtered.map((e) => (
            <TimelineCard
              key={e.key}
              event={e}
              homeColor={e.teamId === homeTeamId ? "#22c55e" : undefined}
              onDelete={onDelete}
              onUndo={onUndo}
              onCopy={onCopy}
              onView={onView}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
