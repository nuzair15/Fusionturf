import { useMemo, useState } from "react";
import { Search, Check, Trophy, CornerDownRight } from "lucide-react";
import type { LiveTeam } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { PlayerCard } from "./PlayerCard";
import { TeamLogo } from "./TeamLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type GoalType = "goal" | "own-goal" | "penalty";

const GOAL_LABEL: Record<GoalType, string> = {
  goal: "Goal",
  "own-goal": "Own Goal",
  penalty: "Penalty Goal",
};

type GoalPayload = { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal: boolean; isPenalty: boolean };

export function GoalDialog({ open, goalType, home, away, minute, onClose, onConfirm }: {
  open: boolean;
  goalType: GoalType;
  home: LiveTeam;
  away: LiveTeam;
  minute: number;
  onClose: () => void;
  onConfirm: (payload: GoalPayload) => Promise<boolean> | boolean;
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
    if (submitting) return;
    reset();
    onClose();
  };

  const filtered = useMemo(() => {
    if (!team) return [];
    const q = query.trim().toLowerCase();
    if (!q) return team.players;
    return team.players.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || String(p.jerseyNumber ?? "").includes(q));
  }, [team, query]);

  const submitGoal = async (selectedAssistId?: string | null) => {
    if (!team || !scorerId || submitting) return;
    setSubmitting(true);
    try {
      const saved = await onConfirm({
        teamId: team.id,
        scorerId,
        assistId: selectedAssistId || undefined,
        minute,
        isOwnGoal: goalType === "own-goal",
        isPenalty: goalType === "penalty",
      });
      if (saved) {
        reset();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = `${GOAL_LABEL[goalType]} - ${step === "team" ? "Choose Team" : step === "scorer" ? "Choose Scorer" : "Choose Assist (optional)"}`;

  return (
    <LiveDialog open={open} onClose={handleClose} title={title}
      footer={step === "assist" ? (
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setStep("scorer")} disabled={submitting}>Back</Button>
          <Button variant="outline" className="flex-1" onClick={() => void submitGoal(null)} disabled={submitting}>
            {submitting ? "Adding goal..." : "Add without assist"}
          </Button>
          <Button className="flex-1" onClick={() => void submitGoal(assistId)} disabled={!assistId || submitting}>
            {submitting ? "Adding goal..." : "Add with assist"}
          </Button>
        </div>
      ) : null}
    >
      {step === "team" && (
        <>
          {goalType === "own-goal" && (
            <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Own goal: choose the team the scorer plays for. The goal counts for the opposition.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[home, away].map((candidate) => (
              <button key={candidate.id} onClick={() => { setTeam(candidate); setStep("scorer"); setQuery(""); }} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]">
                <TeamLogo name={candidate.name} logoUrl={candidate.logoUrl} size="lg" />
                <p className="text-sm font-bold">{candidate.shortName || candidate.name}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "scorer" && team && (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players..." className="h-10 pl-9" />
          </div>
          <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {filtered.map((player) => <PlayerCard key={player.id} player={player} onSelect={() => { setScorerId(player.id); setStep("assist"); setQuery(""); }} />)}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No players found</p>}
          </div>
          <div className="mt-2 flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => setStep("team")}>Back</Button></div>
        </>
      )}

      {step === "assist" && team && scorerId && (
        <>
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
            <Trophy className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold">Scorer: <span className="text-emerald-700">{(() => { const scorer = team.players.find((player) => player.id === scorerId); return scorer ? `${scorer.firstName} ${scorer.lastName}` : ""; })()}</span></p>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assister (optional)..." className="h-10 pl-9" />
          </div>
          <div className="flex max-h-[38vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {filtered.filter((player) => player.id !== scorerId).map((player) => (
              <div key={player.id} className={cn("rounded-xl transition", assistId === player.id && "ring-2 ring-primary")}>
                <PlayerCard player={player} onSelect={() => setAssistId(player.id)} />
                {assistId === player.id && <Check className="mx-auto -mt-1 h-5 w-5 text-primary" />}
              </div>
            ))}
            {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No players found</p>}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CornerDownRight className="h-3.5 w-3.5" /> Choose an assist, or tap Add without assist to save the goal immediately.</p>
        </>
      )}
    </LiveDialog>
  );
}
