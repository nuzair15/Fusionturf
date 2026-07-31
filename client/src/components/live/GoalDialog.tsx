import { useMemo, useState } from "react";
import { Search, Check, Trophy, CornerDownRight } from "lucide-react";
import type { LiveTeam, LivePlayer } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { TeamLogo } from "./TeamLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type GoalType = "goal" | "own-goal" | "penalty";

const GOAL_LABEL: Record<GoalType, string> = {
  "goal": "Goal",
  "own-goal": "Own Goal",
  "penalty": "Penalty Goal",
};

export function GoalDialog({ open, goalType, home, away, minute, onClose, onConfirm }: {
  open: boolean;
  goalType: GoalType;
  home: LiveTeam;
  away: LiveTeam;
  minute: number;
  onClose: () => void;
  onConfirm: (payload: { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal: boolean; isPenalty: boolean }) => void;
}) {
  const [team, setTeam] = useState<LiveTeam | null>(null);
  const [scorerId, setScorerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [step, setStep] = useState<"team" | "scorer" | "assist">("team");
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTeam(null); setScorerId(null); setAssistId(null); setStep("team"); setQuery(""); setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const filtered = useMemo(() => {
    if (!team) return [];
    const q = query.trim().toLowerCase();
    const pool = team.players;
    if (!q) return pool;
    return pool.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || String(p.jerseyNumber ?? "").includes(q));
  }, [team, query]);

  const confirm = async () => {
    if (!team || !scorerId) return;
    setSubmitting(true);
    try {
      await onConfirm({
        teamId: team.id,
        scorerId,
        assistId: assistId || undefined,
        minute,
        isOwnGoal: goalType === "own-goal",
        isPenalty: goalType === "penalty",
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title = `${GOAL_LABEL[goalType]} — ${step === "team" ? "Choose Team" : step === "scorer" ? "Choose Scorer" : "Choose Assist (optional)"}`;

  return (
    <LiveDialog open={open} onClose={handleClose} title={title}
      footer={
        step === "assist" ? (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setStep("scorer")} disabled={submitting}>Back</Button>
            <Button variant="outline" className="flex-1" onClick={async () => { await onConfirm({ teamId: team!.id, scorerId: scorerId!, minute, isOwnGoal: goalType === "own-goal", isPenalty: goalType === "penalty" }); reset(); onClose(); }} disabled={submitting}>
              No assist — {GOAL_LABEL[goalType]}
            </Button>
            <Button className="flex-1" onClick={confirm} disabled={!scorerId || submitting}>Confirm</Button>
          </div>
        ) : null
      }
    >
      {step === "team" && (
        <>
          {goalType === "own-goal" && (
            <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Own goal — choose the team the scorer plays for. The goal counts for the opposition.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[home, away].map((t) => (
              <button
                key={t.id}
                onClick={() => { setTeam(t); setStep("scorer"); setQuery(""); }}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
              >
                <TeamLogo name={t.name} logoUrl={t.logoUrl} size="lg" />
                <p className="text-sm font-bold">{t.shortName || t.name}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "scorer" && team && (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="h-10 pl-9" />
          </div>
          <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {filtered.map((p) => (
              <PlayerCard key={p.id} player={p} onSelect={() => { setScorerId(p.id); setStep("assist"); setQuery(""); }} />
            ))}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No players found</p>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("team")}>Back</Button>
          </div>
        </>
      )}

      {step === "assist" && team && scorerId && (
        <>
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
            <Trophy className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold">
              Scorer: <span className="text-emerald-700">{(() => { const s = team.players.find((p) => p.id === scorerId); return s ? `${s.firstName} ${s.lastName}` : ""; })()}</span>
            </p>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assister (optional)…" className="h-10 pl-9" />
          </div>
          <div className="flex max-h-[38vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {filtered.filter((p) => p.id !== scorerId).map((p) => (
              <div key={p.id} className={cn("rounded-xl transition", assistId === p.id && "ring-2 ring-primary")}>
                <PlayerCard
                  player={p}
                  onSelect={() => { setAssistId(p.id); }}
                />
                {assistId === p.id && <Check className="mx-auto -mt-1 h-5 w-5 text-primary" />}
              </div>
            ))}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No players found</p>}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CornerDownRight className="h-3.5 w-3.5" /> Assist is optional — confirm below to finish without one.
          </p>
        </>
      )}
    </LiveDialog>
  );
}
