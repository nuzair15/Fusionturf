import { memo, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import type { LiveFixtureInfo } from "@/types/live";
import { cn } from "@/lib/utils";

interface StatRow { key: string; label: string; home: number; away: number; suffix?: string }

function StatBar({ home, away, suffix }: { home: number; away: number; suffix?: string }) {
  const total = home + away;
  const homePct = total === 0 ? 50 : Math.round((home / total) * 100);
  const display = (value: number) => suffix === "%" ? `${value}%` : String(value);
  return <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="text-right text-sm font-bold tabular-nums">{display(home)}</div><div className="relative h-2.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted"><div className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${homePct}%` }} /><div className="absolute right-0 top-0 h-full rounded-full bg-blue-500 transition-all" style={{ width: `${100 - homePct}%` }} /></div><div className="text-sm font-bold tabular-nums">{display(away)}</div></div>;
}

export const StatisticsPanel = memo(function StatisticsPanel({ fixture, onUpdate, homeColor = "text-emerald-600" }: { fixture: LiveFixtureInfo; onUpdate?: (field: string, delta: number) => void; homeColor?: string }) {
  const rows: StatRow[] = [
    { key: "Possession", label: "Possession", home: fixture.homePossession ?? 0, away: fixture.awayPossession ?? 0, suffix: "%" },
    { key: "Shots", label: "Shots", home: fixture.homeShots ?? 0, away: fixture.awayShots ?? 0 },
    { key: "ShotsOnTarget", label: "Shots on target", home: fixture.homeShotsOnTarget ?? 0, away: fixture.awayShotsOnTarget ?? 0 },
    { key: "Corners", label: "Corners", home: fixture.homeCorners ?? 0, away: fixture.awayCorners ?? 0 },
    { key: "Fouls", label: "Fouls", home: fixture.homeFouls ?? 0, away: fixture.awayFouls ?? 0 },
    { key: "ExpectedGoals", label: "Expected goals", home: fixture.homeExpectedGoals ?? 0, away: fixture.awayExpectedGoals ?? 0 },
  ];
  const bump = useCallback((team: "home" | "away", key: string, delta: number) => onUpdate?.(`${team}${key}`, delta), [onUpdate]);
  const stepper = "flex h-6 w-6 items-center justify-center rounded-full text-xs font-black transition active:scale-90 disabled:opacity-25";

  return <div className="rounded-xl border bg-card/40 p-3">
    <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Team statistics</p>
    <div className="mb-2 grid grid-cols-3 text-[11px] font-semibold text-muted-foreground"><span className={homeColor}>Home</span><span className="text-center">Stat</span><span className="text-right text-blue-600">Away</span></div>
    <div className="flex flex-col gap-3">{rows.map((row) => <div key={row.key}>
      <div className="mb-1 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1">
        <div className="flex items-center gap-1"><button aria-label={`Decrease home ${row.label}`} onClick={() => bump("home", row.key, -1)} disabled={!onUpdate} className={cn(stepper, "bg-emerald-500/10 text-emerald-600")}>-</button><button aria-label={`Increase home ${row.label}`} onClick={() => bump("home", row.key, 1)} disabled={!onUpdate} className={cn(stepper, "bg-emerald-500/10 text-emerald-600")}>+</button></div>
        <span className="text-center text-[11px] font-medium text-muted-foreground">{row.label}</span>
        <div className="flex items-center gap-1"><button aria-label={`Decrease away ${row.label}`} onClick={() => bump("away", row.key, -1)} disabled={!onUpdate} className={cn(stepper, "bg-blue-500/10 text-blue-600")}>-</button><button aria-label={`Increase away ${row.label}`} onClick={() => bump("away", row.key, 1)} disabled={!onUpdate} className={cn(stepper, "bg-blue-500/10 text-blue-600")}>+</button></div>
      </div>
      <StatBar home={row.home} away={row.away} suffix={row.suffix} />
    </div>)}</div>
    <p className="mt-3 text-center text-[10px] text-muted-foreground">Changes save about 1.5 seconds after your last tap.</p>
  </div>;
});
