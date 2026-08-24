import type { LiveTeam } from "@/types/live";
import { PlayerGrid } from "./PlayerGrid";

export function PlayerPanel({ home, away, onPickHome, onPickAway, onAppearance, subbedOffIds, disabled }: {
  home: LiveTeam;
  away: LiveTeam;
  onPickHome?: (p: LiveTeam["players"][number]) => void;
  onPickAway?: (p: LiveTeam["players"][number]) => void;
  onAppearance?: (teamId: string, p: LiveTeam["players"][number]) => void;
  subbedOffIds?: Set<string>;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <PlayerGrid
        title={home.shortName || home.name}
        players={home.players}
        teamId={home.id}
        teamColor="emerald"
        onPick={onPickHome}
        onAppearance={onAppearance ? (p) => onAppearance(home.id, p) : undefined}
        subbedOffIds={subbedOffIds}
        disabled={disabled}
      />
      <PlayerGrid
        title={away.shortName || away.name}
        players={away.players}
        teamId={away.id}
        teamColor="blue"
        onPick={onPickAway}
        onAppearance={onAppearance ? (p) => onAppearance(away.id, p) : undefined}
        subbedOffIds={subbedOffIds}
        disabled={disabled}
      />
    </div>
  );
}
