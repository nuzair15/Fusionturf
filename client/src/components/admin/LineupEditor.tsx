import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FootballPitch } from "@/components/league/FootballPitch";
import { FormationBadge } from "@/components/league/FormationBadge";
import { useLineup } from "@/hooks/useLineup";
import { saveFixtureLineups } from "@/services/lineupApi";
import { calculateFormation } from "@/lib/lineup";
import type { Fixture, Player } from "@/types";
import type { FixtureLineupPlayer, LineupEntryInput } from "@/types/lineup";
import { X, Trash2, Plus } from "lucide-react";

interface TeamPanelProps {
  side: "home" | "away";
  teamName: string;
  logoUrl?: string;
  color: string;
  players: Player[];
  entries: LineupEntryInput[];
  addValue: string;
  onAddChange: (value: string) => void;
  onAdd: (playerId: string) => void;
  onUpdate: (playerId: string, patch: Partial<LineupEntryInput>) => void;
  onRemove: (playerId: string) => void;
  onToggleCaptain: (playerId: string, value: boolean) => void;
  onToggleGK: (playerId: string, value: boolean) => void;
}

function TeamPanel({
  side,
  teamName,
  logoUrl,
  color,
  players,
  entries,
  addValue,
  onAddChange,
  onAdd,
  onUpdate,
  onRemove,
  onToggleCaptain,
  onToggleGK,
}: TeamPanelProps) {
  const usedIds = new Set(entries.map((e) => e.playerId));
  const available = players.filter((p) => !usedIds.has(p.id));
  const starters = entries.filter((e) => e.isStarter).length;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        {logoUrl && <img src={logoUrl} alt="" className="h-6 w-6 rounded-full bg-muted object-cover" />}
        <p className="text-sm font-semibold">{teamName}</p>
        <span className="ml-auto text-xs text-muted-foreground">
          {starters} on pitch · {entries.length - starters} bench
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <Select value={addValue} onChange={(e) => onAddChange(e.target.value)} aria-label={`Add player to ${teamName}`}>
          <option value="">Add player…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} {p.jerseyNumber ? `#${p.jerseyNumber}` : ""}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1"
          disabled={!addValue}
          onClick={() => { onAdd(addValue); }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No players added yet
          </p>
        )}
        {entries.map((entry) => {
          const player = players.find((p) => p.id === entry.playerId);
          const name = player ? `${player.firstName} ${player.lastName}` : "Unknown player";
          return (
            <div key={entry.playerId} className="rounded-lg border p-2">
              <div className="flex items-center gap-1.5">
                <Select
                  className="h-8 flex-1 text-xs"
                  value={entry.playerId}
                  onChange={(e) => onUpdate(entry.playerId, { playerId: e.target.value })}
                  aria-label={`Player in ${teamName} lineup`}
                >
                  <option value={entry.playerId}>{name}</option>
                  {available.filter((p) => p.id !== entry.playerId).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.jerseyNumber ? `#${p.jerseyNumber}` : ""}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-destructive"
                  onClick={() => onRemove(entry.playerId)}
                  aria-label={`Remove ${name} from lineup`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 has-[:checked]:border-primary">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-emerald-500"
                    checked={entry.isStarter !== false}
                    onChange={(e) => onUpdate(entry.playerId, { isStarter: e.target.checked })}
                  />
                  On pitch
                </label>
                <label className="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 has-[:checked]:border-amber-400">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-amber-400"
                    checked={!!entry.isCaptain}
                    onChange={(e) => onToggleCaptain(entry.playerId, e.target.checked)}
                  />
                  Captain
                </label>
                <label className="flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 has-[:checked]:border-sky-400">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-sky-500"
                    checked={!!entry.isGoalkeeper}
                    onChange={(e) => onToggleGK(entry.playerId, e.target.checked)}
                  />
                  Goalkeeper
                </label>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {entry.isStarter ? `x ${Math.round(entry.xPosition ?? 50)} · y ${Math.round(entry.yPosition ?? 50)}` : "Bench"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineupEditor({ fixture, onClose, onSaved }: {
  fixture: Fixture;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const homeColor = "#22c55e";
  const awayColor = "#38bdf8";

  const { data: lineups, isLoading: lineupsLoading } = useLineup(fixture.id);

  const { data: homePlayersData } = useQuery({
    queryKey: ["admin-team-players", fixture.homeTeamId],
    queryFn: () => api.get<{ data: Player[] }>("/admin/players", { teamId: fixture.homeTeamId, limit: "100" }),
  });
  const { data: awayPlayersData } = useQuery({
    queryKey: ["admin-team-players", fixture.awayTeamId],
    queryFn: () => api.get<{ data: Player[] }>("/admin/players", { teamId: fixture.awayTeamId, limit: "100" }),
  });

  const homePlayers = homePlayersData?.data || [];
  const awayPlayers = awayPlayersData?.data || [];

  const [homeEntries, setHomeEntries] = useState<LineupEntryInput[]>([]);
  const [awayEntries, setAwayEntries] = useState<LineupEntryInput[]>([]);
  const [homeAddId, setHomeAddId] = useState("");
  const [awayAddId, setAwayAddId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !lineups) return;
    initialized.current = true;
    const toEntry = (p: FixtureLineupPlayer): LineupEntryInput => ({
      playerId: p.playerId,
      isStarter: p.isStarter,
      isCaptain: p.isCaptain,
      isGoalkeeper: p.isGoalkeeper,
      role: p.role,
      xPosition: p.xPosition,
      yPosition: p.yPosition,
    });
    setHomeEntries([...lineups.home.starters, ...lineups.home.bench].map(toEntry));
    setAwayEntries([...lineups.away.starters, ...lineups.away.bench].map(toEntry));
  }, [lineups]);

  const homePlayerMap = useMemo(() => new Map(homePlayers.map((p) => [p.id, p])), [homePlayers]);
  const awayPlayerMap = useMemo(() => new Map(awayPlayers.map((p) => [p.id, p])), [awayPlayers]);

  const toPitchPlayer = (side: "home" | "away", entry: LineupEntryInput): FixtureLineupPlayer => {
    const player = (side === "home" ? homePlayerMap : awayPlayerMap).get(entry.playerId);
    return {
      id: `${side}-${entry.playerId}`,
      playerId: entry.playerId,
      name: player ? `${player.firstName} ${player.lastName}`.trim() : "Unknown player",
      jerseyNumber: player?.jerseyNumber ?? null,
      avatar: player?.photoUrl ?? null,
      position: player?.position ?? null,
      role: entry.isGoalkeeper ? "GK" : entry.role ?? player?.position ?? null,
      xPosition: entry.xPosition ?? 50,
      yPosition: entry.yPosition ?? 50,
      isCaptain: !!entry.isCaptain,
      isGoalkeeper: !!entry.isGoalkeeper,
      isStarter: true,
    };
  };

  const homeStarters = useMemo(
    () => homeEntries.filter((e) => e.isStarter).map((e) => toPitchPlayer("home", e)),
    [homeEntries, homePlayerMap]
  );
  const awayStarters = useMemo(
    () => awayEntries.filter((e) => e.isStarter).map((e) => toPitchPlayer("away", e)),
    [awayEntries, awayPlayerMap]
  );
  const homeFormation = useMemo(() => calculateFormation(homeStarters, true), [homeStarters]);
  const awayFormation = useMemo(() => calculateFormation(awayStarters, false), [awayStarters]);

  const updateEntry = (side: "home" | "away", playerId: string, patch: Partial<LineupEntryInput>) => {
    const setter = side === "home" ? setHomeEntries : setAwayEntries;
    setter((prev) => prev.map((e) => (e.playerId === playerId ? { ...e, ...patch } : e)));
  };

  const handlePlayerMove = (player: FixtureLineupPlayer, x: number, y: number) => {
    const side = homePlayerMap.has(player.playerId) ? "home" : "away";
    updateEntry(side, player.playerId, { xPosition: x, yPosition: y });
  };

  const addPlayer = (side: "home" | "away", playerId: string) => {
    if (!playerId) return;
    const setter = side === "home" ? setHomeEntries : setAwayEntries;
    const clear = side === "home" ? () => setHomeAddId("") : () => setAwayAddId("");
    setter((prev) => {
      if (prev.some((e) => e.playerId === playerId)) return prev;
      return [...prev, { playerId, isStarter: true, isCaptain: false, isGoalkeeper: false, role: null, xPosition: 50, yPosition: 50 }];
    });
    clear();
  };

  const removePlayer = (side: "home" | "away", playerId: string) => {
    const setter = side === "home" ? setHomeEntries : setAwayEntries;
    setter((prev) => prev.filter((e) => e.playerId !== playerId));
  };

  const toggleCaptain = (side: "home" | "away", playerId: string, value: boolean) => {
    const setter = side === "home" ? setHomeEntries : setAwayEntries;
    setter((prev) =>
      prev.map((e) =>
        e.playerId === playerId ? { ...e, isCaptain: value } : value ? { ...e, isCaptain: false } : e
      )
    );
  };

  const toggleGK = (side: "home" | "away", playerId: string, value: boolean) => {
    const setter = side === "home" ? setHomeEntries : setAwayEntries;
    setter((prev) =>
      prev.map((e) => {
        if (e.playerId !== playerId) return value ? { ...e, isGoalkeeper: false } : e;
        if (!value) return { ...e, isGoalkeeper: false };
        const next: LineupEntryInput = { ...e, isGoalkeeper: true };
        if (next.isStarter) {
          next.xPosition = next.xPosition ?? 50;
          next.yPosition = side === "home" ? 88 : 12;
        }
        return next;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const resolveRole = (side: "home" | "away", e: LineupEntryInput) => {
        if (e.isGoalkeeper) return "GK";
        const player = (side === "home" ? homePlayerMap : awayPlayerMap).get(e.playerId);
        return e.role ?? player?.position ?? null;
      };
      await saveFixtureLineups(fixture.id, {
        home: homeEntries.map((e) => ({ ...e, role: resolveRole("home", e) })),
        away: awayEntries.map((e) => ({ ...e, role: resolveRole("away", e) })),
      });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["fixture-lineups", fixture.id] });
      queryClient.invalidateQueries({ queryKey: ["fixture", fixture.id] });
      onSaved?.();
    } catch (err: any) {
      setError(err.message || "Failed to save lineups");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 py-4 sm:py-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-background p-4 shadow-xl sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Fixture Lineups</h2>
            <p className="text-sm text-muted-foreground">
              {fixture.homeTeam?.name || "Home"} vs {fixture.awayTeam?.name || "Away"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close lineup editor">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {saved && !error && <p className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">Lineups saved successfully.</p>}

        {lineupsLoading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">Loading lineups…</div>
        ) : (
          <>
            {/* Team headers */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {fixture.homeTeam?.logoUrl && (
                  <img src={fixture.homeTeam.logoUrl} alt="" className="h-7 w-7 rounded-full bg-muted object-cover" />
                )}
                <p className="truncate text-sm font-semibold">{fixture.homeTeam?.name || "Home"}</p>
                <FormationBadge formation={homeFormation} />
              </div>
              <p className="hidden text-center text-[11px] text-muted-foreground sm:block">
                Drag players to position them on the pitch
              </p>
              <div className="flex min-w-0 items-center justify-end gap-2">
                <FormationBadge formation={awayFormation} />
                <p className="truncate text-sm font-semibold">{fixture.awayTeam?.name || "Away"}</p>
                {fixture.awayTeam?.logoUrl && (
                  <img src={fixture.awayTeam.logoUrl} alt="" className="h-7 w-7 rounded-full bg-muted object-cover" />
                )}
              </div>
            </div>

            <FootballPitch
              homePlayers={homeStarters}
              awayPlayers={awayStarters}
              editable
              onPlayerMove={handlePlayerMove}
              homeColor={homeColor}
              awayColor={awayColor}
              className="mx-auto max-w-sm"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TeamPanel
                side="home"
                teamName={fixture.homeTeam?.name || "Home"}
                logoUrl={fixture.homeTeam?.logoUrl}
                color={homeColor}
                players={homePlayers}
                entries={homeEntries}
                addValue={homeAddId}
                onAddChange={setHomeAddId}
                onAdd={(id) => addPlayer("home", id)}
                onUpdate={(id, patch) => updateEntry("home", id, patch)}
                onRemove={(id) => removePlayer("home", id)}
                onToggleCaptain={(id, v) => toggleCaptain("home", id, v)}
                onToggleGK={(id, v) => toggleGK("home", id, v)}
              />
              <TeamPanel
                side="away"
                teamName={fixture.awayTeam?.name || "Away"}
                logoUrl={fixture.awayTeam?.logoUrl}
                color={awayColor}
                players={awayPlayers}
                entries={awayEntries}
                addValue={awayAddId}
                onAddChange={setAwayAddId}
                onAdd={(id) => addPlayer("away", id)}
                onUpdate={(id, patch) => updateEntry("away", id, patch)}
                onRemove={(id) => removePlayer("away", id)}
                onToggleCaptain={(id, v) => toggleCaptain("away", id, v)}
                onToggleGK={(id, v) => toggleGK("away", id, v)}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Lineups"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
