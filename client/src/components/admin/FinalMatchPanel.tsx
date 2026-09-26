import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaginatedResponse, Venue } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type FinalPreview = {
  seasonName: string;
  ready: boolean;
  reason: string | null;
  completedMatches: number;
  pendingMatches: number;
  finalists: Array<{ id: string; name: string; points: number; headToHeadGoalDifference: number | null }>;
  suggestedDate: string;
  final: { id: string; homeTeamId: string; awayTeamId: string; status: string; scheduledDate: string | null; kickoffTime: string | null; venueId: string | null; stadium: string | null } | null;
};

export function FinalMatchPanel({ seasonId, onSaved }: { seasonId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venueId, setVenueId] = useState("");
  const [stadium, setStadium] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const initializedFor = useRef<string | null>(null);
  const preview = useQuery({ queryKey: ["league-final-preview", seasonId], queryFn: () => api.get<FinalPreview>(`/admin/seasons/${seasonId}/final-preview`), enabled: open && !!seasonId, staleTime: 0 });
  const venues = useQuery({ queryKey: ["final-venues"], queryFn: () => api.get<PaginatedResponse<Venue>>("/bookings/venues", { limit: 100 }), enabled: open, staleTime: 60000 });

  useEffect(() => {
    if (!open) { initializedFor.current = null; return; }
    if (!preview.data || initializedFor.current === seasonId) return;
    initializedFor.current = seasonId;
    setDate(preview.data.final?.scheduledDate || preview.data.suggestedDate);
    setTime(preview.data.final?.kickoffTime || "18:00");
    setVenueId(preview.data.final?.venueId || "");
    setStadium(preview.data.final?.stadium || "");
  }, [open, preview.data, seasonId]);

  async function save() {
    setSaving(true); setError("");
    try {
      await api.post(`/admin/seasons/${seasonId}/final`, { matchDate: date, kickoffTime: time, venueId, stadium });
      setOpen(false);
      setMessage("Final match saved with the top two teams.");
      onSaved();
    } catch (cause: any) { setError(cause.message || "Could not set the final match"); }
    finally { setSaving(false); }
  }

  const finalLocked = !!preview.data?.final && !["SCHEDULED", "POSTPONED"].includes(preview.data.final.status);
  return <section className="mb-5 rounded-2xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">League final</h3><p className="text-sm text-muted-foreground">The top two teams qualify. Equal points are decided by head-to-head goal difference.</p></div>
      <Button variant="outline" disabled={!seasonId} onClick={() => { setError(""); setMessage(""); setOpen(true); }}>Set final match</Button>
    </div>
    {message && <p role="status" className="mt-2 text-sm text-emerald-600">{message}</p>}
    <Dialog open={open} onClose={() => { if (!saving) setOpen(false); }} title="Set league final">
      <div className="space-y-4">
        {preview.isLoading && <p className="text-sm text-muted-foreground">Checking the league table…</p>}
        {preview.isError && <p role="alert" className="text-sm text-destructive">Could not load the final preview. Close and try again.</p>}
        {preview.data && <>
          <p className="text-sm text-muted-foreground">{preview.data.seasonName} · {preview.data.completedMatches} completed league matches{preview.data.pendingMatches ? ` · ${preview.data.pendingMatches} still pending` : ""}</p>
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">Automatically selected finalists</p>
            {preview.data.finalists.map((team, index) => <p key={team.id} className="mt-1">{index + 1}. {team.name} · {team.points} points{team.headToHeadGoalDifference !== null ? ` · H2H GD ${team.headToHeadGoalDifference > 0 ? "+" : ""}${team.headToHeadGoalDifference}` : ""}</p>)}
            {preview.data.finalists.length === 2 && preview.data.finalists[0].points === preview.data.finalists[1].points && <p className="mt-2 text-xs text-muted-foreground">Tied on points: head-to-head goal difference decides the order.</p>}
          </div>
          {!preview.data.ready && <p role="status" className="text-sm text-amber-600">{preview.data.reason}</p>}
          {preview.data.final && <p className="text-sm text-muted-foreground">Existing final: {preview.data.final.status}. {finalLocked ? "Its teams and schedule are locked after kickoff." : "Saving updates this match instead of creating another."}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="league-final-date">Final date</Label><Input id="league-final-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div><Label htmlFor="league-final-time">Kickoff time</Label><Input id="league-final-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div>
          </div>
          <div><Label htmlFor="league-final-venue">Venue</Label><Select id="league-final-venue" value={venueId} onChange={(event) => setVenueId(event.target.value)}><option value="">Select a venue</option>{(venues.data?.data || []).map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</Select></div>
          <div><Label htmlFor="league-final-stadium">Stadium name (optional)</Label><Input id="league-final-stadium" value={stadium} onChange={(event) => setStadium(event.target.value)} placeholder="Uses the venue name if left blank" /></div>
          {venues.isError && <p role="alert" className="text-sm text-destructive">Could not load venues.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || !preview.data.ready || finalLocked || !date || !time || !venueId} onClick={save}>{saving ? "Saving…" : preview.data.final ? "Update final" : "Create final"}</Button></div>
        </>}
      </div>
    </Dialog>
  </section>;
}
