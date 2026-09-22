import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Team } from "@/types";

export function ReturningPlayerForm({ teams }: { teams: Team[] }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [profileId, setProfileId] = useState(""), [teamId, setTeamId] = useState(""), [squadType, setSquadType] = useState("RESERVE"), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const directory = useQuery({ queryKey: ["player-directory", q], queryFn: () => api.get<Array<{ id: string; firstName: string; lastName: string; dateOfBirth?: string }>>("/admin/player-directory", { q }), enabled: open });
  async function register() {
    setBusy(true); setError("");
    try { await api.post("/admin/players", { profileId, teamId, squadType }); await cache.invalidateQueries(); setOpen(false); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Register returning player</Button>{open && <div role="dialog" aria-modal="true" aria-label="Register returning player" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg space-y-4 rounded-xl bg-background p-5"><h3 className="font-semibold">Register an existing player</h3><p className="text-sm">Use their permanent profile to keep all previous seasons connected. Players already registered this season should be reactivated instead.</p><label className="block text-sm">Search name<input className="mt-1 w-full rounded border bg-background p-2" value={q} onChange={e => { setQ(e.target.value); setProfileId(""); }} /></label><label className="block text-sm">Player<select className="mt-1 w-full rounded border bg-background p-2" value={profileId} onChange={e => setProfileId(e.target.value)}><option value="">Choose player…</option>{directory.data?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.dateOfBirth ? ` · ${p.dateOfBirth.slice(0,10)}` : ""} · {p.id.slice(-6)}</option>)}</select></label>{directory.isError && <p className="text-destructive">Player directory could not be loaded.</p>}<label className="block text-sm">Team<select className="mt-1 w-full rounded border bg-background p-2" value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">Choose team…</option>{teams.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="block text-sm">Squad role<select className="mt-1 w-full rounded border bg-background p-2" value={squadType} onChange={e => setSquadType(e.target.value)}><option value="STARTER">Starter</option><option value="SUBSTITUTE">Substitute</option><option value="RESERVE">Reserve</option></select></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button disabled={!profileId || !teamId || busy} onClick={register}>Register</Button><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div></div></div>}</>;
}
