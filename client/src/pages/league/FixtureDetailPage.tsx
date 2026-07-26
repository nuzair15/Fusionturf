import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatTime, getMatchStatusColor } from "@/lib/utils";
import type { Fixture } from "@/types";
import { ChevronLeft, MapPin, Users, Clock, Shield, Swords } from "lucide-react";

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
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-2">
              <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-16 w-16 rounded-full bg-white/10 p-2" />
              <h2 className="text-xl font-bold">{fixture.homeTeam.name}</h2>
            </div>
            <div className="text-center">
              {fixture.status === "COMPLETED" ? (
                <div className="text-5xl font-bold">{fixture.homeScore} - {fixture.awayScore}</div>
              ) : (
                <div className="text-3xl font-bold text-muted-foreground">VS</div>
              )}
              <p className="mt-2 text-white/60 text-sm">
                {formatDate(fixture.matchDate)} • {fixture.kickoffTime || "TBD"}
              </p>
              {fixture.stadium && <p className="text-white/40 text-xs">{fixture.stadium}</p>}
            </div>
            <div className="flex flex-col items-center gap-2">
              <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-16 w-16 rounded-full bg-white/10 p-2" />
              <h2 className="text-xl font-bold">{fixture.awayTeam.name}</h2>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Match Events */}
            {fixture.goals && fixture.goals.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Goals</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {fixture.goals.map((goal) => (
                    <div key={goal.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Swords className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{goal.player.firstName} {goal.player.lastName}</span>
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
                      <span className="text-sm font-medium">{card.player.firstName} {card.player.lastName}</span>
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
                      <span className="text-muted-foreground line-through">{sub.playerOff.firstName} {sub.playerOff.lastName}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-medium">{sub.playerOn.firstName} {sub.playerOn.lastName}</span>
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
                                <span>{l.player.firstName} {l.player.lastName}</span>
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
                        <span className="text-sm">{r.player.firstName} {r.player.lastName}</span>
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
                  stat.home !== null && stat.away !== null && (
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Man of the Match</span>
                    <span className="font-medium">{fixture.manOfTheMatch.firstName} {fixture.manOfTheMatch.lastName}</span>
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
