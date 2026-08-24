import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Goal as GoalIcon, MoreVertical, Pencil, Trash2, Copy, Eye, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/live";
import { eventKindLabel } from "@/lib/liveTimeline";

export const TimelineCard = memo(function TimelineCard({ event, stripColor, teamName, onDelete, onUndo, onCopy, onView, onEditStats, onEditGoal }: {
  event: TimelineEvent;
  stripColor?: string;
  teamName?: string;
  onDelete: (event: TimelineEvent) => void;
  onUndo: (event: TimelineEvent) => void;
  onCopy: (event: TimelineEvent) => void;
  onView: (event: TimelineEvent) => void;
  onEditStats?: (event: TimelineEvent) => void;
  onEditGoal?: (event: TimelineEvent) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isGoal = event.kind === "goal" || event.kind === "awarded-goal" || event.kind === "own-goal" || event.kind === "penalty";
  const isCard = event.kind === "yellow" || event.kind === "red";

  const icon = (() => {
    if (isGoal) return <GoalIcon className="h-4 w-4" />;
    if (event.kind === "yellow") return <span className="block h-3 w-2 rounded-[2px] bg-amber-400 shadow" />;
    if (event.kind === "red") return <span className="block h-3 w-2 rounded-[2px] bg-red-500 shadow" />;
    if (event.kind === "substitution") return <span className="text-xs font-black">⇄</span>;
    if (event.kind === "var") return <span className="text-[10px] font-black">VAR</span>;
    return <span className="text-[10px] font-black">✗</span>;
  })();

  const iconBg = isGoal
    ? "bg-emerald-500/15 text-emerald-600"
    : event.kind === "yellow"
      ? "bg-amber-400/15 text-amber-500"
      : event.kind === "red"
        ? "bg-red-500/15 text-red-600"
        : event.kind === "substitution"
          ? "bg-blue-500/15 text-blue-600"
          : "bg-violet-500/15 text-violet-600";

  const teamBadge = teamName ? (
    <span className="inline-flex items-center gap-1.5 font-semibold" style={stripColor ? { color: stripColor } : undefined}>
      {stripColor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stripColor }} />}
      {teamName}
    </span>
  ) : null;

  const menuItems = [
    { label: "View Details", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => onView(event) },
    ...(onEditGoal && event.player && isGoal ? [{ label: "Edit Goal", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => { setMenuOpen(false); onEditGoal(event); } }] : []),
    ...(onEditStats && event.player && !isGoal ? [{ label: "Edit Player Stats", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => { setMenuOpen(false); onEditStats(event); } }] : []),
    { label: "Undo", icon: <Undo2 className="h-3.5 w-3.5" />, onClick: () => { setMenuOpen(false); onUndo(event); } },
    { label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => { setMenuOpen(false); onDelete(event); } },
    { label: "Copy", icon: <Copy className="h-3.5 w-3.5" />, onClick: () => { setMenuOpen(false); onCopy(event); } },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18 }}
      className={cn("relative rounded-xl border bg-card shadow-sm", menuOpen && "z-30")}
    >
      {stripColor && <span className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: stripColor }} />}
      <div className="flex items-center gap-3 p-3 pl-4">
        <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums text-muted-foreground">{event.minute}'</span>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconBg)}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{eventKindLabel[event.kind]}</p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 truncate text-xs text-muted-foreground">
            {teamBadge}
            {event.kind === "awarded-goal" && <span>Administrative team goal</span>}
            {isGoal && event.kind !== "awarded-goal" && <span>{event.player ? `${event.player.firstName} ${event.player.lastName}` : "Unknown"}</span>}
            {isCard && <span>{event.player ? `${event.player.firstName} ${event.player.lastName}` : "Unknown"}</span>}
            {event.kind === "substitution" && (
              <span className="flex items-center gap-1">
                <span className="text-red-500 line-through">{event.playerOff?.firstName} {event.playerOff?.lastName}</span>
                <span className="text-emerald-600">→ {event.playerOn?.firstName} {event.playerOn?.lastName}</span>
              </span>
            )}
            {event.kind === "var" && <span>{event.player ? `${event.player.firstName} ${event.player.lastName}` : event.note || "Video review"}</span>}
            {event.kind === "missed-penalty" && <span>{event.player ? `${event.player.firstName} ${event.player.lastName}` : event.note || "Missed penalty"}</span>}
            {event.kind === "own-goal" && <span>{event.player ? `${event.player.firstName} ${event.player.lastName} (OG)` : "Own goal"}</span>}
            {event.kind === "penalty" && <span>{event.player ? `${event.player.firstName} ${event.player.lastName} (PEN)` : "Penalty"}</span>}
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Event options"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-lg border bg-popover shadow-lg">
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-accent"
                  >
                    {item.icon}{item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
