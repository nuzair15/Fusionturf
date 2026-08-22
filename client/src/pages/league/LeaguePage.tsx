import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatTime, getMatchStatusColor } from "@/lib/utils";
import type { Fixture, Standing, Team, Season, Venue, News, PaginatedResponse } from "@/types";
import { Trophy, Calendar, BarChart3, Medal, Newspaper, ChevronRight, Users, MapPin, Target, Shield, Flame } from "lucide-react";
import { LeagueHero, LeagueCard, LeagueEmptyState, LeaguePills, SectionLink, StatTile, TrendBadge } from "@/components/league/LeagueUI";
import { ACTIVE_MATCH_STATUSES, fixtureDateKey, fixtureScoreLabel } from "@/lib/fixtures";
import { useMemo, useState } from "react";

export function LeaguePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("overview");

  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false, refetchOnWindowFocus: true, refetchInterval: 60000 });
  const { data: fixtures } = useQuery({ queryKey: ["fixtures", "league", "upcoming", 20], queryFn: () => api.get<{ data: Fixture[] }>("/v2/fixtures", { limit: "20", scope: "upcoming" }), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 15000 });
  const { data: recentFixturesData } = useQuery({ queryKey: ["fixtures", "league", "recent", 20], queryFn: () => api.get<{ data: Fixture[] }>("/v2/fixtures", { limit: "20", scope: "recent" }), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 15000 });
  const { data: standings } = useQuery({ queryKey: ["standings"], queryFn: () => api.get<Standing[]>("/league/standings"), staleTime: 60_000, refetchOnWindowFocus: false });
  const { data: teams } = useQuery({ queryKey: ["teams"], queryFn: () => api.get<Team[]>("/league/teams"), staleTime: 60_000, refetchOnWindowFocus: false });
  const { data: venues } = useQuery({ queryKey: ["venues", { limit: 20 }], queryFn: () => api.get<{ data: Venue[] }>("/bookings/venues", { limit: 20 }), refetchOnWindowFocus: true, refetchInterval: 60000 });
  const { data: newsData } = useQuery({ queryKey: ["league-news"], queryFn: () => api.get<PaginatedResponse<News>>("/league/news"), refetchOnWindowFocus: true, refetchInterval: 60000 });

  const fixtureList = fixtures?.data || [];
  const recentFixtureList = recentFixturesData?.data || [];
  const standingsList = standings || [];
  const teamList = teams || [];
  const venueList = venues?.data || [];
  const newsList = newsData?.data || [];

  const liveFixtures = useMemo(() => fixtureList.filter((f) => ACTIVE_MATCH_STATUSES.includes(f.status)), [fixtureList]);
  const upcomingFixtures = useMemo(() => fixtureList.filter((f) => f.status === "SCHEDULED").slice(0, 4), [fixtureList]);
  const recentFixtures = useMemo(() => recentFixtureList.slice(0, 4), [recentFixtureList]);
  const leaders = standingsList.slice(0, 3);

  return (
    <div className="space-y-8 pb-8">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <LeagueHero
          eyebrow={<><Flame className="h-3.5 w-3.5" /> League hub</>}
          title={<>Fusion League</>}
          subtitle={`${currentSeason?.name || "Current season"} with live fixtures, standings, squads, stats, awards, and club news in one place.`}
          actions={(
            <>
              <Button size="lg" className="gap-2" onClick={() => navigate("/league/fixtures")}><Calendar className="h-5 w-5" /> Fixtures</Button>
              <Button size="lg" variant="secondary" className="gap-2" onClick={() => navigate("/league/standings")}><Trophy className="h-5 w-5" /> Standings</Button>
            </>
          )}
          stats={[
            { label: "Live matches", value: liveFixtures.length },
            { label: "Upcoming", value: upcomingFixtures.length },
            { label: "Teams", value: teamList.length },
            { label: "Top team", value: standingsList[0]?.team?.name || "TBD" },
          ]}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <LeaguePills
          active={mode}
          onChange={setMode}
          items={[
            { key: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
            { key: "table", label: "Table", icon: <Trophy className="h-4 w-4" /> },
            { key: "fixtures", label: "Fixtures", icon: <Calendar className="h-4 w-4" /> },
            { key: "clubs", label: "Clubs", icon: <Users className="h-4 w-4" /> },
            { key: "stats", label: "Stats", icon: <Target className="h-4 w-4" /> },
            { key: "news", label: "News", icon: <Newspaper className="h-4 w-4" /> },
          ]}
        />
      </div>

      {mode === "overview" && (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 xl:grid-cols-[1.15fr_0.85fr]">
          <LeagueCard title="Matchday focus" action={<SectionLink onClick={() => navigate("/league/fixtures")}>All fixtures</SectionLink>}>
            <div className="grid gap-3 p-4">
              {[...liveFixtures, ...upcomingFixtures, ...recentFixtures].slice(0, 5).map((fixture) => (
                <button
                  key={fixture.id}
                  onClick={() => navigate(`/league/fixtures/${fixture.id}`)}
                  className="grid gap-3 rounded-2xl border px-4 py-4 text-left transition hover:bg-secondary/50 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                    <div>
                      <p className="font-semibold">{fixture.homeTeam.shortName || fixture.homeTeam.name}</p>
                      <p className="text-xs text-muted-foreground">{fixture.homeTeam.city || "Home"}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <TrendBadge>{fixture.status}</TrendBadge>
                    <p className="mt-2 text-2xl font-bold tabular-nums">
                      {fixtureScoreLabel(fixture)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(fixtureDateKey(fixture))} {fixture.kickoffTime ? `· ${formatTime(fixture.kickoffTime)}` : ""}</p>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{fixture.awayTeam.shortName || fixture.awayTeam.name}</p>
                      <p className="text-xs text-muted-foreground">{fixture.stadium || fixture.venue?.name || "Venue TBD"}</p>
                    </div>
                    <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                  </div>
                </button>
              ))}
            </div>
          </LeagueCard>

          <div className="space-y-6">
            <LeagueCard title="Top three" action={<SectionLink onClick={() => navigate("/league/standings")}>Table</SectionLink>}>
              <div className="space-y-2 p-4">
                {leaders.length > 0 ? leaders.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => navigate(`/league/teams/${row.team.slug}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:bg-secondary/50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{row.position}</span>
                    <img src={row.team.logoUrl || "/placeholder.svg"} alt="" className="h-9 w-9 rounded-full bg-muted object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.team.name}</p>
                      <p className="text-xs text-muted-foreground">{row.played} played • {row.points} pts</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{row.wins}W {row.draws}D {row.losses}L</p>
                      <p>{row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference} GD</p>
                    </div>
                  </button>
                )) : (
                  <LeagueEmptyState title="No table yet" description="Once results are in, the leaderboard will show here." />
                )}
              </div>
            </LeagueCard>

            <LeagueCard title="Club directory" action={<SectionLink onClick={() => navigate("/league")}>Open all</SectionLink>}>
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                {teamList.slice(0, 6).map((team) => (
                  <button
                    key={team.id}
                    onClick={() => navigate(`/league/teams/${team.slug}`)}
                    className="rounded-2xl border p-3 text-center transition hover:bg-secondary/50"
                  >
                    <img src={team.logoUrl || "/placeholder.svg"} alt="" className="mx-auto h-12 w-12 rounded-full bg-muted object-cover" />
                    <p className="mt-2 text-sm font-semibold">{team.shortName || team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.city || "Club"}</p>
                  </button>
                ))}
              </div>
            </LeagueCard>
          </div>
        </div>
      )}

      {mode === "table" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="League table" action={<SectionLink onClick={() => navigate("/league/standings")}>Open full table</SectionLink>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/70 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Team</th>
                    <th className="p-3 text-center">P</th>
                    <th className="p-3 text-center">W</th>
                    <th className="p-3 text-center">D</th>
                    <th className="p-3 text-center">L</th>
                    <th className="p-3 text-center">GD</th>
                    <th className="p-3 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsList.slice(0, 8).map((row) => (
                    <tr key={row.id} className="cursor-pointer border-t transition hover:bg-secondary/50" onClick={() => navigate(`/league/teams/${row.team.slug}`)}>
                      <td className="p-3 font-semibold">{row.position}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img src={row.team.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted object-cover" />
                          <div>
                            <p className="font-semibold">{row.team.name}</p>
                            <p className="text-xs text-muted-foreground">{row.team.shortName || row.team.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">{row.played}</td>
                      <td className="p-3 text-center text-green-600">{row.wins}</td>
                      <td className="p-3 text-center text-amber-600">{row.draws}</td>
                      <td className="p-3 text-center text-red-600">{row.losses}</td>
                      <td className="p-3 text-center font-medium">{row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="p-3 text-center font-bold">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LeagueCard>
        </div>
      )}

      {mode === "fixtures" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Upcoming fixtures" action={<SectionLink onClick={() => navigate("/league/fixtures")}>Calendar view</SectionLink>}>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              {upcomingFixtures.length > 0 ? upcomingFixtures.map((fixture) => (
                <button key={fixture.id} onClick={() => navigate(`/league/fixtures/${fixture.id}`)} className="rounded-2xl border p-4 text-left transition hover:bg-secondary/50">
                  <TrendBadge>{fixture.status}</TrendBadge>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{fixture.homeTeam.shortName || fixture.homeTeam.name}</p>
                      <p className="text-xs text-muted-foreground">{fixture.awayTeam.shortName || fixture.awayTeam.name}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{formatDate(fixtureDateKey(fixture))} · {fixture.kickoffTime || "TBD"}</p>
                </button>
              )) : (
                <div className="md:col-span-2 xl:col-span-4">
                  <LeagueEmptyState title="No upcoming matches" description="When fixtures are scheduled, they will appear here." />
                </div>
              )}
            </div>
          </LeagueCard>
        </div>
      )}

      {mode === "clubs" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Clubs" action={<SectionLink onClick={() => navigate("/league")}>View all</SectionLink>}>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teamList.map((team) => (
                <button key={team.id} onClick={() => navigate(`/league/teams/${team.slug}`)} className="rounded-2xl border p-4 text-left transition hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <img src={team.logoUrl || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-full bg-muted object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.city || "Club profile"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{team._count?.players || 0} players</span>
                    <span>{team.standings?.[0]?.points ?? 0} pts</span>
                  </div>
                </button>
              ))}
            </div>
          </LeagueCard>
        </div>
      )}

      {mode === "stats" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <StatTile label="Goals" value={fixtureList.filter((f) => f.homeScore != null && f.awayScore != null).reduce((sum, f) => sum + (f.homeScore || 0) + (f.awayScore || 0), 0)} />
            <StatTile label="Top team" value={leaders[0]?.team?.name || "TBD"} detail={leaders[0] ? `${leaders[0].wins} wins` : "No data yet"} />
            <StatTile label="Venues" value={venueList.length} />
          </div>
        </div>
      )}

      {mode === "news" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Latest headlines" action={<SectionLink onClick={() => navigate("/league/news")}>Newsroom</SectionLink>}>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {newsList.slice(0, 4).map((article: News) => (
                <button key={article.id} onClick={() => navigate("/league/news")} className="overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-video bg-muted">
                    <img src={article.imageUrl || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="text-xs text-muted-foreground">{article.publishedAt ? formatDate(article.publishedAt) : "Latest"}</p>
                    <h3 className="line-clamp-2 text-sm font-semibold">{article.title}</h3>
                  </div>
                </button>
              ))}
            </div>
          </LeagueCard>
        </div>
      )}
    </div>
  );
}
