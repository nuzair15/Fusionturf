import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatMatchClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MatchTimer({ running, seconds, onTogglePause, onReset }: {
  running: boolean;
  seconds: number;
  onTogglePause: () => void;
  onReset: () => void;
}) {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);
  useEffect(() => setDisplaySeconds(seconds), [seconds]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setDisplaySeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const isHalfTime = mins === 45;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Clock</span>
        <motion.span
          key={displaySeconds}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          className={cn(
            "text-2xl font-black tabular-nums tracking-tight sm:text-3xl",
            running && "text-emerald-600"
          )}
        >
          {mins}
          {isHalfTime ? "+" : "'"}
          {isHalfTime ? "00" : secs.toString().padStart(2, "0")}
        </motion.span>
      </div>
      <div className="flex flex-col gap-1">
        <button
          onClick={onTogglePause}
          aria-label={running ? "Pause timer" : "Start timer"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20 active:scale-95"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={onReset}
          aria-label="Reset timer"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
