import { memo } from "react";
import { Crown, Shield } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { LivePlayer } from "@/types/live";

export const PlayerCard = memo(function PlayerCard({ player, isCaptain, isGoalkeeper, subbedOff, onSelect, onAppearance, disabled }: {
  player: LivePlayer;
  isCaptain?: boolean;
  isGoalkeeper?: boolean;
  subbedOff?: boolean;
  onSelect?: () => void;
  onAppearance?: () => void;
  disabled?: boolean;
}) {
  const initials = getInitials(player.firstName, player.lastName);
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
          <span className="w-6 text-xs font-black text-muted-foreground">{player.jerseyNumber ?? "-"}</span>
          <p className="truncate text-sm font-semibold leading-tight">{player.firstName} {player.lastName}</p>
          {isGoalkeeper && <Shield className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
        </div>
        <div className="flex items-center gap-2 pl-7 text-[11px] text-muted-foreground">
          <span>{player.position || "-"}</span>
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
      {onAppearance && <button type="button" onClick={(e) => { e.stopPropagation(); onAppearance(); }} className={cn("shrink-0 rounded-md px-1.5 py-1 text-[10px] font-semibold", player.appearance ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground")} title="Mark player appearance">{player.appearance ? "Played" : "Appear"}</button>}
    </div>
  );
});
