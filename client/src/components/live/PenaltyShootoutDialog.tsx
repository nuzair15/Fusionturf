import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LiveTeam } from "@/types/live";

export function PenaltyShootoutDialog({ open, home, away, busy, onClose, onConfirm }: {
  open: boolean;
  home: LiveTeam;
  away: LiveTeam;
  busy: boolean;
  onClose: () => void;
  onConfirm: (result: { penaltiesHomeScore: number; penaltiesAwayScore: number; winnerTeamId: string }) => Promise<void>;
}) {
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setHomeScore(0); setAwayScore(0); setError(""); }
  }, [open]);

  const submit = async () => {
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setError("Enter valid non-negative shootout scores.");
      return;
    }
    if (homeScore === awayScore) {
      setError("The penalty shootout must have a winner.");
      return;
    }
    setError("");
    await onConfirm({
      penaltiesHomeScore: homeScore,
      penaltiesAwayScore: awayScore,
      winnerTeamId: homeScore > awayScore ? home.id : away.id,
    });
  };

  return <Dialog open={open} onClose={() => { if (!busy) onClose(); }} title="Finish penalty shootout">
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter the completed shootout score. The winner is selected automatically.</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>{home.name}</Label><Input type="number" min={0} value={homeScore} onChange={(event) => setHomeScore(Number(event.target.value))} /></div>
        <div className="space-y-1.5"><Label>{away.name}</Label><Input type="number" min={0} value={awayScore} onChange={(event) => setAwayScore(Number(event.target.value))} /></div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Saving…" : "Complete match"}</Button></div>
    </div>
  </Dialog>;
}
