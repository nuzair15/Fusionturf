import { memo } from "react";
import { cn, getInitials } from "@/lib/utils";
import type { FixtureLineupPlayer } from "@/types/lineup";

export interface BenchPlayersProps {
  players: FixtureLineupPlayer[];
  color: string;
  className?: string;
}

export const BenchPlayers = memo(function BenchPlayers({ players, color, className }: BenchPlayersProps) {
  if (players.length === 0) return null;

  return (
    <div className={cn("rounded-lg border bg-muted/40 p-2", className)}>
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Bench · {players.length}
      </p>
      <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {players.map((p) => {
          const parts = p.name.split(" ").filter(Boolean);
          const initials = getInitials(parts[0] || "", parts[1] || "");
          return (
            <li key={p.id} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[9px] font-bold"
                style={{ borderColor: color, backgroundColor: p.avatar ? "#0b1220" : `${color}22`, color }}
              >
                {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : initials}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-muted-foreground">{p.jerseyNumber ?? ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
