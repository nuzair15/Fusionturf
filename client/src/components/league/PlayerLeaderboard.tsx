import type { PlayerStat } from "@/types";
import { cn } from "@/lib/utils";

type LeaderboardStat = "goals" | "assists" | "appearances" | "cleanSheets" | "saves" | "passAccuracy" | "tackles" | "yellowCards" | "rating" | "motm";

const labels: Record<LeaderboardStat, string> = { goals: "Goals", assists: "Assists", appearances: "Apps", cleanSheets: "Clean sheets", saves: "Saves", passAccuracy: "Pass %", tackles: "Tackles", yellowCards: "Yellow cards", rating: "Rating", motm: "MOTM" };

function statValue(row: PlayerStat, stat: LeaderboardStat) {
  if (stat === "motm") return (row as any).manOfTheMatch || 0;
  if (stat === "rating") return row.averageRating ? row.averageRating.toFixed(1) : "—";
  if (stat === "passAccuracy") return row.passAccuracy === null || row.passAccuracy === undefined ? "—" : `${row.passAccuracy}%`;
  return row[stat as keyof PlayerStat] ?? 0;
}

export function PlayerLeaderboard({ rows, stat, onPlayerClick, compact = false, className }: { rows: PlayerStat[]; stat: LeaderboardStat; onPlayerClick?: (row: PlayerStat) => void; compact?: boolean; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl bg-[#202228] text-white shadow-sm", className)}>
    <div className="grid grid-cols-[32px_1fr_auto] items-center border-b border-white/15 px-3 py-2 text-[10px] font-medium text-slate-300 sm:px-4 sm:text-xs"><span>#</span><span>Player</span><span>{labels[stat]}</span></div>
    {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-300">No player statistics yet.</p> : rows.slice(0, compact ? 5 : 50).map((row, index) => <button key={row.id} onClick={() => onPlayerClick?.(row)} disabled={!onPlayerClick} className={cn("grid w-full grid-cols-[32px_1fr_auto] items-center gap-2 border-b border-white/15 px-3 py-2.5 text-left last:border-0 sm:px-4 sm:py-3", onPlayerClick && "transition hover:bg-white/5") }>
      <span className={cn("text-center text-sm font-bold", index === 0 ? "text-amber-400" : index === 1 ? "text-slate-300" : index === 2 ? "text-amber-700" : "text-slate-400")}>{index + 1}</span>
      <span className="flex min-w-0 items-center gap-2"><img src={row.player?.photoUrl || "/placeholder.svg"} alt="" className="h-7 w-7 shrink-0 rounded-full bg-slate-700 object-cover sm:h-8 sm:w-8" /><span className="min-w-0"><span className="block truncate text-xs font-semibold sm:text-sm">{row.player?.firstName} {row.player?.lastName}</span><span className="block truncate text-[10px] text-slate-400 sm:text-xs">{row.team?.name || "Team"} · {row.appearances || 0} apps</span></span></span>
      <span className="text-right text-lg font-black tabular-nums sm:text-xl">{statValue(row, stat)}</span>
    </button>)}
  </div>;
}
