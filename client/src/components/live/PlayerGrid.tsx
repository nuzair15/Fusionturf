import { memo, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { LivePlayer } from "@/types/live";
import { PlayerCard } from "./PlayerCard";
import { Input } from "@/components/ui/input";

export const PlayerGrid = memo(function PlayerGrid({ title, players, teamId, teamColor, onPick, onDecrement, onIncrement, disabled, subbedOffIds, captainId, goalkeeperId }: {
  title: string;
  players: LivePlayer[];
  teamId: string;
  teamColor?: "emerald" | "blue";
  onPick?: (player: LivePlayer) => void;
  onDecrement?: (playerId: string, statType: "assist" | "yellowCard" | "redCard") => void;
  onIncrement?: (playerId: string, statType: "assist" | "yellowCard" | "redCard") => void;
  disabled?: boolean;
  subbedOffIds?: Set<string>;
  captainId?: string;
  goalkeeperId?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      String(p.jerseyNumber ?? "").includes(q)
    );
  }, [players, query]);

  const colorBar = teamColor === "blue" ? "border-blue-500/40" : "border-emerald-500/40";
  const headerBg = teamColor === "blue" ? "from-blue-600/10 to-blue-500/5" : "from-emerald-600/10 to-emerald-500/5";

  return (
    <div className={`flex flex-col rounded-xl border ${colorBar} bg-card/40`}>
      <div className={`flex items-center justify-between rounded-t-xl border-b bg-gradient-to-r ${headerBg} px-3 py-2.5`}>
        <p className="text-sm font-bold">{title}</p>
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">{filtered.length}</span>
      </div>
      <div className="relative p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="h-8 pl-8 text-xs"
          aria-label={`Search ${title} players`}
        />
      </div>
      <div className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto px-2 pb-2 lg:max-h-[52vh]">
        {filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No players found</p>}
        {filtered.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isCaptain={captainId === p.id}
            isGoalkeeper={goalkeeperId === p.id}
            subbedOff={subbedOffIds?.has(p.id)}
            onSelect={onPick ? () => onPick(p) : undefined}
            onDecrement={onDecrement ? (statType) => onDecrement(p.id, statType) : undefined}
            onIncrement={onIncrement ? (statType) => onIncrement(p.id, statType) : undefined}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
});
