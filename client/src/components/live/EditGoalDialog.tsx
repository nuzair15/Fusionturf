import { useEffect, useMemo, useState } from "react";
import type { LiveTeam, TimelineEvent } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EditGoalDialog({ event, home, away, onClose, onConfirm }: {
  event: TimelineEvent | null;
  home: LiveTeam;
  away: LiveTeam;
  onClose: () => void;
  onConfirm: (goalId: string, scorerId: string, minute: number) => Promise<boolean> | boolean;
}) {
  const team = event?.teamId === home.id ? home : event?.teamId === away.id ? away : null;
  const [scorerId, setScorerId] = useState<string | null>(event?.player?.id ?? null);
  const [minute, setMinute] = useState(event?.minute ?? 0);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setScorerId(event?.player?.id ?? null);
    setMinute(event?.minute ?? 0);
    setSubmitting(false);
  }, [event]);
  const selected = useMemo(() => team?.players.find((player) => player.id === scorerId), [team, scorerId]);
  if (!event || !team) return null;

  const save = async () => {
    if (!scorerId || submitting) return;
    setSubmitting(true);
    try { if (await onConfirm(event.id, scorerId, minute)) onClose(); } finally { setSubmitting(false); }
  };

  return <LiveDialog open={!!event} onClose={() => !submitting && onClose()} title="Edit goal">
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-muted-foreground">Goal minute
        <Input type="number" min={0} max={150} value={minute} onChange={(e) => setMinute(Math.max(0, Math.min(150, Number(e.target.value) || 0)))} className="mt-1" />
      </label>
      <p className="text-xs font-semibold text-muted-foreground">Scorer - {team.shortName || team.name}</p>
      <div className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto pr-1">
        {team.players.map((player) => <div key={player.id} className={scorerId === player.id ? "rounded-xl ring-2 ring-primary" : ""}><PlayerCard player={player} onSelect={() => setScorerId(player.id)} /></div>)}
      </div>
      <Button className="w-full" onClick={() => void save()} disabled={!selected || submitting}>{submitting ? "Saving..." : "Save goal"}</Button>
    </div>
  </LiveDialog>;
}
