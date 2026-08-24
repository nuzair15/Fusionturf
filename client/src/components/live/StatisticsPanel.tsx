import { memo, useCallback, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { LiveFixtureInfo, LiveTeam, LivePlayer } from "@/types/live";
import { cn } from "@/lib/utils";

interface StatRow {
  key: string;
  label: string;
  home: number;
  away: number;
  suffix?: string;
}

function StatBar({ home, away, suffix }: { home: number; away: number; suffix?: string }) {
  const total = home + away;
  const homePct = total === 0 ? 50 : Math.round((home / total) * 100);
  const awayPct = 100 - homePct;
  const display = (v: number) => (suffix === "%" ? `${v}%` : String(v));

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="text-right text-sm font-bold tabular-nums">{display(home)}</div>
      <div className="relative h-2.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
        <div className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${homePct}%` }} />
        <div className="absolute right-0 top-0 h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${awayPct}%` }} />
      </div>
      <div className="text-sm font-bold tabular-nums">{display(away)}</div>
    </div>
  );
}

export const StatisticsPanel = memo(function StatisticsPanel({ fixture, homeTeam, awayTeam, onUpdate, onShot, homeColor = "text-emerald-600", awayColor = "text-blue-600" }: {
  fixture: LiveFixtureInfo;
  homeTeam: LiveTeam;
  awayTeam: LiveTeam;
  onUpdate?: (field: string, delta: number) => void;
  onShot?: (player: LivePlayer, teamId: string, outcome: "ON_TARGET" | "OFF_TARGET") => void;
  homeColor?: string;
  awayColor?: string;
}) {
  const [shotOutcome, setShotOutcome] = useState<"ON_TARGET" | "OFF_TARGET" | null>(null);
  const rows: StatRow[] = [
    { key: "Possession", label: "Possession", home: fixture.homePossession ?? 0, away: fixture.awayPossession ?? 0, suffix: "%" },
    { key: "Shots", label: "Shots", home: fixture.homeShots ?? 0, away: fixture.awayShots ?? 0 },
    { key: "ShotsOnTarget", label: "Shots on Target", home: fixture.homeShotsOnTarget ?? 0, away: fixture.awayShotsOnTarget ?? 0 },
    { key: "Corners", label: "Corners", home: fixture.homeCorners ?? 0, away: fixture.awayCorners ?? 0 },
    { key: "Fouls", label: "Fouls", home: fixture.homeFouls ?? 0, away: fixture.awayFouls ?? 0 },
    { key: "Offsides", label: "Offsides", home: fixture.homeOffsides ?? 0, away: fixture.awayOffsides ?? 0 },
    { key: "ExpectedGoals", label: "Expected Goals", home: fixture.homeExpectedGoals ?? 0, away: fixture.awayExpectedGoals ?? 0 },
  ];

  const bump = useCallback((prefix: string, key: string, delta: number) => {
    onUpdate?.(`${prefix}${key}`, delta);
  }, [onUpdate]);

  const stepper = "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black transition active:scale-90 disabled:opacity-25";

  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
        <BarChart3 className="h-4 w-4 text-muted-foreground" /> Statistics
      </p>
      <div className="flex items-center justify-between pb-1 text-[11px] font-semibold text-muted-foreground">
        <span className={homeColor}>Home</span>
        <span>Away</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-0.5 flex items-center justify-between px-1">
              <button
                aria-label={`Decrease home ${row.label}`}
                onClick={() => bump("home", row.key, -1)}
                disabled={!onUpdate}
                className={cn(stepper, "bg-emerald-500/10 text-emerald-600")}
              >−</button>
              <span className="text-[11px] font-medium text-muted-foreground">{row.label}</span>
              <button
                aria-label={`Increase away ${row.label}`}
                onClick={() => bump("away", row.key, 1)}
                disabled={!onUpdate}
                className={cn(stepper, "bg-blue-500/10 text-blue-600")}
              >+</button>
            </div>
            <StatBar home={row.home} away={row.away} suffix={row.suffix} />
          </div>
        ))}
      </div>
      {onShot && <div className="mt-4 border-t pt-3">
        <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Record shot — choose outcome, then player</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setShotOutcome("ON_TARGET")} className={cn("rounded-lg border px-2 py-2 text-xs font-semibold", shotOutcome === "ON_TARGET" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "bg-background")}>On target</button>
          <button type="button" onClick={() => setShotOutcome("OFF_TARGET")} className={cn("rounded-lg border px-2 py-2 text-xs font-semibold", shotOutcome === "OFF_TARGET" ? "border-amber-500 bg-amber-500/10 text-amber-700" : "bg-background")}>Off target</button>
        </div>
        {shotOutcome && <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
          {[{ team: homeTeam, label: "Home" }, { team: awayTeam, label: "Away" }].map(({ team, label }) => <div key={team.id}>
            <p className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
            <div className="grid grid-cols-2 gap-1">{team.players.map((player) => <button key={player.id} type="button" onClick={() => { onShot(player, team.id, shotOutcome); setShotOutcome(null); }} className="truncate rounded bg-muted/60 px-2 py-1 text-left text-[11px] hover:bg-muted">{player.firstName} {player.lastName}</button>)}</div>
          </div>)}
        </div>}
      </div>}
    </div>
  );
});
