import { memo, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FixtureLineupPlayer } from "@/types/lineup";
import { LineupPlayer } from "./LineupPlayer";

export interface FootballPitchProps {
  homePlayers: FixtureLineupPlayer[];
  awayPlayers: FixtureLineupPlayer[];
  /** Render-only (fixture page). */
  readonly?: boolean;
  /** Allow dragging players to reposition them. */
  editable?: boolean;
  /** Called while dragging (only when editable). */
  onPlayerMove?: (player: FixtureLineupPlayer, x: number, y: number) => void;
  onPlayerTap?: (player: FixtureLineupPlayer) => void;
  selectedPlayerId?: string | null;
  homeColor?: string;
  awayColor?: string;
  className?: string;
  /** Show player names under the badges (default true). */
  showLabels?: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const FootballPitch = memo(function FootballPitch({
  homePlayers,
  awayPlayers,
  readonly = true,
  editable = false,
  onPlayerMove,
  onPlayerTap,
  selectedPlayerId,
  homeColor = "#22c55e",
  awayColor = "#38bdf8",
  className,
  showLabels = true,
}: FootballPitchProps) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const rect = pitchRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0 || !draggingRef.current || !onPlayerMove) return;
      const x = clamp(((clientX - rect.left) / rect.width) * 100);
      const y = clamp(((clientY - rect.top) / rect.height) * 100);
      const player = [...homePlayers, ...awayPlayers].find((p) => p.id === draggingRef.current);
      if (player) onPlayerMove(player, x, y);
    },
    [homePlayers, awayPlayers, onPlayerMove]
  );

  const handlePointerDown = useCallback(
    (player: FixtureLineupPlayer) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!editable || !onPlayerMove) return;
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = player.id;
      setDraggingId(player.id);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture unsupported */
      }
      updatePosition(e.clientX, e.clientY);
    },
    [editable, onPlayerMove, updatePosition]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!editable || !draggingRef.current) return;
      updatePosition(e.clientX, e.clientY);
    },
    [editable, updatePosition]
  );

  const endDrag = useCallback(() => {
    draggingRef.current = null;
    setDraggingId(null);
  }, []);

  const handleKeyDown = useCallback(
    (player: FixtureLineupPlayer) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!editable || !onPlayerMove) return;
      const step = 2;
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      onPlayerMove(player, clamp(player.xPosition + move[0]), clamp(player.yPosition + move[1]));
    },
    [editable, onPlayerMove]
  );

  const renderPlayer = (player: FixtureLineupPlayer, color: string, side: "home" | "away") => (
    <div
      key={player.id}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${player.xPosition}%`,
        top: `${player.yPosition}%`,
        zIndex: draggingId === player.id ? 40 : side === "home" ? 20 : 10,
        touchAction: "none",
        cursor: draggingId === player.id ? "grabbing" : editable ? "grab" : "default",
      }}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : -1}
      aria-label={`${player.name}${editable ? ", use arrow keys to reposition" : ""}`}
      onPointerDown={handlePointerDown(player)}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown(player)}
      onClick={() => onPlayerTap?.(player)}
    >
      <LineupPlayer
        player={player}
        color={color}
        size={showLabels ? "md" : "sm"}
        active={draggingId === player.id || selectedPlayerId === player.id}
        ariaLabel={`${player.name}${editable ? ", drag to reposition" : ""}`}
      />
    </div>
  );

  return (
    <div
      ref={pitchRef}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-lg border border-emerald-900/40 shadow-inner",
        className
      )}
      style={{ aspectRatio: "68 / 105" }}
    >
      {/* Grass with alternating stripes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, #14532d 0px, #14532d 90px, #166534 90px, #166534 180px)",
        }}
      />

      {/* Touchline */}
      <div className="absolute inset-1.5 rounded-sm border-2 border-white/50" />
      {/* Halfway line */}
      <div className="absolute left-1.5 right-1.5 top-1/2 h-px bg-white/50" />
      {/* Centre circle */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50"
        style={{ width: "30%", aspectRatio: "1 / 1" }}
      />
      {/* Centre spot */}
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />

      {/* Penalty boxes */}
      <div className="absolute left-1/2 top-0 h-[14%] w-[52%] -translate-x-1/2 border-2 border-white/50 border-t-0" />
      <div className="absolute bottom-0 left-1/2 h-[14%] w-[52%] -translate-x-1/2 border-2 border-b-0 border-white/50" />
      {/* Goal areas */}
      <div className="absolute left-1/2 top-0 h-[6%] w-[30%] -translate-x-1/2 border-2 border-white/50 border-t-0" />
      <div className="absolute bottom-0 left-1/2 h-[6%] w-[30%] -translate-x-1/2 border-2 border-b-0 border-white/50" />
      {/* Penalty spots */}
      <div className="absolute left-1/2 top-[10%] h-1 w-1 -translate-x-1/2 rounded-full bg-white/80" />
      <div className="absolute bottom-[10%] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/80" />

      {/* Goals */}
      <div className="absolute left-1/2 top-0 h-[2%] w-[16%] -translate-x-1/2 border-2 border-b-0 border-white/70" />
      <div className="absolute bottom-0 left-1/2 h-[2%] w-[16%] -translate-x-1/2 border-2 border-t-0 border-white/70" />

      {/* Players: away defends the top, home defends the bottom */}
      {awayPlayers.map((p) => renderPlayer(p, awayColor, "away"))}
      {homePlayers.map((p) => renderPlayer(p, homeColor, "home"))}
    </div>
  );
});
