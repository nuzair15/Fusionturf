import { useEffect, useMemo, useState } from "react";
import type { LiveTeam, TimelineEvent } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EditableGoalType = "goal" | "penalty" | "own-goal";
export type GoalUpdatePayload = {
  teamId: string;
  scorerId: string;
  assistId?: string | null;
  minute: number;
  isOwnGoal: boolean;
  isPenalty: boolean;
};

const goalTypeFromEvent = (event: TimelineEvent | null): EditableGoalType =>
  event?.kind === "own-goal" ? "own-goal" : event?.kind === "penalty" ? "penalty" : "goal";

export function EditGoalDialog({ event, home, away, onClose, onConfirm }: {
  event: TimelineEvent | null;
  home: LiveTeam;
  away: LiveTeam;
  onClose: () => void;
  onConfirm: (goalId: string, payload: GoalUpdatePayload) => Promise<boolean> | boolean;
}) {
  const [teamId, setTeamId] = useState(event?.player?.teamId || event?.teamId || home.id);
  const [scorerId, setScorerId] = useState<string | null>(event?.player?.id ?? null);
  const [assistId, setAssistId] = useState<string | null>(event?.assistPlayer?.id ?? null);
  const [goalType, setGoalType] = useState<EditableGoalType>(goalTypeFromEvent(event));
  const [minute, setMinute] = useState(event?.minute ?? 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTeamId(event?.player?.teamId || event?.teamId || home.id);
    setScorerId(event?.player?.id ?? null);
    setAssistId(event?.assistPlayer?.id ?? null);
    setGoalType(goalTypeFromEvent(event));
    setMinute(event?.minute ?? 0);
    setSubmitting(false);
  }, [event, home.id]);

  const team = teamId === home.id ? home : away;
  const opponent = teamId === home.id ? away : home;
  const selected = useMemo(() => team.players.find((player) => player.id === scorerId), [team, scorerId]);
  if (!event) return null;

  const selectTeam = (nextTeamId: string) => {
    if (nextTeamId === teamId) return;
    setTeamId(nextTeamId);
    setScorerId(null);
    setAssistId(null);
  };

  const selectGoalType = (nextType: EditableGoalType) => {
    setGoalType(nextType);
    if (nextType === "own-goal") setAssistId(null);
  };

  const save = async () => {
    if (!scorerId || submitting) return;
    setSubmitting(true);
    try {
      const saved = await onConfirm(event.id, {
        teamId,
        scorerId,
        assistId: goalType === "own-goal" ? null : assistId,
        minute,
        isOwnGoal: goalType === "own-goal",
        isPenalty: goalType === "penalty",
      });
      if (saved) onClose();
    } finally { setSubmitting(false); }
  };

  return <LiveDialog open={!!event} onClose={() => !submitting && onClose()} title="Edit goal">
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(["goal", "penalty", "own-goal"] as const).map((type) => (
          <button key={type} type="button" onClick={() => selectGoalType(type)} className={cn("rounded-lg border px-2 py-2 text-xs font-semibold capitalize", goalType === type && "border-primary bg-primary/10 text-primary")}>
            {type.replace("-", " ")}
          </button>
        ))}
      </div>

      <label className="block text-xs font-semibold text-muted-foreground">Goal minute
        <Input type="number" min={0} max={150} value={minute} onChange={(e) => setMinute(Math.max(0, Math.min(150, Number(e.target.value) || 0)))} className="mt-1" />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Scorer's team</p>
        <div className="grid grid-cols-2 gap-2">
          {[home, away].map((candidate) => <button key={candidate.id} type="button" onClick={() => selectTeam(candidate.id)} className={cn("rounded-lg border px-3 py-2 text-sm font-bold", teamId === candidate.id && "border-primary bg-primary/10 text-primary")}>{candidate.shortName || candidate.name}</button>)}
        </div>
        {goalType === "own-goal" && <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">The scorer plays for {team.shortName || team.name}; the goal will count for {opponent.shortName || opponent.name}.</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Scorer</p>
        <div className="flex max-h-[28vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {team.players.map((player) => <div key={player.id} className={scorerId === player.id ? "rounded-xl ring-2 ring-primary" : ""}><PlayerCard player={player} onSelect={() => { setScorerId(player.id); if (assistId === player.id) setAssistId(null); }} /></div>)}
        </div>
      </div>

      {goalType !== "own-goal" && <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Assist (optional)</p>
          {assistId && <button type="button" className="text-xs text-primary" onClick={() => setAssistId(null)}>Remove assist</button>}
        </div>
        <div className="flex max-h-[22vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {team.players.filter((player) => player.id !== scorerId).map((player) => <div key={player.id} className={assistId === player.id ? "rounded-xl ring-2 ring-primary" : ""}><PlayerCard player={player} onSelect={() => setAssistId(player.id)} /></div>)}
        </div>
      </div>}

      <Button className="w-full" onClick={() => void save()} disabled={!selected || submitting}>{submitting ? "Saving correction..." : "Save goal changes"}</Button>
    </div>
  </LiveDialog>;
}
