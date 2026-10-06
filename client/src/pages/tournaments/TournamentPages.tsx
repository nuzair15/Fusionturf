import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, Trophy, Users, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageError, PageSkeleton } from "@/components/PageState";
import type { Tournament, TournamentFixture } from "@/types/tournament";
import { TOURNAMENT_FORMAT_LABEL } from "@/types/tournament";

const dateLabel = (value: string, timezone: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
const score = (fixture: TournamentFixture) => ["SCHEDULED", "POSTPONED", "CANCELLED"].includes(fixture.status) ? "vs" : `${fixture.homeScore} – ${fixture.awayScore}`;

function TournamentTile({ row }: { row: Tournament }) {
  return <Link to={`/tournaments/${row.slug}`} className="group block rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
    <div className="flex items-start gap-4">{row.logoUrl ? <img src={row.logoUrl} alt="" className="h-16 w-16 rounded-xl border bg-muted object-contain p-1" /> : <Trophy className="h-16 w-16 rounded-xl bg-amber-500/10 p-4 text-amber-500" />}<div className="min-w-0 flex-1"><h2 className="text-lg font-bold group-hover:text-primary">{row.name}</h2><p className="text-xs text-muted-foreground">{TOURNAMENT_FORMAT_LABEL[row.format]}</p><div className="mt-2 flex flex-wrap gap-2"><Badge>{row.status}</Badge><Badge variant="secondary">{row.lineupSize} a side</Badge></div></div></div>
    {row.description && <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{row.description}</p>}
    <div className="mt-4 flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {row._count?.teams ?? row.teams?.length ?? 0} teams</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {row._count?.fixtures ?? row.fixtures?.length ?? 0} matches</span>{row.startDate && <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: row.timezone }).format(new Date(row.startDate))}</span>}</div>
  </Link>;
}

export function TournamentListPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["tournaments"], queryFn: () => api.get<Tournament[]>("/tournaments") });
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="mb-7"><p className="text-sm font-semibold uppercase tracking-widest text-primary">Football competitions</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Tournaments</h1><p className="mt-2 text-muted-foreground">Follow each tournament, its teams and live matches separately from Fusion League.</p></div>
    {isLoading ? <PageSkeleton /> : isError ? <PageError title="Tournaments unavailable" description="Please try again." onRetry={() => void refetch()} /> : data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map(row => <TournamentTile key={row.id} row={row} />)}</div> : <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No public tournaments yet.</div>}
  </div>;
}

function FixtureRow({ fixture, tournament }: { fixture: TournamentFixture; tournament: Tournament }) {
  return <Link to={`/tournaments/${tournament.slug}/fixtures/${fixture.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/30">
    <div className="w-full text-xs text-muted-foreground sm:w-40">{dateLabel(fixture.kickoffAt, tournament.timezone)}<br />{fixture.stage.replace("_", " ")} · Round {fixture.round}{fixture.groupName ? ` · Group ${fixture.groupName}` : ""}</div>
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3 text-center"><div className="flex min-w-0 flex-1 items-center justify-end gap-2">{fixture.homeTeam.logoUrl && <img src={fixture.homeTeam.logoUrl} alt="" className="h-7 w-7 object-contain" />}<span className="truncate text-sm font-semibold">{fixture.homeTeam.shortName || fixture.homeTeam.name}</span></div><span className="shrink-0 text-base font-black">{score(fixture)}</span><div className="flex min-w-0 flex-1 items-center gap-2"><span className="truncate text-sm font-semibold">{fixture.awayTeam.shortName || fixture.awayTeam.name}</span>{fixture.awayTeam.logoUrl && <img src={fixture.awayTeam.logoUrl} alt="" className="h-7 w-7 object-contain" />}</div></div>
    <Badge variant={fixture.status === "LIVE" ? "default" : "secondary"}>{fixture.status.replace("_", " ")}</Badge>
  </Link>;
}

export function TournamentDetailPage() {
  const { slug } = useParams();
  const [tab, setTab] = useState<"fixtures" | "teams" | "standings">("fixtures");
  const { data: tournament, isLoading, isError, refetch } = useQuery({ queryKey: ["tournament", slug], queryFn: () => api.get<Tournament>(`/tournaments/${slug}`), enabled: !!slug, refetchInterval: 10000 });
  if (isLoading) return <PageSkeleton />;
  if (isError || !tournament) return <PageError title="Tournament unavailable" description="This tournament may not be published yet." onRetry={() => void refetch()} />;
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <Link to="/tournaments" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All tournaments</Link>
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-6 text-white sm:p-9">
      <div className="flex flex-wrap items-start gap-5">{tournament.logoUrl ? <img src={tournament.logoUrl} alt="" className="h-20 w-20 rounded-xl bg-white/10 object-contain p-2" /> : <Trophy className="h-20 w-20 rounded-xl bg-white/10 p-5" />}<div><div className="flex flex-wrap gap-2"><Badge className="bg-white/15 text-white">{tournament.status}</Badge><Badge className="bg-white/15 text-white">{TOURNAMENT_FORMAT_LABEL[tournament.format]}</Badge></div><h1 className="mt-3 text-3xl font-black sm:text-4xl">{tournament.name}</h1><p className="mt-2 max-w-3xl text-sm text-white/75">{tournament.description}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/75"><span><Users className="mr-1 inline h-3.5 w-3.5" />{tournament.teams.length} teams</span><span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{tournament.fixtures.length} fixtures</span><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{tournament.lineupSize} a side · {tournament.halfLengthMinutes} min halves</span></div>
    </div>
    <div className="my-6 flex gap-2">{(["fixtures", "teams", ...(Object.keys(tournament.standings).length ? ["standings" as const] : [])] as const).map(value => <Button key={value} variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)} className="capitalize">{value}</Button>)}</div>
    {tab === "fixtures" && <div className="space-y-3">{tournament.fixtures.length ? tournament.fixtures.map(row => <FixtureRow key={row.id} fixture={row} tournament={tournament} />) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Fixtures have not been scheduled.</p>}</div>}
    {tab === "teams" && <div className="grid gap-4 md:grid-cols-2">{tournament.teams.map(team => <Card key={team.id}><CardHeader><CardTitle className="flex items-center gap-3">{team.logoUrl ? <img src={team.logoUrl} alt="" className="h-11 w-11 object-contain" /> : <Users className="h-10 w-10 rounded bg-muted p-2" />}{team.name}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{team.city}{team.coach ? ` · Coach ${team.coach}` : ""}{team.groupName ? ` · Group ${team.groupName}` : ""}</p>{team.description && <p className="mt-2 text-sm">{team.description}</p>}<h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Players</h3><div className="mt-2 grid gap-1 sm:grid-cols-2">{team.players.filter(p => p.isActive).map(player => <div key={player.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">{player.jerseyNumber ?? "–"}</span>}<span>{player.firstName} {player.lastName}<span className="block text-[11px] text-muted-foreground">{player.position}</span></span></div>)}</div></CardContent></Card>)}</div>}
    {tab === "standings" && <div className="space-y-5">{Object.entries(tournament.standings).map(([group, rows]) => <Card key={group}><CardHeader><CardTitle>{group === "LEAGUE" ? "League table" : `Group ${group}`}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.teamId} className="border-b last:border-0"><td className="py-2">{index + 1}</td><td className="font-medium">{tournament.teams.find(t => t.id === row.teamId)?.name || "Team"}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td>{row.goalDifference}</td><td className="font-bold">{row.points}</td></tr>)}</tbody></table></CardContent></Card>)}</div>}
  </div>;
}

export function TournamentFixturePage() {
  const { slug, fixtureId } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tournament-fixture", slug, fixtureId],
    queryFn: () => api.get<{ tournament: Tournament; fixture: TournamentFixture }>(`/tournaments/${slug}/fixtures/${fixtureId}`),
    enabled: !!slug && !!fixtureId, refetchInterval: 5000,
  });
  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <PageError title="Fixture unavailable" description="Please try again." onRetry={() => void refetch()} />;
  const { fixture, tournament } = data;
  const events = [...fixture.events].filter(e => e.kind !== "CORRECTION" && e.kind !== "APPEARANCE").sort((a, b) => b.minute - a.minute);
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <Link to={`/tournaments/${tournament.slug}`} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {tournament.name}</Link>
    <div className="rounded-2xl bg-gradient-to-br from-emerald-950 to-teal-900 p-6 text-white sm:p-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70"><span>{tournament.name} · {fixture.stage.replace("_", " ")} round {fixture.round}</span><Badge className="bg-white/15 text-white">{fixture.status.replace("_", " ")}</Badge></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><div>{fixture.homeTeam.logoUrl && <img src={fixture.homeTeam.logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />}<h1 className="text-base font-bold sm:text-xl">{fixture.homeTeam.name}</h1></div><div className="text-2xl font-black sm:text-4xl">{score(fixture)}</div><div>{fixture.awayTeam.logoUrl && <img src={fixture.awayTeam.logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />}<h1 className="text-base font-bold sm:text-xl">{fixture.awayTeam.name}</h1></div></div>
      <p className="mt-5 text-center text-xs text-white/70">{dateLabel(fixture.kickoffAt, tournament.timezone)}{fixture.penaltiesHomeScore != null ? ` · Penalties ${fixture.penaltiesHomeScore}–${fixture.penaltiesAwayScore}` : ""}</p>
      {fixture.status === "LIVE" && <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-rose-300">Live · {Math.floor(fixture.matchClockSeconds / 60)}'</p>}
    </div>
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Match timeline</CardTitle></CardHeader><CardContent className="space-y-2">{events.length ? events.map(e => <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm"><strong className="w-9 shrink-0">{e.minute}'</strong><div><p className="font-semibold">{e.kind.replace(/_/g, " ")}</p><p className="text-muted-foreground">{e.playerName || (e.teamId === fixture.homeTeamId ? fixture.homeTeam.name : e.teamId === fixture.awayTeamId ? fixture.awayTeam.name : "")}{e.relatedPlayerName ? ` → ${e.relatedPlayerName}` : ""}{e.note ? ` · ${e.note}` : ""}</p></div></div>) : <p className="text-sm text-muted-foreground">No events recorded yet.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Lineups</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[fixture.homeTeam, fixture.awayTeam].map(team => <div key={team.id}><h3 className="mb-2 font-semibold">{team.name}</h3>{fixture.lineups.filter(l => l.teamId === team.id).sort((a, b) => Number(b.isStarter) - Number(a.isStarter)).map(l => { const p = team.players.find(p => p.id === l.playerId); return <p key={l.id} className="border-b py-1 text-sm">{p?.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""}{p ? `${p.firstName} ${p.lastName}` : "Player"}{!l.isStarter && <span className="ml-1 text-xs text-muted-foreground">(sub)</span>}</p>; })}{!fixture.lineups.some(l => l.teamId === team.id) && <p className="text-xs text-muted-foreground">Not announced</p>}</div>)}</CardContent></Card>
    </div>
  </div>;
}
