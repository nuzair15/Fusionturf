import { motion } from "framer-motion";
import { FastForward, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/types";
import { matchPeriodClock } from "@/lib/matchClock";

export function formatMatchClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MatchTimer({ running, seconds, status, halfLengthMinutes = 30, onTogglePause, onReset, onSet }: {
  running: boolean;
  seconds: number;
  status: MatchStatus;
  halfLengthMinutes?: number;
  onTogglePause: () => void;
  onReset: () => void;
  onSet: () => void;
}) {
  // The server owns elapsed time; the parent interpolates between polls so the
  // display stays smooth while multiple operators remain synchronized.
  const period = matchPeriodClock(seconds, status, halfLengthMinutes);
  const mins = Math.floor(period.seconds / 60);
  const secs = period.seconds % 60;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-100/75">{period.label} · {halfLengthMinutes} MIN</span>
        <motion.span
          key={seconds}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          className={cn(
            "text-2xl font-black tabular-nums tracking-tight sm:text-3xl",
            running && "text-emerald-600"
          )}
        >
          {mins}:{secs.toString().padStart(2, "0")}
        </motion.span>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={onTogglePause}
          aria-label={running ? "Pause timer" : "Start timer"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary shadow-sm transition hover:bg-primary/25 active:scale-95"
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={onReset}
          aria-label="Reset timer"
          className="flex h-10 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onSet}
          aria-label="Set match clock"
          title="Jump to a specific match time"
          className="flex h-10 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent active:scale-95"
        >
          <FastForward className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
