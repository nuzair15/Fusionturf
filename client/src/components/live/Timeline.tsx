import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Clock3 } from "lucide-react";
import type { TimelineEvent } from "@/types/live";
import { EventFilters, type TimelineFilter } from "./EventFilters";
import { TimelineCard } from "./TimelineCard";

export const HOME_COLOR = "#22c55e";
export const AWAY_COLOR = "#3b82f6";

export function Timeline({ events, homeTeamId, awayTeamId, homeName, awayName, onDelete, onUndo, onCopy, onView, onEditStats, onEditGoal, onEditCard }: {
  events: TimelineEvent[];
  homeTeamId: string;
  awayTeamId: string;
  homeName?: string;
  awayName?: string;
  onDelete: (event: TimelineEvent) => void;
  onUndo: (event: TimelineEvent) => void;
  onCopy: (event: TimelineEvent) => void;
  onView: (event: TimelineEvent) => void;
  onEditStats?: (event: TimelineEvent) => void;
  onEditGoal?: (event: TimelineEvent) => void;
  onEditCard?: (event: TimelineEvent) => void;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const counts = useMemo(() => {
    return {
      all: events.length,
      goals: events.filter((e) => ["goal", "awarded-goal", "own-goal", "penalty"].includes(e.kind)).length,
      cards: events.filter((e) => ["yellow", "red"].includes(e.kind)).length,
      subs: events.filter((e) => e.kind === "substitution").length,
      var: events.filter((e) => ["var", "missed-penalty"].includes(e.kind)).length,
    };
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "goals") return events.filter((e) => ["goal", "awarded-goal", "own-goal", "penalty"].includes(e.kind));
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
              stripColor={e.teamId === homeTeamId ? HOME_COLOR : e.teamId === awayTeamId ? AWAY_COLOR : undefined}
              teamName={e.teamId === homeTeamId ? homeName : e.teamId === awayTeamId ? awayName : undefined}
              onDelete={onDelete}
              onUndo={onUndo}
              onCopy={onCopy}
              onView={onView}
              onEditStats={onEditStats}
              onEditGoal={onEditGoal}
              onEditCard={onEditCard}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
