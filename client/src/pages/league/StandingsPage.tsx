import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Standing } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export function StandingsPage() {
  const navigate = useNavigate();

  const { data: standings } = useQuery({
    queryKey: ["standings-full"],
    queryFn: () => api.get<Standing[]>("/league/standings"),
  });

  const list = standings || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>
        <h1 className="mb-2 text-3xl font-bold">League Standings</h1>
        <p className="mb-8 text-muted-foreground">Season 2025-2026</p>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left font-medium sm:p-4">#</th>
                    <th className="p-2 text-left font-medium sm:p-4">Team</th>
                    <th className="p-2 text-center font-medium sm:p-4">P</th>
                    <th className="p-2 text-center font-medium sm:p-4">W</th>
                    <th className="p-2 text-center font-medium sm:p-4">D</th>
                    <th className="p-2 text-center font-medium sm:p-4">L</th>
                    <th className="hidden p-2 text-center font-medium sm:table-cell sm:p-4">GF</th>
                    <th className="hidden p-2 text-center font-medium sm:table-cell sm:p-4">GA</th>
                    <th className="p-2 text-center font-medium sm:p-4">GD</th>
                    <th className="p-2 text-center font-medium sm:p-4">Pts</th>
                    <th className="hidden p-2 text-center font-medium sm:table-cell sm:p-4">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t transition-colors hover:bg-muted/20 cursor-pointer"
                      onClick={() => navigate(`/league/teams/${s.team.slug}`)}
                    >
                      <td className="p-2 font-medium sm:p-4">{s.position}</td>
                      <td className="p-2 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <img src={s.team.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 shrink-0 rounded-full bg-muted sm:h-8 sm:w-8" />
                          <div>
                            <p className="text-xs font-medium sm:text-sm">{s.team.shortName || s.team.name}</p>
                            <p className="hidden text-xs text-muted-foreground sm:block">{s.team.shortName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-center text-xs sm:p-4 sm:text-sm">{s.played}</td>
                      <td className="p-2 text-center text-xs text-green-500 sm:p-4 sm:text-sm">{s.wins}</td>
                      <td className="p-2 text-center text-xs text-yellow-500 sm:p-4 sm:text-sm">{s.draws}</td>
                      <td className="p-2 text-center text-xs text-red-500 sm:p-4 sm:text-sm">{s.losses}</td>
                      <td className="hidden p-2 text-center text-xs sm:table-cell sm:p-4 sm:text-sm">{s.goalsFor}</td>
                      <td className="hidden p-2 text-center text-xs sm:table-cell sm:p-4 sm:text-sm">{s.goalsAgainst}</td>
                      <td className="p-2 text-center text-xs font-medium sm:p-4 sm:text-sm">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                      <td className="p-2 text-center text-xs font-bold sm:p-4 sm:text-lg">{s.points}</td>
                      <td className="hidden p-2 text-center sm:table-cell sm:p-4">
                        <div className="flex justify-center gap-0.5">
                          {s.form?.split("").map((r, i) => (
                            <span
                              key={i}
                              className={`inline-block h-4 w-4 rounded-sm text-[10px] leading-4 text-white font-medium sm:h-5 sm:w-5 sm:text-xs sm:leading-5 ${
                                r === "W" ? "bg-green-500" : r === "D" ? "bg-yellow-500" : "bg-red-500"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
      </motion.div>
    </div>
  );
}
