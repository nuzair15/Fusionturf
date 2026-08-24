import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { LiveTeam } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { TeamLogo } from "./TeamLogo";
import { Button } from "@/components/ui/button";

export function AwardedGoalDialog({ open, home, away, minute, onClose, onConfirm }: {
  open: boolean;
  home: LiveTeam;
  away: LiveTeam;
  minute: number;
  onClose: () => void;
  onConfirm: (teamId: string) => Promise<boolean> | boolean;
}) {
  const [submitting, setSubmitting] = useState(false);

  const award = async (teamId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (await onConfirm(teamId)) onClose();
    } finally { setSubmitting(false); }
  };

  return <LiveDialog open={open} onClose={() => !submitting && onClose()} title="Awarded team goal">
    <div className="space-y-3">
      <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700">Use this only for an administrative score, such as a team arriving late. It changes the score but is not credited to any player.</p>
      <div className="grid grid-cols-2 gap-3">
        {[home, away].map((team) => <button key={team.id} disabled={submitting} onClick={() => void award(team.id)} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 transition hover:border-rose-500/60 hover:shadow-md disabled:opacity-50">
          <TeamLogo name={team.name} logoUrl={team.logoUrl} size="lg" />
          <span className="text-sm font-bold">{team.shortName || team.name}</span>
          <span className="text-[11px] text-muted-foreground">Award +1 goal</span>
        </button>)}
      </div>
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Minute {minute}'</div>
      <Button variant="ghost" className="w-full" onClick={onClose} disabled={submitting}>Cancel</Button>
    </div>
  </LiveDialog>;
}
