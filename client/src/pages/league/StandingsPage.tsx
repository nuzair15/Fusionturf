import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Standing, Season } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LeagueHero, LeagueCard, LeagueEmptyState } from "@/components/league/LeagueUI";

export function StandingsPage() {
  const navigate = useNavigate();

  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false });
  const { data: standings } = useQuery({ queryKey: ["standings-full"], queryFn: () => api.get<Standing[]>("/league/standings") });

  const list = standings || [];
  const topThree = list.slice(0, 3);

  const getRowTone = (position: number) => {
    if (position === 1) return "border-emerald-500/40 bg-emerald-500/5";
    if (position === 2) return "border-sky-500/40 bg-sky-500/5";
    if (position === 3) return "border-amber-500/40 bg-amber-500/5";
    return "";
  };

  const getChangeIcon = (position: number) => {
    if (position <= 3) return <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />;
    if (position >= list.length - 2) return <ArrowDown className="h-3.5 w-3.5 text-rose-600" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>
        <LeagueHero
          eyebrow="Table view"
          title="League Standings"
          subtitle={currentSeason?.name || "Current season"}
          stats={[
            { label: "Teams", value: list.length || 0 },
            { label: "Leader", value: list[0]?.team?.name || "TBD" },
            { label: "Points", value: list[0]?.points || 0 },
            { label: "Form", value: list[0]?.form || "-----" },
          ]}
        />
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 xl:grid-cols-[1.05fr_0.95fr]">
        <LeagueCard title="Top three" action={<Badge variant="secondary" className="rounded-full">Promotion zone</Badge>}>
          {topThree.length > 0 ? (
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {topThree.map((row) => (
                <button
                  key={row.id}
                  onClick={() => navigate(`/league/teams/${row.team.slug}`)}
                  className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${getRowTone(row.position)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">#{row.position}</span>
                    {getChangeIcon(row.position)}
                  </div>
                  <img src={row.team.logoUrl || "/placeholder.svg"} alt="" className="mt-4 h-14 w-14 rounded-full bg-muted object-cover" />
                  <p className="mt-3 text-base font-semibold">{row.team.name}</p>
                  <p className="text-xs text-muted-foreground">{row.played} played • {row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference} GD</p>
                  <p className="mt-3 text-2xl font-bold">{row.points} pts</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <LeagueEmptyState title="No standings yet" description="Standings will populate once match results are available." />
            </div>
          )}
        </LeagueCard>

        <LeagueCard title="Full table">
          {list.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/70 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left">Team</th>
                      <th className="p-3 text-center">P</th>
                      <th className="p-3 text-center">W</th>
                      <th className="p-3 text-center">D</th>
                      <th className="p-3 text-center">L</th>
                      <th className="p-3 text-center">GF</th>
                      <th className="p-3 text-center">GA</th>
                      <th className="p-3 text-center">GD</th>
                      <th className="p-3 text-center">Pts</th>
                      <th className="p-3 text-center">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => (
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
                        <td className="p-3 text-center text-emerald-600">{row.wins}</td>
                        <td className="p-3 text-center text-amber-600">{row.draws}</td>
                        <td className="p-3 text-center text-rose-600">{row.losses}</td>
                        <td className="p-3 text-center">{row.goalsFor}</td>
                        <td className="p-3 text-center">{row.goalsAgainst}</td>
                        <td className="p-3 text-center font-medium">{row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                        <td className="p-3 text-center font-bold">{row.points}</td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-0.5">
                            {row.form?.split("").map((result, i) => (
                              <span
                                key={i}
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-medium text-white ${
                                  result === "W" ? "bg-emerald-500" : result === "D" ? "bg-amber-500" : "bg-rose-500"
                                }`}
                              >
                                {result}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {list.map((row) => (
                  <button key={row.id} onClick={() => navigate(`/league/teams/${row.team.slug}`)} className="rounded-2xl border p-4 text-left transition hover:bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">#{row.position}</span>
                      <img src={row.team.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{row.team.name}</p>
                        <p className="text-xs text-muted-foreground">{row.played} played • {row.points} pts</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        ["W", row.wins],
                        ["D", row.draws],
                        ["L", row.losses],
                        ["GD", row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-xl bg-secondary/60 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="font-semibold">{value as string | number}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {row.form?.split("").map((result, i) => (
                        <span key={i} className={`inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-medium text-white ${result === "W" ? "bg-emerald-500" : result === "D" ? "bg-amber-500" : "bg-rose-500"}`}>
                          {result}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </LeagueCard>
      </div>
    </div>
  );
}
