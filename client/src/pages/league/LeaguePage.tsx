import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, getMatchStatusColor } from "@/lib/utils";
import type { Fixture, Standing, Team, Season } from "@/types";
import { Trophy, Calendar, BarChart3, Medal, Newspaper, ChevronRight } from "lucide-react";

export function LeaguePage() {
  const navigate = useNavigate();

  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false });
  const { data: fixtures } = useQuery({ queryKey: ["fixtures"], queryFn: () => api.get<{ data: Fixture[] }>("/league/fixtures", { limit: "10" }) });
  const { data: standings } = useQuery({ queryKey: ["standings"], queryFn: () => api.get<Standing[]>("/league/standings") });
  const { data: teams } = useQuery({ queryKey: ["teams"], queryFn: () => api.get<Team[]>("/league/teams") });

  const fixtureList = fixtures?.data || [];
  const standingsList = standings || [];
  const teamList = teams || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 text-3xl font-bold">Fusion League</h1>
        <p className="mb-8 text-muted-foreground">{currentSeason?.name || "Season"}</p>

        {/* Quick Links */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: "Standings", icon: Trophy, to: "/league/standings" },
            { label: "Fixtures", icon: Calendar, to: "/league/fixtures" },
            { label: "Statistics", icon: BarChart3, to: "/league/stats" },
            { label: "Awards", icon: Medal, to: "/league/awards" },
            { label: "News", icon: Newspaper, to: "/league/news" },
            { label: "Teams", icon: Trophy, to: "/league" },
          ].map((link) => (
            <Button key={link.label} variant="outline" className="h-auto flex-col gap-1 py-4" onClick={() => navigate(link.to)}>
              <link.icon className="h-5 w-5" />
              <span className="text-xs">{link.label}</span>
            </Button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Standings */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Standings</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/league/standings")} className="gap-1">
                  Full Table <ChevronRight className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">#</th>
                      <th className="p-3 text-left font-medium">Team</th>
                      <th className="p-3 text-center font-medium">P</th>
                      <th className="p-3 text-center font-medium">W</th>
                      <th className="p-3 text-center font-medium">D</th>
                      <th className="p-3 text-center font-medium">L</th>
                      <th className="p-3 text-center font-medium">GD</th>
                      <th className="p-3 text-center font-medium">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingsList.slice(0, 6).map((s) => (
                      <tr key={s.id} className="border-t transition-colors hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/league/teams/${s.team.slug}`)}>
                        <td className="p-3 font-medium">{s.position}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <img src={s.team.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 rounded-full bg-muted" />
                            <span>{s.team.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">{s.played}</td>
                        <td className="p-3 text-center text-green-500">{s.wins}</td>
                        <td className="p-3 text-center text-yellow-500">{s.draws}</td>
                        <td className="p-3 text-center text-red-500">{s.losses}</td>
                        <td className="p-3 text-center">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                        <td className="p-3 text-center font-bold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Recent Fixtures */}
          <div>
            <Card>
              <CardHeader><CardTitle>Recent Matches</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {fixtureList.slice(0, 5).map((f) => (
                  <div key={f.id} className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/20" onClick={() => navigate(`/league/fixtures/${f.id}`)}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <img src={f.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-5 w-5 rounded-full bg-muted" />
                        <span className="text-xs">{f.homeTeam.shortName || f.homeTeam.name}</span>
                      </div>
                      <Badge variant="secondary" className={getMatchStatusColor(f.status)}>
                        {f.status === "COMPLETED" ? `${f.homeScore} - ${f.awayScore}` : f.status}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{f.awayTeam.shortName || f.awayTeam.name}</span>
                        <img src={f.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-5 w-5 rounded-full bg-muted" />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(f.matchDate)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Teams */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold">Teams</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {teamList.map((team) => (
              <Card key={team.id} className="cursor-pointer text-center transition-all hover:shadow-md" onClick={() => navigate(`/league/teams/${team.slug}`)}>
                <CardContent className="p-4">
                  <img src={team.logoUrl || "/placeholder.svg"} alt="" className="mx-auto h-12 w-12 rounded-full bg-muted" />
                  <p className="mt-2 text-sm font-medium">{team.shortName || team.name}</p>
                  <p className="text-xs text-muted-foreground">{team.city}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
