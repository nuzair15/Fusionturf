import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Swords, ShieldAlert, Shield, ArrowRight, RotateCcw, X } from "lucide-react";

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

  const renderActionPicker = (team: TeamData) => {
    const inGoalFlow = goalFlow?.teamId === team.id;
    const inSubFlow = subFlow?.teamId === team.id;

    if (inGoalFlow) {
      return (
        <div className="rounded-xl border bg-muted/50 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {goalFlow.step === "scorer" ? "Select scorer" : "Select assister (optional)"}
          </p>
          <div className="flex flex-col gap-1.5">
            {team.players.map((p) => (
              <button key={p.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-background active:scale-[0.98] ${goalFlow.scorerId === p.id ? "bg-primary/10 font-semibold" : ""}`}
                onClick={() => {
                  if (goalFlow.step === "scorer") {
                    setGoalFlow({ ...goalFlow, step: "assist", scorerId: p.id });
                  } else {
                    addGoal(team.id, goalFlow.scorerId!, p.id);
                  }
                }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{p.jerseyNumber || "?"}</span>
                <span className="flex-1">{p.firstName} {p.lastName}</span>
                {p.stats.goals > 0 && <Badge variant="outline" className="text-xs">{p.stats.goals}G</Badge>}
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
      );
    }

    if (inSubFlow) {
      return (
        <div className="rounded-xl border bg-muted/50 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {subFlow.step === "off" ? "Select player OFF" : "Select player ON"}
          </p>
          <div className="flex flex-col gap-1.5">
            {team.players
              .filter((p) => subFlow.step === "off" ? !subbedOffIds.has(p.id) : p.id !== subFlow.playerOffId)
              .map((p) => (
                <button key={p.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-background active:scale-[0.98]"
                  onClick={() => {
                    if (subFlow.step === "off") {
                      setSubFlow({ ...subFlow, step: "on", playerOffId: p.id });
                    } else {
                      addSub(team.id, subFlow.playerOffId!, p.id);
                    }
                  }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{p.jerseyNumber || "?"}</span>
                  <span className="flex-1">{p.firstName} {p.lastName}</span>
                  {p.squadType === "SUBSTITUTE" && <Badge variant="outline" className="text-xs">Sub</Badge>}
                </button>
              ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-1 w-full text-xs text-destructive" onClick={() => setSubFlow(null)}>Cancel</Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-2 pb-4 sm:pt-4 sm:pb-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-background shadow-xl sm:m-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b bg-background px-3 py-3 sm:px-6">
          <div>
            <h2 className="text-sm font-bold sm:text-lg">Live Match Stats</h2>
            <div className="flex items-center gap-2">
              <p className="text-xl font-black tabular-nums tracking-tight sm:text-2xl">{scoreDisplay}</p>
              <Badge variant={data.fixture.status === "LIVE" ? "default" : "secondary"} className="text-[10px]">{data.fixture.status}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9"><X className="h-5 w-5" /></Button>
        </div>

        {error && <p className="px-3 pt-3 text-center text-sm text-destructive sm:px-6">{error}</p>}

        {/* Teams */}
        <div className="flex flex-col divide-y sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {[data.homeTeam, data.awayTeam].map((team) => (
            <div key={team.id} className="flex flex-col p-3 sm:p-4">
              {/* Team header */}
              <div className="mb-2 flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
                <img src={team.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted object-cover sm:h-10 sm:w-10" />
                <p className="text-sm font-bold sm:text-base">{team.shortName || team.name}</p>
                <Badge className="ml-auto text-sm">{team.id === data.homeTeam.id ? data.fixture.homeScore ?? 0 : data.fixture.awayScore ?? 0}</Badge>
              </div>

              {/* Action buttons */}
              {!goalFlow && !subFlow && (
                <div className="mb-2 flex gap-2">
                  <button onClick={() => setGoalFlow({ teamId: team.id, step: "scorer" })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-600 active:scale-[0.97] sm:text-sm">
                    <Trophy className="h-4 w-4" /> Goal
                  </button>
                  <button onClick={() => removeLastGoal(team.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-muted px-3 py-2.5 text-xs font-semibold active:scale-[0.97] sm:text-sm">
                    <RotateCcw className="h-4 w-4" /> Undo
                  </button>
                  <button onClick={() => setSubFlow({ teamId: team.id, step: "off" })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500/10 px-3 py-2.5 text-xs font-semibold text-orange-600 active:scale-[0.97] sm:text-sm">
                    <ArrowRight className="h-4 w-4" /> Sub
                  </button>
                </div>
              )}

              {renderActionPicker(team)}

              {/* Subs history */}
              {!goalFlow && !subFlow && !!data.matchStats.substitutions.filter((s) => team.players.some((p) => p.id === s.playerOn.id || p.id === s.playerOff.id)).length && (
                <div className="mb-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subs</p>
                  {data.matchStats.substitutions
                    .filter((s) => team.players.some((p) => p.id === s.playerOn.id || p.id === s.playerOff.id))
                    .map((s) => (
                      <p key={s.id} className="text-xs leading-relaxed">
                        <span className="text-destructive line-through">{s.playerOff.firstName.split(" ")[0]}</span>
                        <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" />
                        <span className="text-emerald-600">{s.playerOn.firstName.split(" ")[0]}</span>
                        <span className="ml-1 text-muted-foreground">{s.minute}&apos;</span>
                      </p>
                    ))}
                </div>
              )}

              {/* Players */}
              <div className="flex flex-col gap-1.5">
                {team.players.map((p) => {
                  const isSubbedOff = subbedOffIds.has(p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-2 rounded-xl border bg-card/60 px-3 py-2 ${isSubbedOff ? "opacity-40" : ""}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground sm:h-10 sm:w-10">
                        {p.jerseyNumber || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">{p.firstName} {p.lastName}</p>
                        <p className="text-[11px] text-muted-foreground">{p.position || "N/A"}{isSubbedOff ? " (off)" : p.squadType === "SUBSTITUTE" ? " (Sub)" : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <StatButton playerId={p.id} teamId={team.id} fixtureId={fixtureId} statType="goal" value={p.stats.goals} color="text-emerald-500" onUpdated={fetchStats} disabled />
                        <StatButton playerId={p.id} teamId={team.id} fixtureId={fixtureId} statType="assist" value={p.stats.assists} color="text-blue-500" onUpdated={fetchStats} />
                        <StatButton playerId={p.id} teamId={team.id} fixtureId={fixtureId} statType="yellowCard" value={p.stats.yellowCards} color="text-amber-500" onUpdated={fetchStats} />
                        <StatButton playerId={p.id} teamId={team.id} fixtureId={fixtureId} statType="redCard" value={p.stats.redCards} color="text-red-500" onUpdated={fetchStats} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="border-t p-3 text-center text-[11px] text-muted-foreground sm:p-4">
          Goal/Sub buttons above. +/- for assists, cards.
        </p>
      </div>
    </div>
  );
}

function StatButton({ playerId, teamId, fixtureId, statType, value, color, onUpdated, disabled }: {
  playerId: string; teamId: string; fixtureId: string; statType: string; value: number; color: string;
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
          className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-90 disabled:opacity-30 sm:h-5 sm:w-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:h-3 sm:w-3"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      )}
      <span className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-sm font-bold ${color} sm:h-6 sm:min-w-[1.5rem] sm:text-xs`}>{value}</span>
      <button onClick={async () => { if (busy) return; await doUpdate("increment"); }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary active:scale-90 sm:h-5 sm:w-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:h-3 sm:w-3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
    </div>
  );
}
