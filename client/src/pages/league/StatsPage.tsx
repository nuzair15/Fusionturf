import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { PlayerStat } from "@/types";
import { Trophy, Target, Shield, Zap, Eye, Swords, Award, Star, ChevronLeft } from "lucide-react";

const statCategories = [
  { key: "goals", label: "Top Scorers", icon: Trophy, color: "text-yellow-500" },
  { key: "assists", label: "Top Assists", icon: Target, color: "text-blue-500" },
  { key: "motm", label: "Man of the Match", icon: Star, color: "text-amber-500" },
  { key: "cleanSheets", label: "Clean Sheets", icon: Shield, color: "text-green-500" },
  { key: "saves", label: "Most Saves", icon: Eye, color: "text-purple-500" },
  { key: "appearances", label: "Most Appearances", icon: Award, color: "text-orange-500" },
  { key: "passAccuracy", label: "Pass Accuracy", icon: Zap, color: "text-cyan-500" },
  { key: "tackles", label: "Most Tackles", icon: Swords, color: "text-red-500" },
  { key: "yellowCards", label: "Yellow Cards", icon: Zap, color: "text-yellow-500" },
  { key: "rating", label: "Average Rating", icon: Award, color: "text-primary" },
];

export function StatsPage() {
  const navigate = useNavigate();
  const [activeStat, setActiveStat] = useState("goals");
  const [friendly, setFriendly] = useState(false);

  const { data } = useQuery({
    queryKey: ["player-stats", activeStat, friendly],
    queryFn: () => api.get<PlayerStat[]>("/league/stats/players", { stat: activeStat, friendly: friendly ? "true" : "false" }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const stats = data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>
        <h1 className="mb-2 text-3xl font-bold">Statistics</h1>
        <p className="mb-8 text-muted-foreground">League-wide player statistics and rankings</p>
        <div className="mb-5 flex items-center gap-2 text-sm">
          <input id="friendly-stats" type="checkbox" checked={friendly} onChange={(e) => setFriendly(e.target.checked)} />
          <label htmlFor="friendly-stats">Show friendly-match stats</label>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {statCategories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveStat(cat.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                activeStat === cat.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <cat.icon className="h-4 w-4" /> {cat.label}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{statCategories.find((c) => c.key === activeStat)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No data available</p>
              ) : (
                stats.map((s, i) => {
                  const cat = statCategories.find((c) => c.key === activeStat);
                  const value = activeStat === "motm"
                    ? ((s as any).manOfTheMatch ?? 0)
                    : (s[activeStat as keyof PlayerStat] as number | undefined ?? 0);
                  return (
                    <div key={s.id} className="flex items-center gap-4 rounded-lg border p-3">
                      <span className={`w-6 text-center text-lg font-bold ${i < 3 ? cat?.color : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <img src={s.player?.photoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.player?.firstName} {s.player?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{s.team?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{typeof value === "number" ? (value % 1 === 0 ? value : value.toFixed(1)) : value}</p>
                        <p className="text-xs text-muted-foreground">{s.appearances} apps</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
