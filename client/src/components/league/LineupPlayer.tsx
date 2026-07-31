import { memo } from "react";
import { cn, getInitials } from "@/lib/utils";
import type { FixtureLineupPlayer } from "@/types/lineup";

export interface LineupPlayerProps {
  player: FixtureLineupPlayer;
  /** Solid CSS color used for the circle ring / accents. */
  color: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  ariaLabel?: string;
}

export const LineupPlayer = memo(function LineupPlayer({
  player,
  color,
  size = "md",
  active = false,
  dimmed = false,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ariaLabel,
}: LineupPlayerProps) {
  const circleSize =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const nameSize = size === "sm" ? "text-[9px]" : "text-[11px]";
  const numSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  const parts = player.name.split(" ").filter(Boolean);
  const initials = getInitials(parts[0] || "", parts[1] || "");

  return (
    <div
      className="flex w-16 flex-col items-center gap-0.5"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      aria-label={ariaLabel || `${player.name}, ${player.role || "player"}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className={cn("relative", circleSize, dimmed && "opacity-40")}>
        {/* Circle */}
        <div
          className={cn(
            "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 shadow-lg",
            active && "ring-2 ring-amber-300"
          )}
          style={{
            backgroundColor: player.avatar ? "#0b1220" : `${color}26`,
            borderColor: color,
          }}
        >
          {player.avatar ? (
            <img src={player.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-bold" style={{ color }}>{initials}</span>
          )}
        </div>

        {/* Jersey number */}
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border px-0.5 font-bold",
            numSize,
            active ? "border-amber-300 bg-amber-400 text-amber-950" : "border-border bg-background text-foreground"
          )}
        >
          {player.jerseyNumber ?? "?"}
        </span>

        {/* Captain badge */}
        {player.isCaptain && (
          <span className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-amber-400 text-[9px] font-bold text-amber-950">
            C
          </span>
        )}

        {/* Goalkeeper badge */}
        {player.isGoalkeeper && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-white/40 bg-foreground/80 px-1 py-px text-[8px] font-bold tracking-wide text-background">
            GK
          </span>
        )}
      </div>
      <p className={cn("line-clamp-2 max-w-full text-center font-medium leading-tight text-foreground", nameSize)}>
        {player.name}
      </p>
    </div>
  );
});
