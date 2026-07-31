import { useMemo, useState } from "react";
import { Search, ArrowDown } from "lucide-react";
import type { LiveTeam, LivePlayer } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { TeamLogo } from "./TeamLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SubstitutionDialog({ open, home, away, minute, subbedOffIds, subbedOnIds, onClose, onConfirm }: {
  open: boolean;
  home: LiveTeam;
  away: LiveTeam;
  minute: number;
  subbedOffIds: Set<string>;
  subbedOnIds: Set<string>;
  onClose: () => void;
  onConfirm: (payload: { teamId: string; playerOffId: string; playerOnId: string; minute: number }) => void;
}) {
  const [team, setTeam] = useState<LiveTeam | null>(null);
  const [offId, setOffId] = useState<string | null>(null);
  const [onId, setOnId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setTeam(null); setOffId(null); setOnId(null); setQuery(""); setSubmitting(false); };
  const handleClose = () => { reset(); onClose(); };

  const onPitch = useMemo(() => {
    if (!team) return [];
    // Starters still on the pitch, plus players brought on who are still on.
    return team.players.filter((p) =>
      !subbedOffIds.has(p.id) &&
      (p.squadType === "STARTER" || subbedOnIds.has(p.id))
    );
  }, [team, subbedOffIds, subbedOnIds]);

  const bench = useMemo(() => {
    if (!team) return [];
    // Unused substitutes / reserves who have never come on.
    return team.players.filter((p) =>
      p.id !== offId &&
      !subbedOnIds.has(p.id) &&
      !subbedOffIds.has(p.id) &&
      (p.squadType === "SUBSTITUTE" || p.squadType === "RESERVE" || p.squadType == null)
    );
  }, [team, subbedOnIds, subbedOffIds, offId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = onId ? bench : onPitch;
    if (!q) return pool;
    return pool.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || String(p.jerseyNumber ?? "").includes(q));
  }, [query, onId, bench, onPitch]);

  const selectOff = (p: LivePlayer) => { setOffId(p.id); setOnId(null); setQuery(""); };
  const selectOn = (p: LivePlayer) => { setOnId(p.id); setQuery(""); };

  const offPlayer = team?.players.find((p) => p.id === offId);
  const onPlayer = team?.players.find((p) => p.id === onId);
  const title = `Substitution — ${offPlayer ? (onPlayer ? "Preview" : "Choose Player On") : "Choose Player Off"}`;

  const confirm = async () => {
    if (!team || !offId || !onId) return;
    setSubmitting(true);
    try {
      await onConfirm({ teamId: team.id, playerOffId: offId, playerOnId: onId, minute });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LiveDialog open={open} onClose={handleClose} title={title}>
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
          {offPlayer && onPlayer && (
            <div className="mb-2 flex flex-col items-center gap-1 rounded-xl bg-blue-500/10 px-3 py-3">
              <PlayerCard player={offPlayer} />
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow"><ArrowDown className="h-4 w-4" /></span>
              <PlayerCard player={onPlayer} />
            </div>
          )}

          {!offPlayer && (
            <>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Player leaving the pitch</p>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="h-10 pl-9" />
              </div>
              <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto pr-1">
                {filtered.map((p) => (
                  <PlayerCard key={p.id} player={p} onSelect={() => selectOff(p)} />
                ))}
                {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No players on the pitch</p>}
              </div>
            </>
          )}

          {offPlayer && !onPlayer && (
            <>
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2">
                <p className="text-sm font-semibold">Off: <span className="text-red-600">{offPlayer.firstName} {offPlayer.lastName}</span></p>
              </div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Bench player coming on</p>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bench…" className="h-10 pl-9" />
              </div>
              <div className="flex max-h-[38vh] flex-col gap-1.5 overflow-y-auto pr-1">
                {filtered.map((p) => (
                  <div key={p.id} className={cn("rounded-xl transition", onId === p.id && "ring-2 ring-primary")}>
                    <PlayerCard player={p} onSelect={() => selectOn(p)} />
                  </div>
                ))}
                {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No bench players available</p>}
              </div>
            </>
          )}

          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              if (onId) { setOnId(null); setQuery(""); }
              else if (offId) { setOffId(null); setQuery(""); }
              else { setTeam(null); }
            }} disabled={submitting}>Back</Button>
            <Button className="ml-auto" disabled={!offId || !onId || submitting} onClick={confirm}>
              Confirm Substitution
            </Button>
          </div>
        </>
      )}
    </LiveDialog>
  );
}
