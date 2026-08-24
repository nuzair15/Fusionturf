import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Fixture, PlayerStat, Season, Standing, Team } from "@/types";
import { Calendar, Flame, Target } from "lucide-react";
import { LeagueCard, LeagueEmptyState, SectionLink } from "@/components/league/LeagueUI";
import { LeagueStandingsTable } from "@/components/league/LeagueStandingsTable";
import { PlayerLeaderboard } from "@/components/league/PlayerLeaderboard";
import { ACTIVE_MATCH_STATUSES, fixtureDateKey, fixtureScoreLabel } from "@/lib/fixtures";

function FixtureRow({ fixture, onOpen }: { fixture: Fixture; onOpen: () => void }) {
  return <button onClick={onOpen} className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 border-b px-2.5 py-2.5 text-left last:border-0 transition hover:bg-secondary/50 sm:gap-2 sm:px-4 sm:py-3"><div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover sm:h-7 sm:w-7" /><span className="truncate text-[11px] font-semibold sm:text-sm">{fixture.homeTeam.shortName || fixture.homeTeam.name}</span></div><div className="min-w-[62px] text-center sm:min-w-[72px]"><p className="text-sm font-black tabular-nums sm:text-base">{fixtureScoreLabel(fixture)}</p><p className="mt-0.5 text-[8px] text-muted-foreground sm:text-[10px]">{formatDate(fixtureDateKey(fixture))}</p></div><div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2"><span className="truncate text-right text-[11px] font-semibold sm:text-sm">{fixture.awayTeam.shortName || fixture.awayTeam.name}</span><img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover sm:h-7 sm:w-7" /></div></button>;
}

export function LeaguePage() {
  const navigate = useNavigate();
  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false });
  const { data: fixtures } = useQuery({ queryKey: ["fixtures", "league", "upcoming", 12], queryFn: () => api.get<{ data: Fixture[] }>("/v2/fixtures", { limit: "12", scope: "upcoming" }), refetchInterval: 15000 });
  const { data: recentData } = useQuery({ queryKey: ["fixtures", "league", "recent", 6], queryFn: () => api.get<{ data: Fixture[] }>("/v2/fixtures", { limit: "6", scope: "recent" }), refetchInterval: 15000 });
  const { data: standings } = useQuery({ queryKey: ["standings"], queryFn: () => api.get<Standing[]>("/league/standings"), staleTime: 60000 });
  const { data: teams } = useQuery({ queryKey: ["teams"], queryFn: () => api.get<Team[]>("/league/teams"), staleTime: 60000 });
  const { data: scorers } = useQuery({ queryKey: ["player-stats", "goals", false], queryFn: () => api.get<PlayerStat[]>("/league/stats/players", { stat: "goals", friendly: "false" }), refetchInterval: 30000 });
  const { data: assisters } = useQuery({ queryKey: ["player-stats", "assists", false], queryFn: () => api.get<PlayerStat[]>("/league/stats/players", { stat: "assists", friendly: "false" }), refetchInterval: 30000 });

  const upcoming = fixtures?.data || [];
  const recent = recentData?.data || [];
  const live = useMemo(() => upcoming.filter((fixture) => ACTIVE_MATCH_STATUSES.includes(fixture.status)), [upcoming]);
  const matchday = [...live, ...upcoming.filter((fixture) => fixture.status === "SCHEDULED"), ...recent].slice(0, 5);
  const table = standings || [];

  return <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-8">
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-4 py-5 text-white shadow-xl sm:px-7 sm:py-6"><div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/30 blur-3xl" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200 sm:text-xs"><Flame className="h-3.5 w-3.5" /> Fusion League</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:mt-2 sm:text-4xl">{currentSeason?.name || "League overview"}</h1><p className="mt-1 text-xs text-slate-300 sm:text-sm">Table, matchday, and player leaders in one place.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button size="sm" onClick={() => navigate("/league/fixtures")} className="gap-1.5"><Calendar className="h-4 w-4" /> Fixtures</Button><Button size="sm" variant="secondary" onClick={() => navigate("/league/stats")} className="gap-1.5"><Target className="h-4 w-4" /> Leaders</Button></div></div></section>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]"><LeagueCard title="League table" action={<SectionLink onClick={() => navigate("/league/standings")}>Full table</SectionLink>}><div className="p-3 sm:p-4">{table.length ? <LeagueStandingsTable standings={table} onTeamClick={(row) => navigate(`/league/teams/${row.team.slug}`)} /> : <LeagueEmptyState title="No table yet" description="Completed results will build the table." />}</div></LeagueCard><LeagueCard title="Matchday" action={<SectionLink onClick={() => navigate("/league/fixtures")}>All fixtures</SectionLink>}><div>{matchday.length ? matchday.map((fixture) => <FixtureRow key={fixture.id} fixture={fixture} onOpen={() => navigate(`/league/fixtures/${fixture.id}`)} />) : <LeagueEmptyState title="No fixtures yet" description="Upcoming and completed matches will appear here." />}</div></LeagueCard></div>

    <div className="grid gap-5 lg:grid-cols-2"><LeagueCard title="Top scorers" action={<SectionLink onClick={() => navigate("/league/stats")}>All leaders</SectionLink>}><div className="p-3 sm:p-4"><PlayerLeaderboard rows={scorers || []} stat="goals" compact /></div></LeagueCard><LeagueCard title="Top assisters" action={<SectionLink onClick={() => navigate("/league/stats")}>All leaders</SectionLink>}><div className="p-3 sm:p-4"><PlayerLeaderboard rows={assisters || []} stat="assists" compact /></div></LeagueCard></div>

    <LeagueCard title="Clubs" action={<SectionLink onClick={() => navigate("/league/standings")}>League table</SectionLink>}><div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4 lg:grid-cols-6">{(teams || []).slice(0, 12).map((team) => <button key={team.id} onClick={() => navigate(`/league/teams/${team.slug}`)} className="rounded-xl border p-2 text-center transition hover:bg-secondary/50"><img src={team.logoUrl || "/placeholder.svg"} alt="" className="mx-auto h-9 w-9 rounded-full bg-muted object-cover sm:h-11 sm:w-11" /><p className="mt-1 truncate text-[10px] font-semibold sm:text-xs">{team.shortName || team.name}</p></button>)}</div></LeagueCard>
  </div>;
}
