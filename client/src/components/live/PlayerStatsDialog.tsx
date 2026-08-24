import { useEffect, useState } from "react";
import { Goal as GoalIcon, Star } from "lucide-react";
import type { LivePlayer, LiveTeam } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlayerStatType = "goal" | "assist" | "yellowCard" | "redCard";

const STAT_META: { key: PlayerStatType; label: string; color: string; chip?: string }[] = [
  { key: "goal", label: "Goals", color: "text-emerald-600", chip: "bg-emerald-500" },
  { key: "assist", label: "Assists", color: "text-blue-600", chip: "bg-blue-500" },
  { key: "yellowCard", label: "Yellow Cards", color: "text-amber-600", chip: "bg-amber-400" },
  { key: "redCard", label: "Red Cards", color: "text-red-600", chip: "bg-red-500" },
];

const STATE_KEY: Record<PlayerStatType, keyof { goals: number; assists: number; yellowCards: number; redCards: number }> = {
  goal: "goals",
  assist: "assists",
  yellowCard: "yellowCards",
  redCard: "redCards",
};

export function PlayerStatsDialog({ open, playerId, teamId, home, away, stripColor, manOfTheMatchId, ratings, onClose, onUpdateStat, onSetRating, onSetMotm }: {
  open: boolean;
  playerId: string | null;
  teamId: string | null;
  home: LiveTeam;
  away: LiveTeam;
  stripColor?: string;
  manOfTheMatchId?: string | null;
  ratings?: Record<string, number>;
  onClose: () => void;
  onUpdateStat: (statType: PlayerStatType, action: "increment" | "decrement") => Promise<void> | void;
  onSetRating: (rating: number) => Promise<void> | void;
  onSetMotm: (playerId: string | null) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  const player: LivePlayer | undefined = playerId ? [...home.players, ...away.players].find((p) => p.id === playerId) : undefined;
  const team = teamId === home.id ? home : teamId === away.id ? away : undefined;
  const [stats, setStats] = useState({ goals: 0, assists: 0, yellowCards: 0, redCards: 0 });

  useEffect(() => {
    if (!open) return;
    setStats({
      goals: player?.stats.goals ?? 0,
      assists: player?.stats.assists ?? 0,
      yellowCards: player?.stats.yellowCards ?? 0,
      redCards: player?.stats.redCards ?? 0,
    });
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playerId]);

  if (!open || !playerId || !team || !player) return null;

  const fullName = `${player.firstName} ${player.lastName}`;
  const rating = ratings?.[playerId];
  const isMotm = manOfTheMatchId === playerId;

  const changeStat = async (key: PlayerStatType, delta: 1 | -1) => {
    const action = delta === 1 ? "increment" : "decrement";
    const count = stats[STATE_KEY[key]];
    if (action === "decrement" && count <= 0) return;
    setBusy(true);
    try {
      await onUpdateStat(key, action);
      setStats((s) => ({ ...s, [STATE_KEY[key]]: Math.max(0, count + delta) }));
    } finally {
      setBusy(false);
    }
  };

  const changeRating = async (delta: 0.5 | -0.5) => {
    const next = Math.max(0, Math.min(10, Math.round(((rating ?? 0) + delta) * 2) / 2));
    if (next === rating) return;
    setBusy(true);
    try {
      await onSetRating(next);
    } finally {
      setBusy(false);
    }
  };

  const stepperBtn = "flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition active:scale-90 disabled:opacity-25";

  return (
    <LiveDialog
      open={open}
      onClose={onClose}
      title={`Player — ${team.shortName || team.name}`}
      footer={<Button className="w-full" onClick={onClose}>Done</Button>}
    >
      <div className="mb-4 flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
        {stripColor && <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: stripColor }} />}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><GoalIcon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{fullName}</p>
          <p className="text-xs text-muted-foreground">{team.name}</p>
        </div>
        <Button
          size="sm"
          variant={isMotm ? "default" : "outline"}
          className="gap-1.5"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onSetMotm(isMotm ? null : playerId); } finally { setBusy(false); } }}
        >
          <Star className={cn("h-4 w-4", isMotm && "fill-current")} /> {isMotm ? "MotM ✓" : "MotM"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-violet-500/10 p-3 text-center"><p className="text-xl font-black text-violet-700">{player.stats.shots}</p><p className="text-[10px] font-semibold uppercase text-muted-foreground">Shots</p></div>
          <div className="rounded-xl bg-cyan-500/10 p-3 text-center"><p className="text-xl font-black text-cyan-700">{player.stats.shotsOnTarget}</p><p className="text-[10px] font-semibold uppercase text-muted-foreground">On target</p></div>
        </div>
        {STAT_META.map((meta) => (
          <div key={meta.key} className="flex items-center justify-between rounded-xl border px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {meta.chip && <span className={cn("h-2.5 w-2.5 rounded-full", meta.chip)} />}
              {meta.label}
            </span>
            <div className="flex items-center gap-2">
              <button aria-label={`Decrease ${meta.label}`} className={cn(stepperBtn, "bg-muted text-muted-foreground hover:bg-accent")} disabled={busy} onClick={() => changeStat(meta.key, -1)}>−</button>
              <span className={cn("w-8 text-center text-lg font-black tabular-nums", meta.color)}>{stats[STATE_KEY[meta.key]]}</span>
              <button aria-label={`Increase ${meta.label}`} className={cn(stepperBtn, "bg-muted text-muted-foreground hover:bg-accent")} disabled={busy} onClick={() => changeStat(meta.key, 1)}>+</button>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Star className="h-3.5 w-3.5 text-amber-500" /> Match Rating
          </span>
          <div className="flex items-center gap-2">
            <button aria-label="Decrease rating" className={cn(stepperBtn, "bg-muted text-muted-foreground hover:bg-accent")} disabled={busy} onClick={() => changeRating(-0.5)}>−</button>
            <span className="w-12 text-center text-lg font-black tabular-nums text-amber-600">{rating != null ? rating.toFixed(1) : "—"}</span>
            <button aria-label="Increase rating" className={cn(stepperBtn, "bg-muted text-muted-foreground hover:bg-accent")} disabled={busy} onClick={() => changeRating(0.5)}>+</button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Changes update scoreboard, ratings and the MOTM award instantly. Use Undo / Delete in the timeline to fix mistakes.</p>
    </LiveDialog>
  );
}
