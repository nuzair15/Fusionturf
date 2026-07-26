import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trophy, Swords, ShieldAlert, Shield } from "lucide-react";

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
}

interface Props {
  fixtureId: string;
  onClose: () => void;
}

export function LiveStatsPanel({ fixtureId, onClose }: Props) {
  const [data, setData] = useState<LiveStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<LiveStatsData>(`/admin/fixtures/${fixtureId}/live-stats`);
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [fixtureId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const updateStat = async (playerId: string, statType: string, teamId: string, action: "increment" | "decrement") => {
    await api.post(`/admin/fixtures/${fixtureId}/live-stats/update`, { playerId, statType, teamId, action });
    await fetchStats();
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading live stats...</div>;
  if (!data) return <div className="p-8 text-center text-destructive">Failed to load stats</div>;

  const scoreDisplay = `${data.fixture.homeScore ?? 0} - ${data.fixture.awayScore ?? 0}`;

  const renderPlayerRow = (player: PlayerStatLine, teamId: string) => (
    <div key={player.id} className="flex items-center gap-2 rounded-xl border bg-card/60 px-3 py-2 text-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {player.jerseyNumber || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{player.firstName} {player.lastName}</p>
        <p className="text-[10px] text-muted-foreground">{player.position || "N/A"} {player.squadType === "SUBSTITUTE" ? "(Sub)" : player.squadType === "RESERVE" ? "(Res)" : ""}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <StatButton playerId={player.id} teamId={teamId} statType="goal" icon={<Trophy className="h-3.5 w-3.5" />} value={player.stats.goals} color="text-emerald-500" updateStat={updateStat} />
        <StatButton playerId={player.id} teamId={teamId} statType="assist" icon={<Swords className="h-3.5 w-3.5" />} value={player.stats.assists} color="text-blue-500" updateStat={updateStat} />
        <StatButton playerId={player.id} teamId={teamId} statType="yellowCard" icon={<ShieldAlert className="h-3.5 w-3.5" />} value={player.stats.yellowCards} color="text-amber-500" updateStat={updateStat} />
        <StatButton playerId={player.id} teamId={teamId} statType="redCard" icon={<Shield className="h-3.5 w-3.5" />} value={player.stats.redCards} color="text-red-500" updateStat={updateStat} />
      </div>
    </div>
  );

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
              <img src={data.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted object-cover" />
              <p className="font-bold">{data.homeTeam.shortName || data.homeTeam.name}</p>
              <Badge className="ml-auto">{data.fixture.homeScore ?? 0}</Badge>
            </div>
            {data.homeTeam.players.map((p) => renderPlayerRow(p, data.homeTeam.id))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
              <img src={data.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted object-cover" />
              <p className="font-bold">{data.awayTeam.shortName || data.awayTeam.name}</p>
              <Badge className="ml-auto">{data.fixture.awayScore ?? 0}</Badge>
            </div>
            {data.awayTeam.players.map((p) => renderPlayerRow(p, data.awayTeam.id))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">Tap + to add, − to undo last stat entry</p>
      </div>
    </div>
  );
}

function StatButton({ playerId, teamId, statType, icon, value, color, updateStat }: {
  playerId: string; teamId: string; statType: string; icon: React.ReactNode; value: number; color: string; updateStat: (pid: string, st: string, tid: string, action: "increment" | "decrement") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={async () => { if (busy || value <= 0) return; setBusy(true); await updateStat(playerId, statType, teamId, "decrement"); setBusy(false); }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-30" disabled={value <= 0}>
        <Minus className="h-3 w-3" />
      </button>
      <span className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-md px-1 text-xs font-bold ${color}`}>{value}</span>
      <button onClick={async () => { setBusy(true); await updateStat(playerId, statType, teamId, "increment"); setBusy(false); }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
