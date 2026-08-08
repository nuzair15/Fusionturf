import { Trophy, CalendarClock, MapPin, X, Minus, Plus } from "lucide-react";
import type { LiveMatchData } from "@/types/live";
import { Scoreboard } from "./Scoreboard";
import { MatchTimer } from "./MatchTimer";
import { formatDate, formatTime } from "@/lib/utils";

export function MatchHeader({ data, minute, onMinuteChange, onClose, onTogglePause, onResetTimer, timerRunning, clockSeconds }: {
  data: LiveMatchData;
  minute: number;
  onMinuteChange: (m: number) => void;
  onClose: () => void;
  onTogglePause: () => void;
  onResetTimer: () => void;
  timerRunning: boolean;
  clockSeconds: number;
}) {
  const { fixture, homeTeam, awayTeam } = data;
  const competition = (fixture as any).competition?.name;

  return (
    <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-4 text-white shadow-lg sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-100/90">
            <Trophy className="h-3.5 w-3.5" />
            {competition || "League"}
            {(fixture as any).round != null && <span className="rounded bg-white/10 px-1.5 py-0.5">Round {(fixture as any).round}</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-100/70">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(fixture.matchDate)} {fixture.kickoffTime ? `• ${formatTime(fixture.kickoffTime)}` : ""}
            {(fixture as any).stadium && (
              <span className="hidden items-center gap-1 sm:flex"><MapPin className="h-3.5 w-3.5" />{(fixture as any).stadium}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close match center"
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4 flex flex-col items-center gap-4">
        <Scoreboard
          fixture={fixture}
          homeName={homeTeam.shortName || homeTeam.name}
          awayName={awayTeam.shortName || awayTeam.name}
          homeLogo={homeTeam.logoUrl}
          awayLogo={awayTeam.logoUrl}
        />
        <div className="flex items-center gap-3">
          <MatchTimer seconds={clockSeconds} running={timerRunning} onTogglePause={onTogglePause} onReset={onResetTimer} />
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5">
            <button aria-label="Decrease minute" onClick={() => onMinuteChange(Math.max(0, minute - 1))} className="flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:bg-white/20 active:scale-90">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-10 text-center text-lg font-black tabular-nums text-white">
              {minute}<span className="text-xs text-emerald-200">'</span>
            </span>
            <button aria-label="Increase minute" onClick={() => onMinuteChange(Math.min(130, minute + 1))} className="flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:bg-white/20 active:scale-90">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
