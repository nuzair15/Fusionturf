import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Season, Standing } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { LeagueHero, LeagueCard, LeagueEmptyState } from "@/components/league/LeagueUI";
import { LeagueStandingsTable } from "@/components/league/LeagueStandingsTable";
import { PageError, PageSkeleton } from "@/components/PageState";

export function StandingsPage() {
  const navigate = useNavigate();
  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false, refetchInterval: 15000 });
  const { data: standings, isLoading, isError, refetch } = useQuery({ queryKey: ["standings-full"], queryFn: () => api.get<Standing[]>("/league/standings"), staleTime: 60000 });
  const list = standings || [];
  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError title="Standings could not be loaded" description="The table is updated from real match results. Please try again." onRetry={() => void refetch()} action={<Button variant="outline" onClick={() => navigate("/league")}>Back to league</Button>} />;
  return <div className="space-y-8 pb-8">
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6"><Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1"><ChevronLeft className="h-4 w-4" /> Back to League</Button><LeagueHero eyebrow="Table view" title="League Standings" subtitle={currentSeason?.name || "Current season"} stats={[{ label: "Teams", value: list.length }, { label: "Leader", value: list[0]?.team?.name || "TBD" }, { label: "Points", value: list[0]?.points || 0 }, { label: "Form", value: list[0]?.form || "-----" }]} /></div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <LeagueCard title="Finalists" action={<Badge variant="secondary" className="rounded-full">Top two</Badge>}>
        {list.length ? <div className="grid gap-3 p-4 sm:grid-cols-2">{list.slice(0, 2).map((row) => <button key={row.id} onClick={() => navigate(`/league/teams/${row.team.slug}`)} className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-left transition hover:bg-sky-500/10"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 font-bold text-sky-600">{row.position}</span><img src={row.team.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" /><span className="min-w-0 flex-1 truncate font-semibold">{row.team.name}</span><span className="font-bold">{row.points} pts</span></button>)}</div> : <div className="p-4"><LeagueEmptyState title="No standings yet" description="Standings will populate once match results are available." /></div>}
      </LeagueCard>
    </div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6"><LeagueCard title="League table" action={<Badge variant="secondary" className="rounded-full">MP · W · D · L · GF · GA · GD · Pts</Badge>}>{list.length ? <LeagueStandingsTable standings={list} onTeamClick={(row) => navigate(`/league/teams/${row.team.slug}`)} /> : <div className="p-4"><LeagueEmptyState title="No teams in the table yet" description="Add teams to the active season, then publish fixtures and results to build the table." /></div>}</LeagueCard></div>
  </div>;
}
