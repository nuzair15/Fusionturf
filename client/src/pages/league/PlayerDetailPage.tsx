import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Player } from "@/types";
import { ChevronLeft, MapPin, Ruler, Weight, Award, Footprints } from "lucide-react";

export function PlayerDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: player, isLoading } = useQuery({
    queryKey: ["player", slug],
    queryFn: () => api.get<Player>(`/league/players/${slug}`),
    enabled: !!slug,
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  if (!player) return null;

  const stats = player.homeStats?.[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-white">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <img src={player.photoUrl || "/placeholder.svg"} alt="" className="h-32 w-32 rounded-2xl bg-white/10 object-cover" />
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold">{player.firstName} {player.lastName}</h1>
              <p className="mt-1 text-white/80">{player.position} • #{player.jerseyNumber}</p>
              {player.team && (
                <p className="text-white/60">{player.team.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Biography */}
            {player.biography && (
              <Card>
                <CardHeader><CardTitle>Biography</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">{player.biography}</p></CardContent>
              </Card>
            )}

            {/* Season Stats */}
            {stats && (
              <Card>
                <CardHeader><CardTitle>Season Statistics</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "Appearances", value: stats.appearances },
                      { label: "Goals", value: stats.goals, color: "text-green-500" },
                      { label: "Assists", value: stats.assists, color: "text-blue-500" },
                      { label: "Minutes", value: stats.minutesPlayed },
                      { label: "Pass Accuracy", value: stats.passAccuracy ? `${stats.passAccuracy}%` : "-" },
                      { label: "Shots", value: stats.shots },
                      { label: "Tackles", value: stats.tackles },
                      { label: "Interceptions", value: stats.interceptions },
                      { label: "Yellow Cards", value: stats.yellowCards, color: "text-yellow-500" },
                      { label: "Red Cards", value: stats.redCards, color: "text-red-500" },
                      { label: "Rating", value: stats.averageRating?.toFixed(1) || "-" },
                      { label: "Clean Sheets", value: stats.cleanSheets ?? "-" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border p-3 text-center">
                        <p className={`text-lg font-bold ${s.color || ""}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full Stats */}
            {stats && (
              <Card>
                <CardHeader><CardTitle>Detailed Statistics</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {[
                      { label: "Shots on Target", value: stats.shotsOnTarget },
                      { label: "Fouls", value: stats.fouls },
                      { label: "Offsides", value: stats.offsides },
                      { label: "Saves", value: stats.saves ?? "-" },
                      { label: "Goals Conceded", value: stats.goalsConceded ?? "-" },
                      { label: "Distance Covered", value: stats.distanceCovered ? `${stats.distanceCovered}km` : "-" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border p-3 text-center">
                        <p className="text-lg font-bold">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Awards */}
            {player.awards && player.awards.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Awards</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {player.awards.map((aw, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border p-3">
                        <Award className="h-5 w-5 text-yellow-500" />
                        <span className="text-sm font-medium">{aw.award.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info Sidebar */}
          <div>
            <Card>
              <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Nationality</span><span>{player.nationality}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span>{player.age}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Height</span><span>{player.height} cm</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Weight</span><span>{player.weight} kg</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Preferred Foot</span><span>{player.preferredFoot}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Position</span><span className="font-medium">{player.position}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Jersey #</span><span className="font-medium">{player.jerseyNumber}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
