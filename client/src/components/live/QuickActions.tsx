import { Goal as GoalIcon, AlertTriangle, Play, Pause, Clock3, Flag, Undo2, Ban, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/types";

export type QuickAction =
  | "goal"
  | "awarded-goal"
  | "yellow"
  | "red"
  | "own-goal"
  | "penalty"
  | "missed-penalty"
  | "motm"
  | "start"
  | "pause"
  | "resume"
  | "half-time"
  | "full-time"
  | "undo";

export function QuickActions({ status, onAction, disabled }: {
  status: MatchStatus;
  onAction: (action: QuickAction) => void;
  disabled?: boolean;
}) {
  const isLive = status === "LIVE";

  const eventCards: { action: QuickAction; icon: React.ReactNode; label: string; desc: string; shortcut: string; tone: string }[] = [
    { action: "goal", icon: <GoalIcon className="h-5 w-5" />, label: "Goal", desc: "Scorer + assist", shortcut: "G", tone: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" },
    { action: "awarded-goal", icon: <GoalIcon className="h-5 w-5" />, label: "Awarded Goal", desc: "Late-team penalty", shortcut: "A", tone: "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20" },
    { action: "own-goal", icon: <GoalIcon className="h-5 w-5" />, label: "Own Goal", desc: "Opposition scorer", shortcut: "O", tone: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" },
    { action: "penalty", icon: <GoalIcon className="h-5 w-5" />, label: "Penalty Goal", desc: "Spot kick scored", shortcut: "P", tone: "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20" },
    { action: "missed-penalty", icon: <Ban className="h-5 w-5" />, label: "Missed Penalty", desc: "Saved or off target", shortcut: "M", tone: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" },
    { action: "yellow", icon: <span className="block h-3.5 w-2.5 rounded-[2px] bg-amber-400 shadow-sm" />, label: "Yellow Card", desc: "Caution", shortcut: "Y", tone: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" },
    { action: "red", icon: <span className="block h-3.5 w-2.5 rounded-[2px] bg-red-500 shadow-sm" />, label: "Red Card", desc: "Dismissal", shortcut: "R", tone: "bg-red-500/10 text-red-600 hover:bg-red-500/20" },
    { action: "motm", icon: <Star className="h-5 w-5" />, label: "Man of Match", desc: "Select award winner", shortcut: "★", tone: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" },
  ];

  const matchCards: { action: QuickAction; icon: React.ReactNode; label: string; desc: string; shortcut?: string; tone: string; hidden?: boolean }[] = [
    { action: "start", icon: <Play className="h-5 w-5" />, label: "Start", desc: "Kick off", shortcut: "Space", tone: "bg-emerald-600 text-white hover:bg-emerald-700", hidden: isLive || status === "COMPLETED" },
    { action: "pause", icon: <Pause className="h-5 w-5" />, label: "Pause", desc: "Hold the match", tone: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20", hidden: !isLive },
    { action: "resume", icon: <Play className="h-5 w-5" />, label: "Resume", desc: "Back to live", tone: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20", hidden: status !== "PAUSED" },
    { action: "half-time", icon: <Clock3 className="h-5 w-5" />, label: "Half Time", desc: "End first half", tone: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20", hidden: !isLive },
    { action: "full-time", icon: <Flag className="h-5 w-5" />, label: "Full Time", desc: "Finish match", tone: "bg-red-500/10 text-red-600 hover:bg-red-500/20", hidden: status === "COMPLETED" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {eventCards.map((c) => (
          <button
            key={c.action}
            onClick={() => onAction(c.action)}
            disabled={disabled}
            title={`${c.label} — ${c.desc}`}
            className={cn(
              "group relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] disabled:opacity-40",
              c.tone
            )}
          >
            <span className="absolute right-1.5 top-1.5 rounded bg-foreground/5 px-1 py-0.5 text-[9px] font-bold text-foreground/40">{c.shortcut}</span>
            {c.icon}
            <span className="text-xs font-bold leading-tight">{c.label}</span>
            <span className="hidden text-[10px] leading-tight opacity-70 sm:block">{c.desc}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {matchCards.filter((c) => !c.hidden).map((c) => (
          <button
            key={c.action}
            onClick={() => onAction(c.action)}
            disabled={disabled}
            title={c.label}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] disabled:opacity-40",
              c.tone
            )}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
        <button
          onClick={() => onAction("undo")}
          disabled={disabled}
          title="Undo last event (Ctrl+Z)"
          className="flex items-center justify-center gap-2 rounded-xl border bg-muted px-3 py-2.5 text-xs font-bold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> Undo
          <span className="hidden rounded bg-foreground/5 px-1 py-0.5 text-[9px] text-foreground/40 lg:inline">Ctrl+Z</span>
        </button>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" /> Scoreboard, timeline and player stats update instantly after every action.
      </p>
    </div>
  );
}
