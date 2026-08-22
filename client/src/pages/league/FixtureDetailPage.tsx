import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, getMatchStatusColor } from "@/lib/utils";
import { useLineup } from "@/hooks/useLineup";
import { FootballPitch } from "@/components/league/FootballPitch";
import { BenchPlayers } from "@/components/league/BenchPlayers";
import { FormationBadge } from "@/components/league/FormationBadge";
import { useAuth } from "@/providers/AuthProvider";
import type { Fixture, Team } from "@/types";
import { ChevronLeft, ChevronRight, Swords } from "lucide-react";
import { PageError } from "@/components/PageState";
import { fixtureDateKey, isActiveMatch } from "@/lib/fixtures";

function AnimatedScore({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!value || value === 0) return;
    const duration = 800;
    const steps = 20;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{count}</span>;
}

function PlayerLink({ player, children }: { player: { id: string; slug?: string; firstName?: string; lastName?: string }; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="cursor-pointer text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => navigate(`/league/players/${player.slug || player.id}`)}>
      {children}
    </button>
  );
}

const HOME_COLOR = "#22c55e";
const AWAY_COLOR = "#38bdf8";

function TeamDotBadge({ teamName, color, logoUrl }: { teamName?: string; color?: string; logoUrl?: string }) {
  if (!teamName) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {logoUrl ? <img src={logoUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover" /> : color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /> : null}
      <span className="truncate">{teamName}</span>
    </span>
  );
}

function MatchLineupsSection({ fixtureId, homeTeam, awayTeam }: { fixtureId: string; homeTeam: Team; awayTeam: Team }) {
  const { data: lineups, isLoading } = useLineup(fixtureId);

  const hasAny =
    !!lineups &&
    (lineups.home.starters.length > 0 ||
      lineups.home.bench.length > 0 ||
      lineups.away.starters.length > 0 ||
      lineups.away.bench.length > 0);

  return (
    <Card>
      <CardHeader><CardTitle>Match Lineups</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading lineups…</p>
        ) : !hasAny ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No lineup has been announced.</p>
        ) : (
          <div className="space-y-4">
            {/* Team headers + formations */}
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                {homeTeam.logoUrl && <img src={homeTeam.logoUrl} alt="" className="h-7 w-7 rounded-full bg-muted object-cover" />}
                <span className="truncate font-semibold">{homeTeam.shortName || homeTeam.name}</span>
                <FormationBadge formation={lineups?.home.formation ?? null} />
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <FormationBadge formation={lineups?.away.formation ?? null} />
                <span className="truncate font-semibold">{awayTeam.shortName || awayTeam.name}</span>
                {awayTeam.logoUrl && <img src={awayTeam.logoUrl} alt="" className="h-7 w-7 rounded-full bg-muted object-cover" />}
              </div>
            </div>

            <FootballPitch
              homePlayers={lineups?.home.starters ?? []}
              awayPlayers={lineups?.away.starters ?? []}
              readonly
              homeColor={HOME_COLOR}
              awayColor={AWAY_COLOR}
              className="mx-auto max-w-sm"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <BenchPlayers players={lineups?.home.bench ?? []} color={HOME_COLOR} />
              <BenchPlayers players={lineups?.away.bench ?? []} color={AWAY_COLOR} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FixtureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [streamFailed, setStreamFailed] = useState(false);

  const { data: fixture, isLoading, isError, refetch } = useQuery({
    queryKey: ["fixture", id],
    queryFn: () => api.get<Fixture>(`/league/fixtures/${id}`),
    enabled: !!id,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => streamFailed && ["LIVE", "PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES"].includes(query.state.data?.status || "") ? 10_000 : false,
  });

  useEffect(() => {
    if (!id || !fixture || !isActiveMatch(fixture.status)) return;
    setStreamFailed(false);
    const source = new EventSource(api.fixtureEventStreamUrl(id), { withCredentials: true });
    const refresh = () => void refetch();
    source.addEventListener("match-event", refresh);
    source.addEventListener("fixture", refresh);
    source.addEventListener("archived", refresh);
    source.onerror = () => { source.close(); setStreamFailed(true); };
    return () => source.close();
  }, [id, fixture?.status, refetch]);

  const { data: rsvp, refetch: refetchRsvp } = useQuery({ queryKey: ["rsvp", id], queryFn: () => api.get<any>(`/league/fixtures/${id}/rsvp`), enabled: !!id && !!user });
  const setRsvp = async (status: "GOING" | "MAYBE" | "NOT_GOING") => { await api.post(`/league/fixtures/${id}/rsvp`, { status }); await refetchRsvp(); };

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  if (isError || !fixture) return <PageError title="Match unavailable" description="This fixture may have been archived or could not be loaded." onRetry={() => void refetch()} action={<Button variant="outline" onClick={() => navigate("/league/fixtures")}>All fixtures</Button>} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {/* Match Header */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white">
          <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
            <Badge className={`${getMatchStatusColor(fixture.status)}`}>
              {fixture.status}
            </Badge>
            {fixture.isFriendly && <Badge className="bg-violet-500/90 hover:bg-violet-500/90">Friendly</Badge>}
            {!fixture.isFriendly && fixture.competition?.name && <Badge className="bg-white/10 text-white hover:bg-white/10">{fixture.competition.name}</Badge>}
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex flex-col items-center gap-2 sm:flex-1">
              <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-full bg-white/10 p-1.5 sm:h-16 sm:w-16 sm:p-2" />
              <h2 className="text-base font-bold sm:text-xl">{fixture.homeTeam.shortName || fixture.homeTeam.name}</h2>
            </div>
            <div className="text-center">
              {fixture.status === "COMPLETED" || isActiveMatch(fixture.status) ? (
                <div className="text-3xl font-bold sm:text-5xl tabular-nums">
                  <AnimatedScore value={fixture.homeScore ?? 0} /> - <AnimatedScore value={fixture.awayScore ?? 0} />
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground sm:text-3xl">VS</div>
              )}
              {isActiveMatch(fixture.status) && <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-rose-300">{fixture.status.replace("_", " ")} · {Math.floor((fixture.matchClockSeconds || 0) / 60)}:{String((fixture.matchClockSeconds || 0) % 60).padStart(2, "0")}</p>}
              <p className="mt-1 text-white/60 text-xs sm:mt-2 sm:text-sm">
                {formatDate(fixtureDateKey(fixture))} · {fixture.kickoffTime || "TBD"}
              </p>
              {fixture.stadium && <p className="text-white/40 text-xs">{fixture.stadium}</p>}
            </div>
            <div className="flex flex-col items-center gap-2 sm:flex-1">
              <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-full bg-white/10 p-1.5 sm:h-16 sm:w-16 sm:p-2" />
              <h2 className="text-base font-bold sm:text-xl">{fixture.awayTeam.shortName || fixture.awayTeam.name}</h2>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto]">
          <Card><CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Possession</p><p className="font-semibold">{fixture.homePossession ?? "-"}% · {fixture.awayPossession ?? "-"}%</p></div><div><p className="text-xs text-muted-foreground">Shots</p><p className="font-semibold">{fixture.homeShots ?? 0} · {fixture.awayShots ?? 0}</p></div><div><p className="text-xs text-muted-foreground">On target</p><p className="font-semibold">{fixture.homeShotsOnTarget ?? 0} · {fixture.awayShotsOnTarget ?? 0}</p></div><div><p className="text-xs text-muted-foreground">RSVP</p><p className="font-semibold">{rsvp?.status || "Not set"}</p></div></CardContent></Card>
          {user && <div className="flex items-center gap-2"><Button variant={rsvp?.status === "GOING" ? "default" : "outline"} onClick={() => setRsvp("GOING")}>I’m going</Button><Button variant={rsvp?.status === "MAYBE" ? "default" : "outline"} onClick={() => setRsvp("MAYBE")}>Maybe</Button></div>}
        </div>

        {(fixture.extraTimeHomeScore != null || fixture.penaltiesHomeScore != null || fixture.outcome === "WALKOVER" || fixture.outcome === "FORFEIT" || fixture.status === "POSTPONED") && (
          <Card className="mb-8"><CardContent className="space-y-2 p-4 text-sm">
            {fixture.status === "POSTPONED" && <p className="font-medium text-amber-600">Postponed{fixture.postponementReason ? `: ${fixture.postponementReason}` : ""}</p>}
            {(fixture.extraTimeHomeScore != null || fixture.penaltiesHomeScore != null) && <div className="flex flex-wrap gap-4">{fixture.extraTimeHomeScore != null && fixture.extraTimeAwayScore != null && <span>After extra time: {fixture.extraTimeHomeScore} - {fixture.extraTimeAwayScore}</span>}{fixture.penaltiesHomeScore != null && fixture.penaltiesAwayScore != null && <span>Penalties: {fixture.penaltiesHomeScore} - {fixture.penaltiesAwayScore}</span>}</div>}
            {(fixture.outcome === "WALKOVER" || fixture.outcome === "FORFEIT") && <p className="font-medium">Result: {fixture.outcome.toLowerCase()}</p>}
          </CardContent></Card>
        )}

        {fixture.highlights && (
          <div className="mb-8 overflow-hidden rounded-2xl">
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube.com/embed/${fixture.highlights.replace("https://www.youtube.com/watch?v=", "").replace("https://youtu.be/", "").split("&")[0]}`}
              title="Match Highlights"
              allowFullScreen
            />
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Goals */}
            {fixture.goals && fixture.goals.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Goals</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {fixture.goals.map((goal) => (
                    <div key={goal.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                      <Swords className="h-4 w-4 text-green-500" />
                      <TeamDotBadge
                        teamName={goal.player.teamId === fixture.homeTeamId ? fixture.homeTeam.shortName || fixture.homeTeam.name : goal.player.teamId === fixture.awayTeamId ? fixture.awayTeam.shortName || fixture.awayTeam.name : undefined}
                        color={goal.player.teamId === fixture.homeTeamId ? HOME_COLOR : goal.player.teamId === fixture.awayTeamId ? AWAY_COLOR : undefined}
                        logoUrl={goal.player.teamId === fixture.homeTeamId ? fixture.homeTeam.logoUrl : goal.player.teamId === fixture.awayTeamId ? fixture.awayTeam.logoUrl : undefined}
                      />
                      <PlayerLink player={goal.player}>
                        <span className="text-sm font-medium">{goal.player.firstName} {goal.player.lastName}</span>
                      </PlayerLink>
                      <Badge variant="secondary">{goal.minute}'</Badge>
                      {goal.isPenalty && <Badge>Penalty</Badge>}
                      {goal.isOwnGoal && <Badge variant="destructive">Own Goal</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Cards */}
            {fixture.cards && fixture.cards.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Cards</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {fixture.cards.map((card) => (
                    <div key={card.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                      <div className={`h-4 w-3 rounded-sm ${card.type === "RED" ? "bg-red-500" : "bg-yellow-400"}`} />
                      <TeamDotBadge
                        teamName={card.player.teamId === fixture.homeTeamId ? fixture.homeTeam.shortName || fixture.homeTeam.name : card.player.teamId === fixture.awayTeamId ? fixture.awayTeam.shortName || fixture.awayTeam.name : undefined}
                        color={card.player.teamId === fixture.homeTeamId ? HOME_COLOR : card.player.teamId === fixture.awayTeamId ? AWAY_COLOR : undefined}
                        logoUrl={card.player.teamId === fixture.homeTeamId ? fixture.homeTeam.logoUrl : card.player.teamId === fixture.awayTeamId ? fixture.awayTeam.logoUrl : undefined}
                      />
                      <PlayerLink player={card.player}>
                        <span className="text-sm font-medium">{card.player.firstName} {card.player.lastName}</span>
                      </PlayerLink>
                      <Badge variant="secondary">{card.minute}'</Badge>
                      <span className="text-xs text-muted-foreground">{card.type}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Substitutions */}
            {fixture.substitutions && fixture.substitutions.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Substitutions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {fixture.substitutions.map((sub) => (
                    <div key={sub.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                      <TeamDotBadge
                        teamName={sub.playerOff.teamId === fixture.homeTeamId ? fixture.homeTeam.shortName || fixture.homeTeam.name : sub.playerOff.teamId === fixture.awayTeamId ? fixture.awayTeam.shortName || fixture.awayTeam.name : undefined}
                        color={sub.playerOff.teamId === fixture.homeTeamId ? HOME_COLOR : sub.playerOff.teamId === fixture.awayTeamId ? AWAY_COLOR : undefined}
                        logoUrl={sub.playerOff.teamId === fixture.homeTeamId ? fixture.homeTeam.logoUrl : sub.playerOff.teamId === fixture.awayTeamId ? fixture.awayTeam.logoUrl : undefined}
                      />
                      <PlayerLink player={sub.playerOff}>
                        <span className="text-muted-foreground line-through">{sub.playerOff.firstName} {sub.playerOff.lastName}</span>
                      </PlayerLink>
                      <ChevronRight className="h-3 w-3" />
                      <PlayerLink player={sub.playerOn}>
                        <span className="font-medium">{sub.playerOn.firstName} {sub.playerOn.lastName}</span>
                      </PlayerLink>
                      <Badge variant="secondary">{sub.minute}'</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Lineups */}
            <MatchLineupsSection fixtureId={fixture.id} homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} />

            {/* Player Ratings */}
            {(fixture.matchPlayerRatings && fixture.matchPlayerRatings.length > 0) && (
              <Card>
                <CardHeader><CardTitle>Player Ratings</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...fixture.matchPlayerRatings].sort((a, b) => b.rating - a.rating).map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
                        <TeamDotBadge
                          teamName={r.player.teamId === fixture.homeTeamId ? fixture.homeTeam.shortName || fixture.homeTeam.name : r.player.teamId === fixture.awayTeamId ? fixture.awayTeam.shortName || fixture.awayTeam.name : undefined}
                          color={r.player.teamId === fixture.homeTeamId ? HOME_COLOR : r.player.teamId === fixture.awayTeamId ? AWAY_COLOR : undefined}
                          logoUrl={r.player.teamId === fixture.homeTeamId ? fixture.homeTeam.logoUrl : r.player.teamId === fixture.awayTeamId ? fixture.awayTeam.logoUrl : undefined}
                        />
                        <PlayerLink player={r.player}>
                          <span className="text-sm">{r.player.firstName} {r.player.lastName}</span>
                        </PlayerLink>
                        <div className="flex-1" />
                        <Badge variant={r.rating >= 8 ? "default" : "secondary"}>{r.rating.toFixed(1)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            {fixture.comments && fixture.comments.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {fixture.comments.map((c) => (
                    <div key={c.id} className="border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {c.user.firstName[0]}
                        </div>
                        <p className="text-sm font-medium">{c.user.firstName} {c.user.lastName}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.content}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stats Sidebar */}
          <div>
            <Card>
              <CardHeader><CardTitle>Match Statistics</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Possession", home: fixture.homePossession, away: fixture.awayPossession, unit: "%" },
                  { label: "Shots", home: fixture.homeShots, away: fixture.awayShots },
                  { label: "Shots on Target", home: fixture.homeShotsOnTarget, away: fixture.awayShotsOnTarget },
                  { label: "Corners", home: fixture.homeCorners, away: fixture.awayCorners },
                  { label: "Fouls", home: fixture.homeFouls, away: fixture.awayFouls },
                  { label: "Offsides", home: fixture.homeOffsides, away: fixture.awayOffsides },
                  { label: "Expected Goals", home: fixture.homeExpectedGoals, away: fixture.awayExpectedGoals },
                ].map((stat) => {
                  const hasData = stat.home != null && stat.away != null;
                  const home = hasData ? (Number(stat.home) || 0) : 0;
                  const away = hasData ? (Number(stat.away) || 0) : 0;
                  const total = home + away;
                  return (
                    <div key={stat.label}>
                      <p className="mb-1 text-center text-xs text-muted-foreground">{stat.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-right text-sm font-medium">{hasData ? `${home}${stat.unit || ""}` : "-"}</span>
                        <div className="flex h-2 flex-1 gap-0.5">
                          {hasData ? (
                            <>
                              <div className="rounded-l-full bg-primary" style={{ width: `${total ? (home / total) * 100 : 50}%` }} />
                              <div className="rounded-r-full bg-destructive" style={{ width: `${total ? (away / total) * 100 : 50}%` }} />
                            </>
                          ) : (
                            <div className="w-full rounded-full bg-muted" />
                          )}
                        </div>
                        <span className="w-8 text-sm font-medium">{hasData ? `${away}${stat.unit || ""}` : "-"}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Match Info */}
            <Card className="mt-6">
              <CardHeader><CardTitle>Match Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Competition</span><span>{fixture.isFriendly ? "Friendly" : fixture.competition?.name || "League"}</span></div>
                {fixture.round != null && <div className="flex justify-between"><span className="text-muted-foreground">Round</span><span>{fixture.round}</span></div>}
                {fixture.stadium && <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span>{fixture.stadium}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Referee</span><span>{fixture.referee || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span>{fixture.attendance ? fixture.attendance.toLocaleString() : "—"}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Man of the Match</span>
                  {fixture.manOfTheMatch ? (
                    <PlayerLink player={fixture.manOfTheMatch}>
                      <span className="font-medium">{fixture.manOfTheMatch.firstName} {fixture.manOfTheMatch.lastName}</span>
                    </PlayerLink>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ArrowRightLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}
