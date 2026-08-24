import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { PlayerStat } from "@/types";
import { ChevronLeft, Shield, Star, Target, Trophy, Users } from "lucide-react";
import { PlayerLeaderboard } from "@/components/league/PlayerLeaderboard";

const categories = [
  { key: "goals", label: "Scorers", icon: Trophy },
  { key: "assists", label: "Assists", icon: Target },
  { key: "rating", label: "Ratings", icon: Star },
  { key: "appearances", label: "Appearances", icon: Users },
  { key: "cleanSheets", label: "Clean sheets", icon: Shield },
] as const;

export function StatsPage() {
  const navigate = useNavigate();
  const [activeStat, setActiveStat] = useState<typeof categories[number]["key"]>("goals");
  const [friendly, setFriendly] = useState(false);
  const { data } = useQuery({ queryKey: ["player-stats", activeStat, friendly], queryFn: () => api.get<PlayerStat[]>("/league/stats/players", { stat: activeStat, friendly: String(friendly) }), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000 });
  const category = categories.find((item) => item.key === activeStat)!;

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8"><motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
    <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 -ml-2 gap-1"><ChevronLeft className="h-4 w-4" /> League overview</Button>
    <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-5 py-6 text-white shadow-lg sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">Fusion League</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Player leaders</h1><p className="mt-1 text-sm text-slate-300">The season’s leading performers, updated from completed matches.</p></div><label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm"><input type="checkbox" checked={friendly} onChange={(event) => setFriendly(event.target.checked)} /><span>Friendlies</span></label></div></section>
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{categories.map((item) => <button key={item.key} onClick={() => setActiveStat(item.key)} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${activeStat === item.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}><item.icon className="h-4 w-4" />{item.label}</button>)}</div>
    <section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4"><div className="rounded-xl bg-primary/10 p-2 text-primary"><category.icon className="h-5 w-5" /></div><div><h2 className="font-bold">{category.label}</h2><p className="text-sm text-muted-foreground">Ranked by {category.label.toLowerCase()}</p></div></div><div className="p-3 sm:p-4"><PlayerLeaderboard rows={data || []} stat={activeStat} /></div></section>
  </motion.div></div>;
}
