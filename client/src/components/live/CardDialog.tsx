import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { LiveTeam, LivePlayer } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { TeamLogo } from "./TeamLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CardDialog({ open, cardType, home, away, minute, onClose, onConfirm }: {
  open: boolean;
  cardType: "yellow" | "red";
  home: LiveTeam;
  away: LiveTeam;
  minute: number;
  onClose: () => void;
  onConfirm: (payload: { teamId: string; playerId: string; cardType: "yellow" | "red" }) => void;
}) {
  const [team, setTeam] = useState<LiveTeam | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setTeam(null); setPlayerId(null); setQuery(""); setSubmitting(false); };
  const handleClose = () => { reset(); onClose(); };

  const filtered = useMemo(() => {
    if (!team) return [];
    const q = query.trim().toLowerCase();
    const pool = team.players;
    if (!q) return pool;
    return pool.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || String(p.jerseyNumber ?? "").includes(q));
  }, [team, query]);

  const isYellow = cardType === "yellow";
  const title = isYellow ? "Yellow Card" : "Red Card";
  const cardColor = isYellow ? "bg-amber-400" : "bg-red-500";

  const confirm = async () => {
    if (!team || !playerId) return;
    setSubmitting(true);
    try {
      await onConfirm({ teamId: team.id, playerId, cardType });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LiveDialog open={open} onClose={handleClose} title={team && playerId ? `${title} — Confirm` : `${title} — ${team ? "Choose Player" : "Choose Team"}`}>
      {!team && (
        <div className="grid grid-cols-2 gap-3">
          {[home, away].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTeam(t); setQuery(""); }}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <TeamLogo name={t.name} logoUrl={t.logoUrl} size="lg" />
              <p className="text-sm font-bold">{t.shortName || t.name}</p>
            </button>
          ))}
        </div>
      )}

      {team && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className={cn("block h-4 w-2.5 rounded-[2px] shadow", cardColor)} />
            <p className="text-sm font-semibold">{title} — {team.shortName || team.name}</p>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="h-10 pl-9" />
          </div>
          <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {filtered.map((p) => (
              <div key={p.id} className={cn("rounded-xl transition", playerId === p.id && "ring-2 ring-primary")}>
                <PlayerCard player={p} onSelect={() => setPlayerId(p.id)} />
              </div>
            ))}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No players found</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setTeam(null); setPlayerId(null); }} disabled={submitting}>Back</Button>
            <Button
              className="ml-auto"
              variant={isYellow ? "default" : "destructive"}
              disabled={!playerId || submitting}
              onClick={confirm}
            >
              Give {isYellow ? "Yellow" : "Red"} Card
            </Button>
          </div>
        </>
      )}
    </LiveDialog>
  );
}
