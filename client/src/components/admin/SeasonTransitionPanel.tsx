import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Season } from "@/types";

type Preview = { fingerprint: string; sourceName: string; included: number; excluded: number; teams: Array<{ id: string; name: string; staff: number; sponsors: number }>; players: Array<{ id: string; name: string; teamName: string; included: boolean; reason: string }>; competitions: Array<{ id: string; name: string }> };
type Readiness = { ready: boolean; blockers: string[]; teams: number; players: number; fixtures: number };

export function SeasonTransitionPanel({ seasons, selectedId, onSelect }: { seasons: Season[]; selectedId: string; onSelect: (id: string) => void }) {
  const cache = useQueryClient();
  const selected = seasons.find(s => s.id === selectedId);
  const current = seasons.find(s => s.isCurrent);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [copyStaff, setCopyStaff] = useState(true);
  const [renewSponsors, setRenewSponsors] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const readiness = useQuery({ queryKey: ["season-readiness", selectedId], queryFn: () => api.get<Readiness>(`/admin/seasons/${selectedId}/readiness`), enabled: selected?.lifecycle === "DRAFT", staleTime: 0 });
  async function refresh() { await cache.invalidateQueries(); }
  async function prepare() {
    if (!current) return;
    setBusy(true); setError(""); setMessage("");
    try {
      setPreview(await api.get<Preview>(`/admin/seasons/${current.id}/next-preview`)); setSourceId(current.id); setRequestKey(crypto.randomUUID());
      setName(""); setStartDate(new Date(new Date(current.endDate).getTime() + 86400000).toISOString().slice(0, 10)); setEndDate("");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function create() {
    setBusy(true); setError("");
    try {
      const created = await api.post<Season>(`/admin/seasons/${sourceId}/create-next`, { name, startDate, endDate, fingerprint: preview!.fingerprint, requestKey, copyStaff, renewSponsors });
      onSelect(created.id); setPreview(null); setMessage("Draft created. Review teams, players and fixtures, then check readiness here."); await refresh();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function activate() {
    if (!confirm(`Activate ${selected?.name}? The current season will become read-only. All bans reset for the new season; past records remain available.`)) return;
    setBusy(true); setError("");
    try { await api.post(`/admin/seasons/${selectedId}/activate`, {}); await refresh(); setMessage("Season activated. Previous season history is preserved."); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="mb-5 space-y-4 rounded-2xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Season transition</h3><p className="text-sm text-muted-foreground">Keep existing teams. Start new statistics and bans at zero. Preserve every past season.</p></div><Button onClick={prepare} disabled={busy || !current}>Prepare next season</Button></div>
    <label className="flex flex-wrap items-center gap-2 text-sm">Season to manage <select className="rounded border bg-background p-2" value={selectedId} onChange={e => onSelect(e.target.value)}>{seasons.map(s => <option key={s.id} value={s.id}>{s.name} · {s.lifecycle || "ACTIVE"}{s.isCurrent ? " · Current" : ""}</option>)}</select></label>
    {selected?.lifecycle === "DRAFT" && <div className="space-y-3 rounded border p-3"><p className="font-medium">Draft · not visible to the public</p><p className="text-sm">Complete roster and fixture preparation in the other admin tabs. Return here to activate.</p><Button variant="outline" disabled={readiness.isFetching} onClick={() => void readiness.refetch()}>Check readiness</Button>{readiness.isError && <p role="alert" className="text-destructive">Could not check readiness. Retry before activating.</p>}{readiness.data && <><p className="text-sm">{readiness.data.teams} teams · {readiness.data.players} active players · {readiness.data.fixtures} fixtures</p><ul className="list-disc space-y-1 pl-5 text-sm">{readiness.data.blockers.map(b => <li key={b}>{b}</li>)}</ul><Button disabled={busy || !readiness.data.ready || readiness.isFetching} onClick={activate}>Activate season</Button></>}
      {selected.rolloverReport && <details><summary className="cursor-pointer text-sm">Rollover report</summary><p className="mt-2 text-sm">{selected.rolloverReport.included} players included · {selected.rolloverReport.excluded} excluded · Bans reset</p><ul className="max-h-48 overflow-auto text-sm">{selected.rolloverReport.players?.filter(p => !p.included).map(p => <li key={p.id}>{p.name}: {p.reason}</li>)}</ul></details>}
    </div>}
    {preview && <div className="space-y-4 border-t pt-4"><h4 className="font-semibold">Review carry-over from {preview.sourceName}</h4><p className="text-sm">{preview.teams.length} teams · {preview.included} returning players · {preview.excluded} excluded players</p><p className="text-sm">Competitions: {preview.competitions.map(c => c.name).join(", ") || "New league"}. Results, fixtures, awards, votes and bans are not copied.</p>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">New season name<input className="mt-1 w-full rounded border bg-background p-2" value={name} onChange={e => setName(e.target.value)} /></label><label className="text-sm">Start date<input type="date" className="mt-1 w-full rounded border bg-background p-2" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label className="text-sm">End date<input type="date" className="mt-1 w-full rounded border bg-background p-2" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copyStaff} onChange={e => setCopyStaff(e.target.checked)} />Continue staff assignments ({preview.teams.reduce((n,t) => n + t.staff, 0)}) and retain team managers</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={renewSponsors} onChange={e => setRenewSponsors(e.target.checked)} />Renew existing team sponsors ({preview.teams.reduce((n,t) => n + t.sponsors, 0)})</label>
      <div className="max-h-72 overflow-auto rounded border"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Outcome</th></tr></thead><tbody>{preview.players.map(p => <tr key={p.id} className="border-t"><td className="p-2">{p.name}</td><td className="p-2">{p.teamName}</td><td className="p-2">{p.reason}</td></tr>)}</tbody></table></div>
      <div className="flex gap-2"><Button disabled={busy || !name.trim() || !startDate || !endDate || endDate <= startDate} onClick={create}>{busy ? "Creating…" : "Create draft"}</Button><Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Cancel</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
