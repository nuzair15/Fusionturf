import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Player } from "@/types";

export function PlayerActivityAction({ player }: { player: Player }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [clear, setClear] = useState(false);
  const [reason, setReason] = useState(""), [error, setError] = useState("");
  const active = player.isActive !== false;
  async function save() {
    setBusy(true); setError("");
    try { await api.patch(`/admin/players/${player.id}`, { isActive: !active, activityReason: reason, clearFutureSquads: clear }); await cache.invalidateQueries(); setOpen(false); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{active ? "Mark inactive" : "Reactivate"}</Button>{open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Change player activity"><div className="w-full max-w-md space-y-4 rounded-xl bg-background p-5 shadow-xl"><h3 className="font-semibold">{active ? "Mark inactive" : "Reactivate"}: {player.firstName} {player.lastName}</h3><p className="text-sm">This changes eligibility in this season. Past appearances, statistics and awards remain visible.</p><label className="block text-sm">Reason<textarea className="mt-1 w-full rounded border bg-background p-2" value={reason} onChange={e => setReason(e.target.value)} /></label>{active && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clear} onChange={e => setClear(e.target.checked)} />Remove from upcoming match squads if selected</label>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button disabled={busy || !reason.trim()} onClick={save}>Save status</Button><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div></div></div>}</>;
}
