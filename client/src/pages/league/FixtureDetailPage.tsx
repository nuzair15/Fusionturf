import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, getMatchStatusColor } from "@/lib/utils";
import type { Fixture } from "@/types";
import { ChevronLeft, ChevronRight, Swords } from "lucide-react";

function AnimatedScore({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
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
    <span className="cursor-pointer transition-colors hover:text-primary" onClick={() => navigate(`/league/players/${player.slug || player.id}`)}>
      {children}
    </span>
  );
}

export function FixtureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: fixture, isLoading } = useQuery({
    queryKey: ["fixture", id],
    queryFn: () => api.get<Fixture>(`/league/fixtures/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  if (!fixture) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {/* Match Header */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white">
          <Badge className={`absolute right-4 top-4 ${getMatchStatusColor(fixture.status)}`}>
            {fixture.status}
          </Badge>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex flex-col items-center gap-2 sm:flex-1">
              <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-full bg-white/10 p-1.5 sm:h-16 sm:w-16 sm:p-2" />
              <h2 className="text-base font-bold sm:text-xl">{fixture.homeTeam.shortName || fixture.homeTeam.name}</h2>
            </div>
            <div className="text-center">
              {fixture.status === "COMPLETED" ? (
                <div className="text-3xl font-bold sm:text-5xl tabular-nums">
                  <AnimatedScore value={fixture.homeScore ?? 0} /> - <AnimatedScore value={fixture.awayScore ?? 0} />
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground sm:text-3xl">VS</div>
              )}
              <p className="mt-1 text-white/60 text-xs sm:mt-2 sm:text-sm">
                {formatDate(fixture.matchDate)} • {fixture.kickoffTime || "TBD"}
              </p>
              {fixture.stadium && <p className="text-white/40 text-xs">{fixture.stadium}</p>}
            </div>
            <div className="flex flex-col items-center gap-2 sm:flex-1">
              <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-full bg-white/10 p-1.5 sm:h-16 sm:w-16 sm:p-2" />
              <h2 className="text-base font-bold sm:text-xl">{fixture.awayTeam.shortName || fixture.awayTeam.name}</h2>
            </div>
          </div>
        </div>

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
                    <div key={goal.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Swords className="h-4 w-4 text-green-500" />
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
                    <div key={card.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className={`h-4 w-3 rounded-sm ${card.type === "RED" ? "bg-red-500" : "bg-yellow-400"}`} />
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
                    <div key={sub.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
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
            {fixture.lineups && fixture.lineups.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Lineups</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {["home", "away"].map((side) => {
                      const isHome = side === "home";
                      const team = isHome ? fixture.homeTeam : fixture.awayTeam;
                      const starters = fixture.lineups!.filter((l) => l.isStarter && l.player.teamId === (isHome ? fixture.homeTeamId : fixture.awayTeamId));
                      return (
                        <div key={side}>
                          <h4 className="mb-2 text-sm font-semibold">{team.shortName || team.name}</h4>
                          <div className="space-y-1">
                            {starters.map((l) => (
                              <div key={l.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
                                <span className="w-4 text-muted-foreground">{l.jerseyNumber}</span>
                                <PlayerLink player={l.player}>
                                  <span>{l.player.firstName} {l.player.lastName}</span>
                                </PlayerLink>
                                <span className="ml-auto text-muted-foreground">{l.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Player Ratings */}
            {fixture.matchPlayerRatings && fixture.matchPlayerRatings.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Player Ratings</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {fixture.matchPlayerRatings.sort((a, b) => b.rating - a.rating).slice(0, 10).map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border p-2">
                        <PlayerLink player={r.player}>
                          <span className="text-sm">{r.player.firstName} {r.player.lastName}</span>
                        </PlayerLink>
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
                ].map((stat) => (
                  stat.home != null && stat.away != null && (
                    <div key={stat.label}>
                      <p className="mb-1 text-center text-xs text-muted-foreground">{stat.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-right text-sm font-medium">{stat.home}{stat.unit || ""}</span>
                        <div className="flex-1 flex gap-0.5 h-2">
                          <div className="bg-primary rounded-l-full" style={{ width: `${(stat.home / (stat.home + stat.away)) * 100}%` }} />
                          <div className="bg-destructive rounded-r-full" style={{ width: `${(stat.away / (stat.home + stat.away)) * 100}%` }} />
                        </div>
                        <span className="w-8 text-sm font-medium">{stat.away}{stat.unit || ""}</span>
                      </div>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>

            {/* Match Info */}
            <Card className="mt-6">
              <CardHeader><CardTitle>Match Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {fixture.referee && <div className="flex justify-between"><span className="text-muted-foreground">Referee</span><span>{fixture.referee}</span></div>}
                {fixture.attendance && <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span>{fixture.attendance.toLocaleString()}</span></div>}
                {fixture.manOfTheMatch && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Man of the Match</span>
                    <PlayerLink player={fixture.manOfTheMatch}>
                      <span className="font-medium">{fixture.manOfTheMatch.firstName} {fixture.manOfTheMatch.lastName}</span>
                    </PlayerLink>
                  </div>
                )}
                {fixture.competition && <div className="flex justify-between"><span className="text-muted-foreground">Competition</span><span>{fixture.competition.name}</span></div>}
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
