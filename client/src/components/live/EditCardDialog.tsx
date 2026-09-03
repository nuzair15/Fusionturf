import { useEffect, useMemo, useState } from "react";
import type { LiveCard, LiveTeam, TimelineEvent } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CardUpdatePayload = {
  teamId: string;
  playerId: string;
  type: LiveCard["type"];
  minute: number;
};

const cardOptions: Array<{ type: LiveCard["type"]; label: string }> = [
  { type: "YELLOW", label: "Yellow" },
  { type: "SECOND_YELLOW", label: "Second yellow" },
  { type: "RED", label: "Red" },
];

export function EditCardDialog({ event, home, away, onClose, onConfirm }: {
  event: TimelineEvent | null;
  home: LiveTeam;
  away: LiveTeam;
  onClose: () => void;
  onConfirm: (cardId: string, payload: CardUpdatePayload) => Promise<boolean> | boolean;
}) {
  const [teamId, setTeamId] = useState(event?.player?.teamId || event?.teamId || home.id);
  const [playerId, setPlayerId] = useState<string | null>(event?.player?.id ?? null);
  const [type, setType] = useState<LiveCard["type"]>(event?.cardType || (event?.kind === "red" ? "RED" : "YELLOW"));
  const [minute, setMinute] = useState(event?.minute ?? 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTeamId(event?.player?.teamId || event?.teamId || home.id);
    setPlayerId(event?.player?.id ?? null);
    setType(event?.cardType || (event?.kind === "red" ? "RED" : "YELLOW"));
    setMinute(event?.minute ?? 0);
    setSubmitting(false);
  }, [event, home.id]);

  const team = teamId === home.id ? home : away;
  const selected = useMemo(() => team.players.find((player) => player.id === playerId), [playerId, team]);
  if (!event) return null;

  const selectTeam = (nextTeamId: string) => {
    if (nextTeamId === teamId) return;
    setTeamId(nextTeamId);
    setPlayerId(null);
  };

  const save = async () => {
    if (!playerId || submitting) return;
    setSubmitting(true);
    try {
      const saved = await onConfirm(event.id, { teamId, playerId, type, minute });
      if (saved) onClose();
    } finally { setSubmitting(false); }
  };

  return <LiveDialog open={!!event} onClose={() => !submitting && onClose()} title="Edit card">
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {cardOptions.map((option) => <button key={option.type} type="button" onClick={() => setType(option.type)} className={cn("rounded-lg border px-2 py-2 text-xs font-semibold", type === option.type && "border-primary bg-primary/10 text-primary")}>{option.label}</button>)}
      </div>

      <label className="block text-xs font-semibold text-muted-foreground">Card minute
        <Input type="number" min={0} max={150} value={minute} onChange={(e) => setMinute(Math.max(0, Math.min(150, Number(e.target.value) || 0)))} className="mt-1" />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Team</p>
        <div className="grid grid-cols-2 gap-2">
          {[home, away].map((candidate) => <button key={candidate.id} type="button" onClick={() => selectTeam(candidate.id)} className={cn("rounded-lg border px-3 py-2 text-sm font-bold", teamId === candidate.id && "border-primary bg-primary/10 text-primary")}>{candidate.shortName || candidate.name}</button>)}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Player</p>
        <div className="flex max-h-[34vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {team.players.map((player) => <div key={player.id} className={playerId === player.id ? "rounded-xl ring-2 ring-primary" : ""}><PlayerCard player={player} onSelect={() => setPlayerId(player.id)} /></div>)}
        </div>
      </div>

      <Button className="w-full" onClick={() => void save()} disabled={!selected || submitting}>{submitting ? "Saving correction..." : "Save card changes"}</Button>
    </div>
  </LiveDialog>;
}
