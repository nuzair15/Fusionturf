import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, getMatchStatusColor } from "@/lib/utils";
import type { Team } from "@/types";
import { MapPin, Users, ChevronLeft, Trophy, Calendar } from "lucide-react";

export function TeamDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: team, isLoading } = useQuery({
    queryKey: ["team", slug],
    queryFn: () => api.get<Team>(`/league/teams/${slug}`),
    enabled: !!slug,
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  if (!team) return null;

  const allMatches = [...(team.homeMatches || []), ...(team.awayMatches || [])].sort(
    (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>

        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-purple-700 p-8 text-white">
          <div className="flex items-center gap-6">
            {team.logoUrl && <img src={team.logoUrl} alt="" className="h-24 w-24 rounded-2xl bg-white p-2" />}
            <div>
              <h1 className="text-3xl font-bold">{team.name}</h1>
              <p className="mt-1 text-white/80">{team.city} • Founded {team.foundedYear}</p>
              <p className="text-white/60">{team.homeStadium}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Description */}
            {team.description && (
              <Card>
                <CardHeader><CardTitle>About</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">{team.description}</p></CardContent>
              </Card>
            )}

            {/* Squad */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Squad</CardTitle>
                <Badge variant="secondary">{team.players?.length || 0} players</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {team.players?.map((player) => (
                    <div
                      key={player.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/20"
                      onClick={() => navigate(`/league/players/${player.slug}`)}
                    >
                      <img src={player.photoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted" />
                      <div>
                        <p className="text-sm font-medium">{player.firstName} {player.lastName}</p>
                        <p className="text-xs text-muted-foreground">{player.position} • #{player.jerseyNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Matches */}
            <Card>
              <CardHeader><CardTitle>Recent Matches</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {allMatches.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/20"
                    onClick={() => navigate(`/league/fixtures/${m.id}`)}>
                    <div className="flex items-center gap-2">
                      <img src={m.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 rounded-full bg-muted" />
                      <span className="text-sm">{m.homeTeam.shortName}</span>
                    </div>
                    <Badge variant={m.status === "COMPLETED" ? "default" : "secondary"}>
                      {m.status === "COMPLETED" ? `${m.homeScore} - ${m.awayScore}` : m.status}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{m.awayTeam.shortName}</span>
                      <img src={m.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Staff */}
            {team.staff && team.staff.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Management & Staff</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {team.staff.map((staff) => (
                      <div key={staff.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {staff.firstName[0]}{staff.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{staff.firstName} {staff.lastName}</p>
                          <p className="text-xs text-muted-foreground">{staff.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sponsors */}
            {team.sponsors && team.sponsors.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Sponsors</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {team.sponsors.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded-lg border p-3">
                        <img src={s.logoUrl} alt={s.name} className="h-8 rounded" />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar Stats */}
          <div>
            <Card>
              <CardHeader><CardTitle>Season Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {team.standings?.slice(0, 1).map((s) => (
                  <div key={s.id} className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Position</span><span className="font-bold">#{s.position}</span></div>
                    <div className="flex justify-between"><span>Played</span><span>{s.played}</span></div>
                    <div className="flex justify-between"><span>Wins</span><span className="text-green-500">{s.wins}</span></div>
                    <div className="flex justify-between"><span>Draws</span><span className="text-yellow-500">{s.draws}</span></div>
                    <div className="flex justify-between"><span>Losses</span><span className="text-red-500">{s.losses}</span></div>
                    <div className="flex justify-between"><span>Goals For</span><span>{s.goalsFor}</span></div>
                    <div className="flex justify-between"><span>Goals Against</span><span>{s.goalsAgainst}</span></div>
                    <div className="flex justify-between border-t pt-2"><span>Points</span><span className="text-lg font-bold">{s.points}</span></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Gallery */}
            {team.galleries && team.galleries.length > 0 && (
              <Card className="mt-6">
                <CardHeader><CardTitle>Gallery</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {team.galleries.slice(0, 4).map((g) => (
                      <img key={g.id} src={g.imageUrl} alt="" className="aspect-square rounded-lg object-cover" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
