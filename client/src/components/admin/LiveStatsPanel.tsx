import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Swords, ShieldAlert, Shield, ArrowRight, RotateCcw } from "lucide-react";

interface SubstitutionData {
  id: string;
  minute: number;
  playerOff: { id: string; firstName: string; lastName: string };
  playerOn: { id: string; firstName: string; lastName: string };
}

interface PlayerStatLine {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  position?: string;
  photoUrl?: string;
  squadType?: string;
  stats: { goals: number; assists: number; yellowCards: number; redCards: number };
}

interface TeamData {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  players: PlayerStatLine[];
}

interface LiveStatsData {
  fixture: { id: string; matchDate: string; status: string; homeScore?: number; awayScore?: number };
  homeTeam: TeamData;
  awayTeam: TeamData;
  matchStats: { goals: any[]; assists: any[]; cards: any[]; substitutions: SubstitutionData[] };
}

interface Props {
  fixtureId: string;
  onClose: () => void;
}

export function LiveStatsPanel({ fixtureId, onClose }: Props) {
  const [data, setData] = useState<LiveStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalFlow, setGoalFlow] = useState<{ teamId: string; step: "scorer" | "assist"; scorerId?: string } | null>(null);
  const [subFlow, setSubFlow] = useState<{ teamId: string; step: "off" | "on"; playerOffId?: string } | null>(null);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<LiveStatsData>(`/admin/fixtures/${fixtureId}/live-stats`);
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [fixtureId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const subbedOffIds = new Set(data?.matchStats.substitutions.map((s) => s.playerOff.id) || []);

  const addGoal = async (teamId: string, scorerId: string, assistId?: string) => {
    setError("");
    try {
      await api.post(`/admin/fixtures/${fixtureId}/goal`, { teamId, scorerId, assistId: assistId || undefined });
      setGoalFlow(null);
      await fetchStats();
    } catch (e: any) { setError(e.message); }
  };

  const removeLastGoal = async (teamId: string) => {
    setError("");
    const team = teamId === data?.homeTeam.id ? data?.homeTeam : data?.awayTeam;
    if (!team) return;
    const scorers = team.players.filter((p) => p.stats.goals > 0);
    if (scorers.length === 0) return;
    const lastScorer = scorers[scorers.length - 1];
    try {
      await api.post(`/admin/fixtures/${fixtureId}/goal/remove`, { playerId: lastScorer.id });
      await fetchStats();
    } catch (e: any) { setError(e.message); }
  };

  const addSub = async (teamId: string, playerOffId: string, playerOnId: string) => {
    setError("");
    try {
      await api.post(`/admin/fixtures/${fixtureId}/substitution`, { teamId, playerOffId, playerOnId, minute: 0 });
      setSubFlow(null);
      await fetchStats();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading live stats...</div>;
  if (!data) return <div className="p-8 text-center text-destructive">Failed to load stats</div>;

  const scoreDisplay = `${data.fixture.homeScore ?? 0} - ${data.fixture.awayScore ?? 0}`;

  const renderTeamHeader = (team: TeamData) => {
    const inGoalFlow = goalFlow?.teamId === team.id;
    const inSubFlow = subFlow?.teamId === team.id;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
          <img src={team.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted object-cover" />
          <p className="font-bold">{team.shortName || team.name}</p>
          <Badge className="ml-auto">{team.id === data.homeTeam.id ? data.fixture.homeScore ?? 0 : data.fixture.awayScore ?? 0}</Badge>
        </div>

        {!inGoalFlow && !inSubFlow && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setGoalFlow({ teamId: team.id, step: "scorer" })}>
              <Trophy className="h-3.5 w-3.5 text-emerald-500" /> Goal
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => removeLastGoal(team.id)}>
              <RotateCcw className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setSubFlow({ teamId: team.id, step: "off" })}>
              <ArrowRight className="h-3.5 w-3.5 text-orange-500" /> Sub
            </Button>
          </div>
        )}

        {inGoalFlow && (
          <div className="rounded-xl border bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {goalFlow.step === "scorer" ? "Select scorer" : "Select assister (optional)"}
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {team.players.map((p) => (
                <button key={p.id}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-background ${goalFlow.scorerId === p.id ? "bg-primary/10 font-semibold" : ""}`}
                  onClick={() => {
                    if (goalFlow.step === "scorer") {
                      setGoalFlow({ ...goalFlow, step: "assist", scorerId: p.id });
                    } else {
                      addGoal(team.id, goalFlow.scorerId!, p.id);
                    }
                  }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{p.jerseyNumber || "?"}</span>
                  <span>{p.firstName} {p.lastName}</span>
                  {p.stats.goals > 0 && <Badge variant="outline" className="ml-auto text-[10px]">{p.stats.goals}G</Badge>}
                </button>
              ))}
            </div>
            {goalFlow.step === "assist" && (
              <Button size="sm" variant="ghost" className="mt-2 w-full text-xs" onClick={() => addGoal(team.id, goalFlow.scorerId!)}>
                No assist — confirm goal
              </Button>
            )}
            <Button size="sm" variant="ghost" className="mt-1 w-full text-xs text-destructive" onClick={() => setGoalFlow(null)}>Cancel</Button>
          </div>
        )}

        {inSubFlow && (
          <div className="rounded-xl border bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {subFlow.step === "off" ? "Select player OFF" : "Select player ON"}
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {team.players
                .filter((p) => subFlow.step === "off" ? !subbedOffIds.has(p.id) : p.id !== subFlow.playerOffId)
                .map((p) => (
                  <button key={p.id}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-background"
                    onClick={() => {
                      if (subFlow.step === "off") {
                        setSubFlow({ ...subFlow, step: "on", playerOffId: p.id });
                      } else {
                        addSub(team.id, subFlow.playerOffId!, p.id);
                      }
                    }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{p.jerseyNumber || "?"}</span>
                    <span>{p.firstName} {p.lastName}</span>
                    {p.squadType === "SUBSTITUTE" && <Badge variant="outline" className="ml-auto text-[10px]">Sub</Badge>}
                  </button>
                ))}
            </div>
            <Button size="sm" variant="ghost" className="mt-1 w-full text-xs text-destructive" onClick={() => setSubFlow(null)}>Cancel</Button>
          </div>
        )}

        {!!data.matchStats.substitutions.filter((s) => team.players.some((p) => p.id === s.playerOn.id || p.id === s.playerOff.id)).length && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Substitutions</p>
            {data.matchStats.substitutions
              .filter((s) => team.players.some((p) => p.id === s.playerOn.id || p.id === s.playerOff.id))
              .map((s) => (
                <p key={s.id} className="text-xs">
                  <span className="text-destructive line-through">{s.playerOff.firstName} {s.playerOff.lastName}</span>
                  <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" />
                  <span className="text-emerald-600">{s.playerOn.firstName} {s.playerOn.lastName}</span>
                  <span className="ml-1 text-muted-foreground">{s.minute}&apos;</span>
                </p>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderPlayerRow = (player: PlayerStatLine, teamId: string) => {
    const isSubbedOff = subbedOffIds.has(player.id);
    return (
      <div key={player.id} className={`flex items-center gap-2 rounded-xl border bg-card/60 px-3 py-2 text-sm ${isSubbedOff ? "opacity-40" : ""}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {player.jerseyNumber || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{player.firstName} {player.lastName}</p>
          <p className="text-[10px] text-muted-foreground">{player.position || "N/A"}{isSubbedOff ? " (subbed off)" : player.squadType === "SUBSTITUTE" ? " (Sub)" : player.squadType === "RESERVE" ? " (Res)" : ""}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatButton playerId={player.id} teamId={teamId} fixtureId={fixtureId} statType="goal" icon={<Trophy className="h-3.5 w-3.5" />} value={player.stats.goals} color="text-emerald-500" onUpdated={fetchStats} disabled />
          <StatButton playerId={player.id} teamId={teamId} fixtureId={fixtureId} statType="assist" icon={<Swords className="h-3.5 w-3.5" />} value={player.stats.assists} color="text-blue-500" onUpdated={fetchStats} />
          <StatButton playerId={player.id} teamId={teamId} fixtureId={fixtureId} statType="yellowCard" icon={<ShieldAlert className="h-3.5 w-3.5" />} value={player.stats.yellowCards} color="text-amber-500" onUpdated={fetchStats} />
          <StatButton playerId={player.id} teamId={teamId} fixtureId={fixtureId} statType="redCard" icon={<Shield className="h-3.5 w-3.5" />} value={player.stats.redCards} color="text-red-500" onUpdated={fetchStats} />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-4 pb-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-background p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-center">
            <h2 className="text-lg font-bold">Live Match Stats</h2>
            <p className="text-2xl font-black tabular-nums tracking-tight">{scoreDisplay}</p>
            <Badge variant={data.fixture.status === "LIVE" ? "default" : "secondary"} className="mt-1">{data.fixture.status}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
        </div>
        {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            {renderTeamHeader(data.homeTeam)}
            {data.homeTeam.players.map((p) => renderPlayerRow(p, data.homeTeam.id))}
          </div>
          <div className="space-y-2">
            {renderTeamHeader(data.awayTeam)}
            {data.awayTeam.players.map((p) => renderPlayerRow(p, data.awayTeam.id))}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Use Goal/Sub buttons above. Use +/- for assists, yellow & red cards.
        </p>
      </div>
    </div>
  );
}

function StatButton({ playerId, teamId, fixtureId, statType, icon, value, color, onUpdated, disabled }: {
  playerId: string; teamId: string; fixtureId: string; statType: string; icon: React.ReactNode; value: number; color: string;
  onUpdated: () => Promise<void>; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const doUpdate = async (action: "increment" | "decrement") => {
    setBusy(true);
    try {
      await api.post(`/admin/fixtures/${fixtureId}/live-stats/update`, { playerId, statType, teamId, action });
      await onUpdated();
    } catch { /* ignore */ }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-0.5">
      {!disabled && (
        <button onClick={async () => { if (busy || value <= 0) return; await doUpdate("decrement"); }}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-30" disabled={value <= 0}>
          <MinusIcon />
        </button>
      )}
      <span className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-md px-1 text-xs font-bold ${color}`}>{value}</span>
      <button onClick={async () => { if (busy) return; await doUpdate("increment"); }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20">
        <PlusIcon />
      </button>
    </div>
  );
}

function MinusIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function PlusIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
