import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Player } from "@/types";
import { ChevronLeft, MapPin, Ruler, Weight, Award, Footprints, Image as ImageIcon, Play } from "lucide-react";
import { FollowButton } from "@/components/league/FollowButton";

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

  const profileStats = (player as any).profileStats || [];
  const leagueStats = profileStats.filter((s: any) => s.competition === "LEAGUE");
  const statsBySeason = leagueStats.reduce((acc: Record<string, { season: any; team: any; stats: any[] }>, s: any) => {
    const key = `${s.season?.id || "unknown"}_${s.teamId}`;
    if (!acc[key]) {
      acc[key] = { season: s.season, team: s.team, stats: [] };
    }
    acc[key].stats.push(s);
    return acc;
  }, {});
  const seasonKeys = Object.keys(statsBySeason);
  const friendlyStats = profileStats.filter((s: any) => s.competition === "FRIENDLY");

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
              <div className="mt-3"><FollowButton type="PLAYER" entityId={player.id} /></div>
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

            {player.galleries && player.galleries.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Player Gallery</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {player.galleries.map((item) => (
                      <a key={item.id} href={item.videoUrl || item.imageUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border bg-muted/30">
                        <div className="relative aspect-square">
                          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                          {item.videoUrl && <span className="absolute inset-0 flex items-center justify-center bg-black/25"><Play className="h-8 w-8 fill-white text-white" /></span>}
                        </div>
                        <p className="truncate px-3 py-2 text-sm font-medium">{item.title}</p>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Season Stats by Season + Team */}
            {seasonKeys.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Career Statistics</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {seasonKeys.map((key) => {
                    const group = statsBySeason[key];
                    const seasonLabel = group.season?.name || "Unknown Season";
                    const team = group.team;
                    const s = group.stats[0];
                    return (
                      <div key={key}>
                        <div className="mb-3 flex items-center gap-2">
                          {team?.logoUrl && <img src={team.logoUrl} alt="" className="h-5 w-5 rounded-full" />}
                          <h3 className="text-sm font-semibold text-muted-foreground">{seasonLabel} — {team?.name || "Unknown Team"}</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            { label: "Appearances", value: s.appearances },
                            { label: "Goals", value: s.goals, color: "text-green-500" },
                            { label: "Assists", value: s.assists, color: "text-blue-500" },
                            { label: "Minutes", value: s.minutesPlayed },
                            { label: "Pass Accuracy", value: s.passAccuracy ? `${s.passAccuracy}%` : "-" },
                            { label: "Shots", value: s.shots },
                            { label: "Tackles", value: s.tackles },
                            { label: "Interceptions", value: s.interceptions },
                            { label: "Yellow Cards", value: s.yellowCards, color: "text-yellow-500" },
                            { label: "Red Cards", value: s.redCards, color: "text-red-500" },
                            { label: "Rating", value: s.averageRating?.toFixed(1) || "-" },
                            { label: "Clean Sheets", value: s.cleanSheets ?? "-" },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-lg border p-3 text-center">
                              <p className={`text-lg font-bold ${stat.color || ""}`}>{stat.value}</p>
                              <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                        {/* Detailed Stats */}
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {[
                            { label: "Shots on Target", value: s.shotsOnTarget },
                            { label: "Fouls", value: s.fouls },
                            { label: "Offsides", value: s.offsides },
                            { label: "Saves", value: s.saves ?? "-" },
                            { label: "Goals Conceded", value: s.goalsConceded ?? "-" },
                            { label: "Distance Covered", value: s.distanceCovered ? `${s.distanceCovered}km` : "-" },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-lg border p-3 text-center">
                              <p className="text-lg font-bold">{stat.value}</p>
                              <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {friendlyStats.length > 0 && <Card>
              <CardHeader><CardTitle>Friendly Statistics</CardTitle></CardHeader>
              <CardContent className="space-y-3">{friendlyStats.map((s: any) => <div key={s.id} className="rounded-xl border p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><span>{s.season?.name || "Friendly matches"}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{s.team?.name || "Team"}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Appearances", s.appearances], ["Goals", s.goals], ["Assists", s.assists], ["Minutes", s.minutesPlayed], ["Shots", s.shots], ["On target", s.shotsOnTarget], ["Yellow cards", s.yellowCards], ["Rating", s.averageRating?.toFixed?.(1) || "-"]].map(([label, value]) => <div key={label as string} className="rounded-lg bg-secondary/40 p-3 text-center"><p className="font-bold">{value as any}</p><p className="text-xs text-muted-foreground">{label as string}</p></div>)}</div></div>)}</CardContent>
            </Card>}

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
