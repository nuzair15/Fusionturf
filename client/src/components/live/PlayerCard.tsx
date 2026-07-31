import { memo } from "react";
import { Crown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LivePlayer } from "@/types/live";
import { getInitials } from "@/lib/utils";

export const PlayerCard = memo(function PlayerCard({ player, isCaptain, isGoalkeeper, subbedOff, onSelect, onDecrement, onIncrement, disabled }: {
  player: LivePlayer;
  isCaptain?: boolean;
  isGoalkeeper?: boolean;
  subbedOff?: boolean;
  onSelect?: () => void;
  onDecrement?: (statType: "assist" | "yellowCard" | "redCard") => void;
  onIncrement?: (statType: "assist" | "yellowCard" | "redCard") => void;
  disabled?: boolean;
}) {
  const initials = getInitials(player.firstName, player.lastName);

  const stepperBtn = "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black transition active:scale-90 disabled:opacity-25";
  const stats = player.stats;

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left transition-all",
        onSelect ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]" : "",
        subbedOff && "opacity-45 saturate-0",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {subbedOff && <span className="absolute -left-0.5 top-0 h-full w-1 rounded-full bg-muted" />}
      <div className="relative shrink-0">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.firstName} className="h-10 w-10 rounded-full bg-muted object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20 text-xs font-bold text-emerald-700">
            {initials}
          </div>
        )}
        {isCaptain && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] text-black shadow" title="Captain">
            <Crown className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="w-6 text-xs font-black text-muted-foreground">{player.jerseyNumber ?? "—"}</span>
          <p className="truncate text-sm font-semibold leading-tight">{player.firstName} {player.lastName}</p>
          {isGoalkeeper && <Shield className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
        </div>
        <div className="flex items-center gap-2 pl-7 text-[11px] text-muted-foreground">
          <span>{player.position || "—"}</span>
          <span className="flex items-center gap-1"><span className="font-bold text-emerald-600">{stats.goals}</span>G</span>
          <span className="flex items-center gap-1"><span className="font-bold text-blue-500">{stats.assists}</span>A</span>
          <span className="flex items-center gap-0.5">
            <span className={cn("h-2.5 w-1.5 rounded-[1px]", stats.yellowCards > 0 ? "bg-amber-400" : "bg-muted")} />
            {stats.yellowCards}
          </span>
          <span className="flex items-center gap-0.5">
            <span className={cn("h-2.5 w-1.5 rounded-[1px]", stats.redCards > 0 ? "bg-red-500" : "bg-muted")} />
            {stats.redCards}
          </span>
        </div>
      </div>
      {(onDecrement || onIncrement) && (
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            <button aria-label={`Decrease assists for ${player.firstName}`} className={cn(stepperBtn, "bg-blue-500/10 text-blue-600")}
              onClick={(e) => { e.stopPropagation(); if (stats.assists > 0) onDecrement?.("assist"); }}>−</button>
            <span className="w-4 text-center text-xs font-bold text-blue-600">{stats.assists}</span>
            <button aria-label={`Increase assists for ${player.firstName}`} className={cn(stepperBtn, "bg-blue-500/10 text-blue-600")}
              onClick={(e) => { e.stopPropagation(); onIncrement?.("assist"); }}>+</button>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label={`Decrease yellow cards for ${player.firstName}`} className={cn(stepperBtn, "bg-amber-500/10 text-amber-600")}
              onClick={(e) => { e.stopPropagation(); if (stats.yellowCards > 0) onDecrement?.("yellowCard"); }}>−</button>
            <span className="w-4 text-center text-xs font-bold text-amber-600">{stats.yellowCards}</span>
            <button aria-label={`Increase yellow cards for ${player.firstName}`} className={cn(stepperBtn, "bg-amber-500/10 text-amber-600")}
              onClick={(e) => { e.stopPropagation(); onIncrement?.("yellowCard"); }}>+</button>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label={`Decrease red cards for ${player.firstName}`} className={cn(stepperBtn, "bg-red-500/10 text-red-600")}
              onClick={(e) => { e.stopPropagation(); if (stats.redCards > 0) onDecrement?.("redCard"); }}>−</button>
            <span className="w-4 text-center text-xs font-bold text-red-600">{stats.redCards}</span>
            <button aria-label={`Increase red cards for ${player.firstName}`} className={cn(stepperBtn, "bg-red-500/10 text-red-600")}
              onClick={(e) => { e.stopPropagation(); onIncrement?.("redCard"); }}>+</button>
          </div>
        </div>
      )}
    </div>
  );
});
