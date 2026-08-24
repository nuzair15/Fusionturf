import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Fixture, Team } from "@/types";
import { CalendarDays, ChevronLeft, MapPin, Trophy, Users } from "lucide-react";
import { LeagueCard, LeagueEmptyState } from "@/components/league/LeagueUI";
import { FollowButton } from "@/components/league/FollowButton";
import { PageError, PageSkeleton } from "@/components/PageState";
import { fixtureDateKey, fixtureScoreLabel, sortedFixtures } from "@/lib/fixtures";
import { formatDate } from "@/lib/utils";

function MatchRow({ fixture, onOpen }: { fixture: Fixture; onOpen: () => void }) {
  return <button onClick={onOpen} className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-3 py-3 text-left last:border-0 transition hover:bg-secondary/50 sm:px-4"><div className="flex min-w-0 items-center gap-2"><img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-7 w-7 shrink-0 rounded-full bg-muted object-cover" /><span className="truncate text-xs font-semibold sm:text-sm">{fixture.homeTeam.shortName || fixture.homeTeam.name}</span></div><div className="text-center"><p className="text-base font-black tabular-nums">{fixtureScoreLabel(fixture)}</p><p className="text-[9px] text-muted-foreground sm:text-[10px]">{formatDate(fixtureDateKey(fixture))}</p></div><div className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-right text-xs font-semibold sm:text-sm">{fixture.awayTeam.shortName || fixture.awayTeam.name}</span><img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-7 w-7 shrink-0 rounded-full bg-muted object-cover" /></div></button>;
}

export function TeamDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: team, isLoading, isError, refetch } = useQuery({ queryKey: ["team", slug], queryFn: () => api.get<Team>(`/league/teams/${slug}`), enabled: !!slug, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000 });
  const allMatches = useMemo(() => {
    if (!team) return [];
    // The team endpoint only includes the opponent relation on each fixture.
    // Fill in this team locally so home and away rows have the same shape.
    const club = { id: team.id, name: team.name, shortName: team.shortName, slug: team.slug, logoUrl: team.logoUrl, city: team.city };
    return sortedFixtures([
      ...(team.homeMatches || []).map((fixture) => ({ ...fixture, homeTeam: fixture.homeTeam || club })),
      ...(team.awayMatches || []).map((fixture) => ({ ...fixture, awayTeam: fixture.awayTeam || club })),
    ] as Fixture[]);
  }, [team]);
  if (isLoading) return <PageSkeleton />;
  if (isError || !team) return <PageError title="Team profile not found" description="This club may have been removed or its profile is temporarily unavailable." onRetry={() => void refetch()} action={<Button variant="outline" onClick={() => navigate("/league")}>Back to league</Button>} />;
  const standing = team.standings?.[0];
  const completed = allMatches.filter((match) => match.status === "COMPLETED").slice(0, 5);
  const upcoming = allMatches.filter((match) => match.status !== "COMPLETED").slice(0, 5);

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"><motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
    <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-2 gap-1"><ChevronLeft className="h-4 w-4" /> Back</Button>
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-5 text-white shadow-xl sm:p-7"><div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/30 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center"><img src={team.logoUrl || "/placeholder.svg"} alt="" className="h-20 w-20 rounded-2xl border border-white/15 bg-white/10 object-cover shadow-lg sm:h-28 sm:w-28" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">Club profile</p><h1 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-4xl">{team.name}</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-slate-300"><MapPin className="h-4 w-4" /> {team.city || "Club location"}{team.homeStadium ? ` · ${team.homeStadium}` : ""}</p><div className="mt-4"><FollowButton type="TEAM" entityId={team.id} /></div></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-xl font-black">{standing ? `#${standing.position}` : "—"}</p><p className="text-[10px] uppercase text-slate-300">Position</p></div><div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-xl font-black">{standing?.points ?? 0}</p><p className="text-[10px] uppercase text-slate-300">Points</p></div><div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-xl font-black">{team._count?.players || team.players?.length || 0}</p><p className="text-[10px] uppercase text-slate-300">Squad</p></div></div></div></section>

    <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><LeagueCard title="About the club"><div className="space-y-4 p-4 sm:p-5"><p className="text-sm leading-6 text-muted-foreground">{team.description || "No club description has been added yet."}</p><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-secondary px-3 py-1.5">{team.homeStadium || "Home venue TBC"}</span>{team.foundedYear && <span className="rounded-full bg-secondary px-3 py-1.5">Founded {team.foundedYear}</span>}</div></div></LeagueCard><LeagueCard title="Season snapshot"><div className="grid grid-cols-4 gap-px bg-border p-px">{[["P", standing?.played || 0], ["W", standing?.wins || 0], ["D", standing?.draws || 0], ["L", standing?.losses || 0], ["GF", standing?.goalsFor || 0], ["GA", standing?.goalsAgainst || 0], ["GD", standing?.goalDifference || 0], ["Pts", standing?.points || 0]].map(([label, stat]) => <div key={label as string} className="bg-card p-3 text-center"><p className="text-lg font-black tabular-nums">{stat as number}</p><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label as string}</p></div>)}</div></LeagueCard></div>

    <section className="mt-6"><LeagueCard title="Squad" action={<span className="text-sm text-muted-foreground">{team.players?.length || 0} players</span>}>{team.players?.length ? <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4 xl:grid-cols-5">{team.players.map((player) => <button key={player.id} onClick={() => navigate(`/league/players/${player.slug}`)} className="flex items-center gap-2 rounded-xl border p-2 text-left transition hover:bg-secondary/50"><img src={player.photoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-lg bg-muted object-cover" /><span className="min-w-0"><span className="block truncate text-xs font-bold sm:text-sm">{player.firstName} {player.lastName}</span><span className="block text-[10px] text-muted-foreground">{player.position || "Player"}{player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}</span></span></button>)}</div> : <div className="p-4"><LeagueEmptyState title="No squad uploaded" description="Add players to show the squad." /></div>}</LeagueCard></section>

    <div className="mt-6 grid gap-5 lg:grid-cols-2"><LeagueCard title="Recent matches" action={<CalendarDays className="h-4 w-4 text-muted-foreground" />}>{completed.length ? <div>{completed.map((fixture) => <MatchRow key={fixture.id} fixture={fixture} onOpen={() => navigate(`/league/fixtures/${fixture.id}`)} />)}</div> : <LeagueEmptyState title="No results yet" description="Completed matches will appear here." />}</LeagueCard><LeagueCard title="Upcoming fixtures" action={<CalendarDays className="h-4 w-4 text-muted-foreground" />}>{upcoming.length ? <div>{upcoming.map((fixture) => <MatchRow key={fixture.id} fixture={fixture} onOpen={() => navigate(`/league/fixtures/${fixture.id}`)} />)}</div> : <LeagueEmptyState title="No upcoming fixtures" description="The next fixtures will appear here." />}</LeagueCard></div>

    <section className="mt-6"><LeagueCard title="Gallery">{team.galleries?.length ? <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4">{team.galleries.slice(0, 12).map((gallery) => <img key={gallery.id} src={gallery.imageUrl} alt={gallery.title || "Club gallery"} className="aspect-square rounded-xl object-cover" />)}</div> : <div className="p-4"><LeagueEmptyState title="No gallery yet" description="Club media will appear here." /></div>}</LeagueCard></section>
  </motion.div></div>;
}
