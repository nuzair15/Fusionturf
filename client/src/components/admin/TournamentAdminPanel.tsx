import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Trophy, Plus, Play, CalendarDays, Users, Pencil, Trash2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "./ImageUpload";
import { MatchControlCenter } from "@/components/live/MatchControlCenter";
import { tournamentLiveMatchApi } from "@/services/tournamentLiveMatchApi";
import type { Tournament, TournamentFixture, TournamentFormat, TournamentPlayer, TournamentTeam } from "@/types/tournament";
import { TOURNAMENT_FORMAT_LABEL } from "@/types/tournament";
import { tournamentDateTimeInput, tournamentDateTimeIso } from "@/lib/tournamentTime";

const emptyTournament = {
  name: "", slug: "", description: "", logoUrl: "", format: "ROUND_ROBIN" as TournamentFormat,
  startDate: "", endDate: "", lineupSize: 6, halfLengthMinutes: 30, halftimeBreakMinutes: 10,
  matchesPerPair: 1, groupCount: 2, qualifiersPerGroup: 2,
  timezone: "Asia/Kolkata", kickoffTime: "08:00", matchIntervalMinutes: 45, matchesPerDay: 2,
};
const emptyTeam = { name: "", shortName: "", logoUrl: "", city: "", coach: "", contact: "", description: "", groupName: "", seed: "" };
const emptyPlayer = { firstName: "", lastName: "", jerseyNumber: "", position: "", photoUrl: "", nationality: "", dateOfBirth: "" };
const emptyFixture = { homeTeamId: "", awayTeamId: "", kickoffAt: "", stage: "LEAGUE", round: 1, groupName: "" };
const fixtureStages: Record<TournamentFormat, string[]> = {
  ROUND_ROBIN: ["LEAGUE"], SINGLE_ELIMINATION: ["KNOCKOUT", "FINAL"],
  DOUBLE_ROUND_ROBIN_FINAL: ["LEAGUE", "FINAL"],
  DOUBLE_ELIMINATION: ["WINNERS", "LOSERS", "FINAL"], GROUPS_KNOCKOUT: ["GROUP", "KNOCKOUT", "FINAL"],
};
const dateOnly = (value?: string | null) => value ? value.slice(0, 10) : "";
const shortDate = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));

export function TournamentAdminPanel() {
  const qc = useQueryClient();
  const { data: list, isLoading, isError, refetch } = useQuery({ queryKey: ["admin-tournaments"], queryFn: () => api.get<Tournament[]>("/admin/tournaments") });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: tournament, refetch: refetchTournament } = useQuery({ queryKey: ["admin-tournament", selectedId], queryFn: () => api.get<Tournament>(`/admin/tournaments/${selectedId}`), enabled: !!selectedId });
  const [section, setSection] = useState<"setup" | "teams" | "fixtures">("setup");
  const [tournamentForm, setTournamentForm] = useState(emptyTournament);
  const [creating, setCreating] = useState(false);
  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [playerTeamId, setPlayerTeamId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [fixtureForm, setFixtureForm] = useState(emptyFixture);
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [lineupFixtureId, setLineupFixtureId] = useState<string | null>(null);
  const [lineupDraft, setLineupDraft] = useState({ homeStarterIds: [] as string[], awayStarterIds: [] as string[], homeSubstituteIds: [] as string[], awaySubstituteIds: [] as string[] });
  const [liveFixtureId, setLiveFixtureId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedId && list?.length && !creating) setSelectedId(list[0].id);
  }, [list, selectedId, creating]);
  useEffect(() => {
    if (!tournament || creating) return;
    setTournamentForm({
      name: tournament.name, slug: tournament.slug, description: tournament.description || "", logoUrl: tournament.logoUrl || "",
      format: tournament.format, startDate: dateOnly(tournament.startDate), endDate: dateOnly(tournament.endDate),
      lineupSize: tournament.lineupSize, halfLengthMinutes: tournament.halfLengthMinutes, halftimeBreakMinutes: tournament.halftimeBreakMinutes,
      matchesPerPair: tournament.matchesPerPair, groupCount: tournament.groupCount || 2, qualifiersPerGroup: tournament.qualifiersPerGroup || 2,
      timezone: tournament.timezone, kickoffTime: tournament.kickoffTime || "08:00", matchIntervalMinutes: tournament.matchIntervalMinutes, matchesPerDay: tournament.matchesPerDay,
    });
  }, [tournament, creating]);
  useEffect(() => {
    if (tournament && !editingFixtureId) setFixtureForm({ ...emptyFixture, stage: fixtureStages[tournament.format][0] });
  }, [tournament?.id, tournament?.format, editingFixtureId]);
  const fixture = tournament?.fixtures.find(f => f.id === lineupFixtureId);
  const liveApi = useMemo(() => selectedId ? tournamentLiveMatchApi(selectedId) : undefined, [selectedId]);
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["admin-tournaments"] }), qc.invalidateQueries({ queryKey: ["admin-tournament", selectedId] }), qc.invalidateQueries({ queryKey: ["tournaments"] })]); };
  const act = async (fn: () => Promise<unknown>, success: string) => {
    setError(""); setMessage(""); setBusy(true);
    try { await fn(); await refresh(); setMessage(success); return true; }
    catch (e: any) { setError(e.message || "Action failed"); return false; }
    finally { setBusy(false); }
  };
  const saveTournament = async () => {
    const body = { ...tournamentForm, name: tournamentForm.name.trim(), slug: tournamentForm.slug.trim(), startDate: tournamentForm.startDate || null, endDate: tournamentForm.endDate || null, groupCount: tournamentForm.format === "GROUPS_KNOCKOUT" ? Number(tournamentForm.groupCount) : null, qualifiersPerGroup: tournamentForm.format === "GROUPS_KNOCKOUT" ? Number(tournamentForm.qualifiersPerGroup) : null, logoUrl: tournamentForm.logoUrl || null, kickoffTime: tournamentForm.kickoffTime || null };
    if (body.name.length < 2) { setError("Tournament name must contain at least 2 characters."); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) { setError("URL slug can contain lowercase letters, numbers, and single hyphens only."); return; }
    if (body.format === "DOUBLE_ROUND_ROBIN_FINAL" && (!body.startDate || !body.kickoffTime)) { setError("Choose the tournament date and first kickoff time."); return; }
    if (creating) {
      setBusy(true); setError("");
      try {
        const row = await api.post<Tournament>("/admin/tournaments", body);
        setCreating(false); setSelectedId(row.id); setSection("teams"); await refresh(); setMessage("Tournament created. Add its teams next.");
      } catch (e: any) { setError(e.message); }
      finally { setBusy(false); }
    } else if (selectedId) await act(() => api.patch(`/admin/tournaments/${selectedId}`, body), "Tournament settings saved");
  };
  const saveTeam = async () => {
    if (!selectedId) return;
    const body = { ...teamForm, seed: teamForm.seed ? Number(teamForm.seed) : null, logoUrl: teamForm.logoUrl || null, groupName: teamForm.groupName || null };
    const ok = await act(() => editingTeamId ? api.patch(`/admin/tournaments/${selectedId}/teams/${editingTeamId}`, body) : api.post(`/admin/tournaments/${selectedId}/teams`, body), editingTeamId ? "Team updated" : "Team added");
    if (ok) { setTeamForm(emptyTeam); setEditingTeamId(null); }
  };
  const savePlayer = async () => {
    if (!selectedId || !playerTeamId) return;
    const body = { ...playerForm, jerseyNumber: playerForm.jerseyNumber === "" ? null : Number(playerForm.jerseyNumber), photoUrl: playerForm.photoUrl || null, dateOfBirth: playerForm.dateOfBirth || null };
    const ok = await act(() => editingPlayerId ? api.patch(`/admin/tournaments/${selectedId}/teams/${playerTeamId}/players/${editingPlayerId}`, body) : api.post(`/admin/tournaments/${selectedId}/teams/${playerTeamId}/players`, body), editingPlayerId ? "Player updated" : "Player added");
    if (ok) { setPlayerForm(emptyPlayer); setEditingPlayerId(null); }
  };
  const saveFixture = async () => {
    if (!selectedId) return;
    const body = { ...fixtureForm, kickoffAt: fixtureForm.kickoffAt ? tournamentDateTimeIso(fixtureForm.kickoffAt, tournament?.timezone || "Asia/Kolkata") : "", round: Number(fixtureForm.round), groupName: fixtureForm.groupName || null };
    const original = tournament?.fixtures.find(row => row.id === editingFixtureId);
    const teamsChanged = original && (original.homeTeamId !== body.homeTeamId || original.awayTeamId !== body.awayTeamId);
    const ok = await act(() => editingFixtureId ? api.patch(`/admin/tournaments/${selectedId}/fixtures/${editingFixtureId}`, body) : api.post(`/admin/tournaments/${selectedId}/fixtures`, body), editingFixtureId ? teamsChanged ? "Fixture updated. Set lineups for the new teams." : "Fixture updated" : "Fixture added");
    if (ok) { setFixtureForm(emptyFixture); setEditingFixtureId(null); if (teamsChanged) setLineupFixtureId(null); }
  };
  const openLineup = (row: TournamentFixture) => {
    setLineupFixtureId(row.id);
    setLineupDraft({
      homeStarterIds: row.lineups.filter(l => l.teamId === row.homeTeamId && l.isStarter).map(l => l.playerId),
      awayStarterIds: row.lineups.filter(l => l.teamId === row.awayTeamId && l.isStarter).map(l => l.playerId),
      homeSubstituteIds: row.lineups.filter(l => l.teamId === row.homeTeamId && !l.isStarter).map(l => l.playerId),
      awaySubstituteIds: row.lineups.filter(l => l.teamId === row.awayTeamId && !l.isStarter).map(l => l.playerId),
    });
  };
  const selectLineup = (side: "home" | "away", playerId: string, mode: "starter" | "substitute" | "off") => {
    setLineupDraft(current => {
      const next = { ...current };
      const starters = `${side}StarterIds` as "homeStarterIds" | "awayStarterIds";
      const subs = `${side}SubstituteIds` as "homeSubstituteIds" | "awaySubstituteIds";
      next[starters] = current[starters].filter(x => x !== playerId);
      next[subs] = current[subs].filter(x => x !== playerId);
      if (mode === "starter") next[starters] = [...next[starters], playerId];
      if (mode === "substitute") next[subs] = [...next[subs], playerId];
      return next;
    });
  };
  const openTeamEdit = (team: TournamentTeam) => {
    setEditingTeamId(team.id);
    setTeamForm({ name: team.name, shortName: team.shortName || "", logoUrl: team.logoUrl || "", city: team.city || "", coach: team.coach || "", contact: team.contact || "", description: team.description || "", groupName: team.groupName || "", seed: team.seed == null ? "" : String(team.seed) });
  };
  const openPlayerEdit = (player: TournamentPlayer) => {
    setPlayerTeamId(player.teamId); setEditingPlayerId(player.id);
    setPlayerForm({ firstName: player.firstName, lastName: player.lastName, jerseyNumber: player.jerseyNumber == null ? "" : String(player.jerseyNumber), position: player.position || "", photoUrl: player.photoUrl || "", nationality: player.nationality || "", dateOfBirth: dateOnly(player.dateOfBirth) });
  };
  const hasFixtures = !!tournament?.fixtures.length;
  const hasFinal = !!tournament?.fixtures.some(f => f.stage === "FINAL");
  const allFinished = hasFixtures && tournament!.fixtures.every(f => ["COMPLETED", "CANCELLED"].includes(f.status));

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="h-6 w-6" /> Tournaments</h2><p className="text-sm text-muted-foreground">Manage independent tournaments, rosters, fixtures and live matches.</p></div>
      <Button onClick={() => { setCreating(true); setSelectedId(null); setTournamentForm(emptyTournament); setSection("setup"); setError(""); }}><Plus className="mr-2 h-4 w-4" /> New tournament</Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{message}</p>}
    {isLoading && <p className="text-sm text-muted-foreground">Loading tournaments…</p>}
    {isError && <Button variant="outline" onClick={() => refetch()}>Retry loading tournaments</Button>}
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-2">
        {(list || []).map(row => <button key={row.id} onClick={() => { setCreating(false); setSelectedId(row.id); setSection("setup"); setError(""); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/50 ${selectedId === row.id ? "border-primary bg-primary/5" : ""}`}>
          {row.logoUrl ? <img src={row.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" /> : <Trophy className="h-9 w-9 rounded-lg bg-muted p-2" />}
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{row.name}</span><span className="text-xs text-muted-foreground">{row.status} · {row._count?.teams || 0} teams</span></span>
        </button>)}
        {!list?.length && !creating && !isLoading && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Create your first tournament.</p>}
      </aside>
      {(creating || tournament) && <div className="min-w-0 space-y-4">
        {!creating && tournament && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">{tournament.logoUrl && <img src={tournament.logoUrl} alt="" className="h-12 w-12 object-contain" />}<div><h3 className="text-lg font-bold">{tournament.name}</h3><p className="text-xs text-muted-foreground">{TOURNAMENT_FORMAT_LABEL[tournament.format]} · {tournament.lineupSize} a side</p></div></div>
          <div className="flex items-center gap-2"><Badge>{tournament.status}</Badge>{tournament.status !== "DRAFT" && <Button variant="outline" size="sm" asChild><Link to={`/tournaments/${tournament.slug}`} target="_blank">Public page <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>}</div>
        </div>}
        {!creating && <div className="flex gap-2 overflow-x-auto">{(["setup", "teams", "fixtures"] as const).map(tab => <Button key={tab} variant={section === tab ? "default" : "outline"} size="sm" onClick={() => setSection(tab)}>{tab === "setup" ? "Setup" : tab === "teams" ? "Teams & players" : "Fixtures & live"}</Button>)}</div>}
        {(creating || section === "setup") && <Card><CardHeader><CardTitle>{creating ? "Create tournament" : "Tournament setup"}</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Name</Label><Input value={tournamentForm.name} onChange={e => setTournamentForm({ ...tournamentForm, name: e.target.value, slug: creating ? e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : tournamentForm.slug })} /></div><div><Label>URL slug</Label><Input value={tournamentForm.slug} onChange={e => setTournamentForm({ ...tournamentForm, slug: e.target.value })} /></div></div>
          <div><Label>Description</Label><textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm" value={tournamentForm.description} onChange={e => setTournamentForm({ ...tournamentForm, description: e.target.value })} /></div>
          <ImageUpload label="Tournament logo" value={tournamentForm.logoUrl} onChange={logoUrl => setTournamentForm({ ...tournamentForm, logoUrl })} />
          <Input aria-label="Tournament logo URL" placeholder="Or paste a logo image URL" value={tournamentForm.logoUrl} onChange={e => setTournamentForm({ ...tournamentForm, logoUrl: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Format</Label><Select value={tournamentForm.format} onChange={e => { const format = e.target.value as TournamentFormat; const singleDayFinal = format === "DOUBLE_ROUND_ROBIN_FINAL"; setTournamentForm({ ...tournamentForm, format, matchesPerPair: singleDayFinal ? 2 : format === "ROUND_ROBIN" || format === "GROUPS_KNOCKOUT" ? tournamentForm.matchesPerPair : 1, timezone: singleDayFinal ? "Asia/Kolkata" : tournamentForm.timezone, endDate: singleDayFinal ? tournamentForm.startDate : tournamentForm.endDate, kickoffTime: singleDayFinal && tournamentForm.kickoffTime === "18:00" ? "08:00" : tournamentForm.kickoffTime, matchIntervalMinutes: singleDayFinal && tournamentForm.matchIntervalMinutes === 90 ? 45 : tournamentForm.matchIntervalMinutes }); }}>{Object.entries(TOURNAMENT_FORMAT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            <div><Label>Start date</Label><Input type="date" value={tournamentForm.startDate} onChange={e => setTournamentForm({ ...tournamentForm, startDate: e.target.value, endDate: tournamentForm.format === "DOUBLE_ROUND_ROBIN_FINAL" ? e.target.value : tournamentForm.endDate })} /></div>
            <div><Label>End date</Label><Input type="date" disabled={tournamentForm.format === "DOUBLE_ROUND_ROBIN_FINAL"} value={tournamentForm.endDate} onChange={e => setTournamentForm({ ...tournamentForm, endDate: e.target.value })} /></div>
            <div><Label>Players on field per team</Label><Input type="number" min={3} max={11} value={tournamentForm.lineupSize} onChange={e => setTournamentForm({ ...tournamentForm, lineupSize: Number(e.target.value) })} /></div>
            <div><Label>Minutes per half</Label><Input type="number" min={5} max={90} value={tournamentForm.halfLengthMinutes} onChange={e => setTournamentForm({ ...tournamentForm, halfLengthMinutes: Number(e.target.value) })} /></div>
            <div><Label>Halftime break (minutes)</Label><Input type="number" min={0} max={45} value={tournamentForm.halftimeBreakMinutes} onChange={e => setTournamentForm({ ...tournamentForm, halftimeBreakMinutes: Number(e.target.value) })} /></div>
            <div><Label>Timezone</Label><Select disabled={tournamentForm.format === "DOUBLE_ROUND_ROBIN_FINAL"} value={tournamentForm.timezone} onChange={e => setTournamentForm({ ...tournamentForm, timezone: e.target.value })}><option value="Asia/Kolkata">India Standard Time</option><option value="Asia/Riyadh">Riyadh time</option></Select></div>
            <div><Label>First kickoff ({tournamentForm.timezone === "Asia/Kolkata" ? "India time" : "Riyadh time"})</Label><Input type="time" value={tournamentForm.kickoffTime} onChange={e => setTournamentForm({ ...tournamentForm, kickoffTime: e.target.value })} /></div>
            <div><Label>Minutes between matches</Label><Input type="number" min={30} max={360} value={tournamentForm.matchIntervalMinutes} onChange={e => setTournamentForm({ ...tournamentForm, matchIntervalMinutes: Number(e.target.value) })} /></div>
            {tournamentForm.format !== "DOUBLE_ROUND_ROBIN_FINAL" && <div><Label>Matches per day</Label><Input type="number" min={1} max={24} value={tournamentForm.matchesPerDay} onChange={e => setTournamentForm({ ...tournamentForm, matchesPerDay: Number(e.target.value) })} /></div>}
            {(tournamentForm.format === "ROUND_ROBIN" || tournamentForm.format === "GROUPS_KNOCKOUT") && <div><Label>Meetings per pair</Label><Select value={tournamentForm.matchesPerPair} onChange={e => setTournamentForm({ ...tournamentForm, matchesPerPair: Number(e.target.value) })}><option value={1}>Once</option><option value={2}>Twice</option></Select></div>}
            {tournamentForm.format === "GROUPS_KNOCKOUT" && <><div><Label>Number of groups</Label><Input type="number" min={2} max={16} value={tournamentForm.groupCount} onChange={e => setTournamentForm({ ...tournamentForm, groupCount: Number(e.target.value) })} /></div><div><Label>Qualifiers per group</Label><Input type="number" min={1} max={4} value={tournamentForm.qualifiersPerGroup} onChange={e => setTournamentForm({ ...tournamentForm, qualifiersPerGroup: Number(e.target.value) })} /></div></>}
          </div>
          {tournamentForm.format === "DOUBLE_ROUND_ROBIN_FINAL" && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">Every team plays every other team twice. After those matches finish, generate a final between the top two teams. All fixtures use India time and remain on the selected date.</p>}
          <p className="text-xs text-muted-foreground">Full time is after {tournamentForm.halfLengthMinutes * 2} minutes of play. The match clock pauses during halftime.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={busy || tournament?.status === "COMPLETED"} onClick={saveTournament}>{creating ? "Create tournament" : "Save settings"}</Button>
            {!creating && tournament?.status === "DRAFT" && <Button disabled={busy} variant="outline" onClick={() => act(() => api.patch(`/admin/tournaments/${selectedId}/status`, { status: "PUBLISHED" }), "Tournament published")}>Publish tournament</Button>}
            {!creating && tournament?.status === "LIVE" && <Button disabled={busy || !allFinished} variant="outline" onClick={() => act(() => api.patch(`/admin/tournaments/${selectedId}/status`, { status: "COMPLETED" }), "Tournament completed")}>Complete tournament</Button>}
            {!creating && tournament?.status === "DRAFT" && !hasFixtures && <Button disabled={busy} variant="destructive" onClick={async () => { if (window.confirm("Delete this empty draft tournament?") && await act(() => api.delete(`/admin/tournaments/${selectedId}`), "Tournament deleted")) { setSelectedId(null); setCreating(false); } }}>Delete draft</Button>}
          </div>
        </CardContent></Card>}
        {!creating && section === "teams" && tournament && <div className="space-y-4">
          <Card><CardHeader><CardTitle>{editingTeamId ? "Edit team" : "Add team"}</CardTitle></CardHeader><CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3"><div><Label>Name</Label><Input value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} /></div><div><Label>Short name</Label><Input value={teamForm.shortName} onChange={e => setTeamForm({ ...teamForm, shortName: e.target.value })} /></div><div><Label>Seed</Label><Input type="number" min={1} value={teamForm.seed} onChange={e => setTeamForm({ ...teamForm, seed: e.target.value })} /></div><div><Label>City</Label><Input value={teamForm.city} onChange={e => setTeamForm({ ...teamForm, city: e.target.value })} /></div><div><Label>Coach</Label><Input value={teamForm.coach} onChange={e => setTeamForm({ ...teamForm, coach: e.target.value })} /></div><div><Label>Contact</Label><Input value={teamForm.contact} onChange={e => setTeamForm({ ...teamForm, contact: e.target.value })} /></div>{tournament.format === "GROUPS_KNOCKOUT" && <div><Label>Group</Label><Select value={teamForm.groupName} onChange={e => setTeamForm({ ...teamForm, groupName: e.target.value })}><option value="">Auto assign</option>{Array.from({ length: tournament.groupCount || 2 }, (_, index) => String.fromCharCode(65 + index)).map(group => <option key={group} value={group}>{group}</option>)}</Select></div>}</div>
            <div><Label>Description</Label><textarea className="mt-1 min-h-16 w-full rounded-md border bg-background p-2 text-sm" value={teamForm.description} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
            <ImageUpload label="Team logo" value={teamForm.logoUrl} onChange={logoUrl => setTeamForm({ ...teamForm, logoUrl })} />
            <Input aria-label="Team logo URL" placeholder="Or paste a logo image URL" value={teamForm.logoUrl} onChange={e => setTeamForm({ ...teamForm, logoUrl: e.target.value })} />
            <div className="flex gap-2"><Button disabled={busy || tournament.status === "COMPLETED"} onClick={saveTeam}>{editingTeamId ? "Save team" : "Add team"}</Button>{editingTeamId && <Button variant="outline" onClick={() => { setEditingTeamId(null); setTeamForm(emptyTeam); }}>Cancel</Button>}</div>
          </CardContent></Card>
          <div className="grid gap-3 md:grid-cols-2">{tournament.teams.map(team => <Card key={team.id}><CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">{team.logoUrl ? <img src={team.logoUrl} alt="" className="h-12 w-12 rounded object-contain" /> : <Users className="h-12 w-12 rounded bg-muted p-3" />}<div className="min-w-0 flex-1"><h4 className="font-semibold">{team.name}</h4><p className="text-xs text-muted-foreground">{team.city || "No city"} · {team.players.length} players{team.groupName ? ` · Group ${team.groupName}` : ""}</p></div><Button size="sm" variant="ghost" onClick={() => openTeamEdit(team)} aria-label={`Edit ${team.name}`}><Pencil className="h-4 w-4" /></Button></div>
            {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
            <div className="flex flex-wrap gap-1">{team.players.map(player => <button key={player.id} onClick={() => openPlayerEdit(player)} className="rounded-full border px-2 py-1 text-xs hover:bg-muted">{player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ""}{player.firstName} {player.lastName}{!player.isActive ? " (inactive)" : ""}</button>)}</div>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setPlayerTeamId(team.id); setEditingPlayerId(null); setPlayerForm(emptyPlayer); }}>Add player</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Delete ${team.name}? Its players will also be deleted.`)) act(() => api.delete(`/admin/tournaments/${selectedId}/teams/${team.id}`), "Team deleted"); }}><Trash2 className="h-4 w-4" /></Button></div>
          </CardContent></Card>)}</div>
          {playerTeamId && <Card><CardHeader><CardTitle>{editingPlayerId ? "Edit player" : "Add player"} · {tournament.teams.find(t => t.id === playerTeamId)?.name}</CardTitle></CardHeader><CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3"><div><Label>First name</Label><Input value={playerForm.firstName} onChange={e => setPlayerForm({ ...playerForm, firstName: e.target.value })} /></div><div><Label>Last name</Label><Input value={playerForm.lastName} onChange={e => setPlayerForm({ ...playerForm, lastName: e.target.value })} /></div><div><Label>Number</Label><Input type="number" min={0} max={99} value={playerForm.jerseyNumber} onChange={e => setPlayerForm({ ...playerForm, jerseyNumber: e.target.value })} /></div><div><Label>Position</Label><Input value={playerForm.position} onChange={e => setPlayerForm({ ...playerForm, position: e.target.value })} /></div><div><Label>Nationality</Label><Input value={playerForm.nationality} onChange={e => setPlayerForm({ ...playerForm, nationality: e.target.value })} /></div><div><Label>Date of birth</Label><Input type="date" value={playerForm.dateOfBirth} onChange={e => setPlayerForm({ ...playerForm, dateOfBirth: e.target.value })} /></div></div>
            <ImageUpload label="Player photo" value={playerForm.photoUrl} onChange={photoUrl => setPlayerForm({ ...playerForm, photoUrl })} />
            <Input aria-label="Player photo URL" placeholder="Or paste a photo URL" value={playerForm.photoUrl} onChange={e => setPlayerForm({ ...playerForm, photoUrl: e.target.value })} />
            <div className="flex gap-2"><Button disabled={busy || tournament.status === "COMPLETED"} onClick={savePlayer}>{editingPlayerId ? "Save player" : "Add player"}</Button><Button variant="outline" onClick={() => { setPlayerTeamId(null); setEditingPlayerId(null); }}>Close</Button>{editingPlayerId && <Button variant="destructive" disabled={busy || tournament.status === "COMPLETED"} onClick={() => { if (window.confirm("Delete this player?")) act(() => api.delete(`/admin/tournaments/${selectedId}/teams/${playerTeamId}/players/${editingPlayerId}`), "Player deleted").then(ok => { if (ok) { setPlayerTeamId(null); setEditingPlayerId(null); } }); }}>Delete player</Button>}</div>
          </CardContent></Card>}
        </div>}
        {!creating && section === "fixtures" && tournament && <div className="space-y-4">
          <Card><CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Button disabled={busy || hasFixtures || tournament.teams.length < 2} onClick={() => act(() => api.post(`/admin/tournaments/${selectedId}/fixtures/generate`, {}), "Fixtures generated")}>Generate fixtures</Button>
            {["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "GROUPS_KNOCKOUT", "DOUBLE_ROUND_ROBIN_FINAL"].includes(tournament.format) && !(tournament.format === "DOUBLE_ROUND_ROBIN_FINAL" && hasFinal) && <Button disabled={busy || !allFinished} variant="outline" onClick={() => act(() => api.post(`/admin/tournaments/${selectedId}/fixtures/next-round`, {}), tournament.format === "DOUBLE_ROUND_ROBIN_FINAL" ? "Final generated" : "Next round generated")}>{tournament.format === "DOUBLE_ROUND_ROBIN_FINAL" ? "Generate final" : "Generate next round"}</Button>}
            <p className="text-xs text-muted-foreground">Generate the opening schedule, then edit kickoff times or add fixtures manually. Advance knockout rounds after all current matches finish.</p>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>{editingFixtureId ? "Edit fixture" : "Add fixture"}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">
            <div><Label>Home team</Label><Select value={fixtureForm.homeTeamId} onChange={e => setFixtureForm({ ...fixtureForm, homeTeamId: e.target.value })}><option value="">Select</option>{tournament.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
            <div><Label>Away team</Label><Select value={fixtureForm.awayTeamId} onChange={e => setFixtureForm({ ...fixtureForm, awayTeamId: e.target.value })}><option value="">Select</option>{tournament.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
            <div><Label>Kickoff ({tournament.timezone})</Label><Input type="datetime-local" value={fixtureForm.kickoffAt} onChange={e => setFixtureForm({ ...fixtureForm, kickoffAt: e.target.value })} /></div>
            <div><Label>Stage</Label><Select value={fixtureForm.stage} onChange={e => setFixtureForm({ ...fixtureForm, stage: e.target.value })}>{fixtureStages[tournament.format].map(v => <option key={v} value={v}>{v.replace("_", " ")}</option>)}</Select></div>
            <div><Label>Round</Label><Input type="number" min={1} value={fixtureForm.round} onChange={e => setFixtureForm({ ...fixtureForm, round: Number(e.target.value) })} /></div>
            {fixtureForm.stage === "GROUP" && <div><Label>Group</Label><Select value={fixtureForm.groupName} onChange={e => setFixtureForm({ ...fixtureForm, groupName: e.target.value })}><option value="">Select group</option>{Array.from({ length: tournament.groupCount || 2 }, (_, index) => String.fromCharCode(65 + index)).map(group => <option key={group} value={group}>{group}</option>)}</Select></div>}
            <div className="flex items-end gap-2 sm:col-span-3"><Button disabled={busy || tournament.status === "COMPLETED"} onClick={saveFixture}>{editingFixtureId ? "Save fixture" : "Add fixture"}</Button>{editingFixtureId && <Button variant="outline" onClick={() => { setEditingFixtureId(null); setFixtureForm(emptyFixture); }}>Cancel</Button>}</div>
          </CardContent></Card>
          <div className="space-y-2">{tournament.fixtures.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{row.homeTeam.name} <span className="text-muted-foreground">vs</span> {row.awayTeam.name} <span className="ml-2 font-bold">{row.status === "SCHEDULED" ? "" : `${row.homeScore}–${row.awayScore}`}</span></p><p className="text-xs text-muted-foreground">{shortDate(row.kickoffAt, tournament.timezone)} · {row.stage} round {row.round}{row.groupName ? ` · Group ${row.groupName}` : ""}</p></div><Badge variant="secondary">{row.status}</Badge>
            <Button size="sm" variant="outline" onClick={() => openLineup(row)}>Lineups</Button>
            <Button size="sm" onClick={() => setLiveFixtureId(row.id)}><Play className="mr-1 h-3 w-3" /> Live control</Button>
            {row.status === "SCHEDULED" && <><Button size="sm" variant="ghost" onClick={() => { setEditingFixtureId(row.id); setFixtureForm({ homeTeamId: row.homeTeamId, awayTeamId: row.awayTeamId, kickoffAt: tournamentDateTimeInput(row.kickoffAt, tournament.timezone), stage: row.stage, round: row.round, groupName: row.groupName || "" }); }} aria-label="Edit fixture"><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Delete this fixture?")) act(() => api.delete(`/admin/tournaments/${selectedId}/fixtures/${row.id}`), "Fixture deleted"); }} aria-label="Delete fixture"><Trash2 className="h-4 w-4" /></Button></>}
          </div>)}</div>
          {fixture && <Card><CardHeader><CardTitle>Match lineups · {fixture.homeTeam.name} vs {fixture.awayTeam.name}</CardTitle></CardHeader><CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose exactly {tournament.lineupSize} starters for each team. Other listed players are substitutes.</p>
            <div className="grid gap-4 md:grid-cols-2">{(["home", "away"] as const).map(side => {
              const team = side === "home" ? fixture.homeTeam : fixture.awayTeam;
              const starters = side === "home" ? lineupDraft.homeStarterIds : lineupDraft.awayStarterIds;
              const subs = side === "home" ? lineupDraft.homeSubstituteIds : lineupDraft.awaySubstituteIds;
              return <div key={side} className="space-y-2 rounded-lg border p-3"><h4 className="font-semibold">{team.name} · {starters.length}/{tournament.lineupSize} starters</h4>{team.players.filter(p => p.isActive).map(p => <div key={p.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}{p.firstName} {p.lastName}</span><Select className="w-28" value={starters.includes(p.id) ? "starter" : subs.includes(p.id) ? "substitute" : "off"} onChange={e => selectLineup(side, p.id, e.target.value as "starter" | "substitute" | "off")}><option value="off">Not listed</option><option value="starter">Starter</option><option value="substitute">Sub</option></Select></div>)}</div>;
            })}</div>
            <div className="flex gap-2"><Button disabled={busy || fixture.status !== "SCHEDULED"} onClick={() => act(() => api.put(`/admin/tournaments/${selectedId}/fixtures/${fixture.id}/lineups`, lineupDraft), "Lineups saved")}>Save lineups</Button><Button variant="outline" onClick={() => setLineupFixtureId(null)}>Close</Button></div>
          </CardContent></Card>}
        </div>}
      </div>}
    </div>
    {liveFixtureId && liveApi && <MatchControlCenter fixtureId={liveFixtureId} apiClient={liveApi} onClose={() => { setLiveFixtureId(null); void refetchTournament(); void refresh(); }} />}
  </div>;
}
