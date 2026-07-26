import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Standing } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <h1 className="mb-2 text-3xl font-bold">League Standings</h1>
        <p className="mb-8 text-muted-foreground">Season 2025-2026</p>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">#</th>
                  <th className="p-4 text-left font-medium">Team</th>
                  <th className="p-4 text-center font-medium">P</th>
                  <th className="p-4 text-center font-medium">W</th>
                  <th className="p-4 text-center font-medium">D</th>
                  <th className="p-4 text-center font-medium">L</th>
                  <th className="p-4 text-center font-medium">GF</th>
                  <th className="p-4 text-center font-medium">GA</th>
                  <th className="p-4 text-center font-medium">GD</th>
                  <th className="p-4 text-center font-medium">Pts</th>
                  <th className="p-4 text-center font-medium">Form</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t transition-colors hover:bg-muted/20 cursor-pointer"
                    onClick={() => navigate(`/league/teams/${s.team.slug}`)}
                  >
                    <td className="p-4 font-medium">{s.position}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={s.team.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted" />
                        <div>
                          <p className="font-medium">{s.team.name}</p>
                          <p className="text-xs text-muted-foreground">{s.team.shortName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">{s.played}</td>
                    <td className="p-4 text-center text-green-500">{s.wins}</td>
                    <td className="p-4 text-center text-yellow-500">{s.draws}</td>
                    <td className="p-4 text-center text-red-500">{s.losses}</td>
                    <td className="p-4 text-center">{s.goalsFor}</td>
                    <td className="p-4 text-center">{s.goalsAgainst}</td>
                    <td className="p-4 text-center font-medium">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                    <td className="p-4 text-center font-bold text-lg">{s.points}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-0.5">
                        {s.form?.split("").map((r, i) => (
                          <span
                            key={i}
                            className={`inline-block h-5 w-5 rounded-sm text-xs leading-5 text-white font-medium ${
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
