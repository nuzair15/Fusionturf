import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { LiveMatchData, TimelineEvent } from "@/types/live";
import { liveMatchApi, type StatType } from "@/services/liveMatchApi";
import { buildTimeline } from "@/lib/liveTimeline";
import { toast, Toaster } from "@/components/ui/toast";
import { MatchHeader } from "./MatchHeader";
import { QuickActions, type QuickAction } from "./QuickActions";
import { Timeline } from "./Timeline";
import { PlayerPanel } from "./PlayerPanel";
import { StatisticsPanel } from "./StatisticsPanel";
import { ActivityFeed, type ActivityItem } from "./ActivityFeed";
import { GoalDialog, type GoalType } from "./GoalDialog";
import { CardDialog } from "./CardDialog";
import { SubstitutionDialog } from "./SubstitutionDialog";
import { NoteDialog, type NoteType } from "./NoteDialog";
import { ConfirmationModal } from "./ConfirmationModal";
import { EventDetailsDialog } from "./EventDetailsDialog";
import type { MatchStatus } from "@/types";

interface UndoEntry {
  type: "goal" | "assist" | "card" | "substitution" | "note";
  id: string;
  label: string;
}

interface ConfirmState {
  title: string;
  description?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

type DialogKind = "goal" | "own-goal" | "penalty" | "yellow" | "red" | "substitution" | "var" | "missed-penalty" | null;

let activityId = 1;

export function MatchControlCenter({ fixtureId, onClose }: { fixtureId: string; onClose: () => void }) {
  const [data, setData] = useState<LiveMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [minute, setMinute] = useState(0);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [viewingEvent, setViewingEvent] = useState<TimelineEvent | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushActivity = useCallback((text: string, tone: ActivityItem["tone"] = "info") => {
    setActivity((prev) => {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const next = [{ id: activityId++, text, tone, time }, ...prev];
      return next.slice(0, 40);
    });
  }, []);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await liveMatchApi.fetchLiveStats(fixtureId);
      setData(res);
    } catch (e: any) {
      toast("Failed to load live match", e.message, "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Poll for updates while mounted.
  useEffect(() => {
    const id = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Keep timer running only while status is LIVE.
  useEffect(() => {
    setTimerRunning(data?.fixture.status === "LIVE");
  }, [data?.fixture.status]);

  useEffect(() => () => { if (fetchRef.current) clearTimeout(fetchRef.current); }, []);

  const refresh = useCallback(async (after?: () => Promise<void> | void) => {
    if (after) await after();
    await fetchStats(true);
  }, [fetchStats]);

  const runAction = useCallback(async (fn: () => Promise<any>, successMsg: string, undo?: { type: UndoEntry["type"]; label: string }) => {
    setBusy(true);
    try {
      const res = await fn();
      await fetchStats(true);
      if (undo) {
        const createdId = res?.id || res?.goal?.id || res?.assist?.id || res?.card?.id || res?.substitution?.id || res?.note?.id;
        if (createdId) {
          setUndoStack((s) => [{ ...undo, id: createdId }, ...s].slice(0, 50));
          pushActivity(undo.label, "success");
        }
      }
      toast(successMsg, undefined, "success");
      return res;
    } catch (e: any) {
      toast("Action failed", e.message, "error");
      return null;
    } finally {
      setBusy(false);
    }
  }, [fetchStats, pushActivity]);

  const setStatus = useCallback((status: MatchStatus) => {
    return runAction(() => liveMatchApi.setStatus(fixtureId, status), `Match ${status === "LIVE" ? "started/resumed" : status.toLowerCase().replace("_", " ")}`);
  }, [fixtureId, runAction]);

  const subbedOffIds = useMemo(() => {
    const set = new Set<string>();
    data?.matchStats.substitutions.forEach((s) => set.add(s.playerOff.id));
    return set;
  }, [data]);
  const subbedOnIds = useMemo(() => {
    const set = new Set<string>();
    data?.matchStats.substitutions.forEach((s) => set.add(s.playerOn.id));
    return set;
  }, [data]);

  const events = useMemo(() => (data ? buildTimeline(data) : []), [data]);

  const undoLast = useCallback(() => {
    if (undoStack.length === 0) { toast("Nothing to undo", undefined, "warning"); return; }
    const last = undoStack[0];
    setConfirm({
      title: `Undo "${last.label}"?`,
      description: "The event will be removed and the score/timeline/player stats restored.",
      destructive: true,
      onConfirm: () => runAction(() => liveMatchApi.removeEvent(fixtureId, last.type, last.id), "Event undone", undefined).then(() => setUndoStack((x) => x.slice(1))),
    });
  }, [undoStack, fixtureId, runAction]);

  const onQuickAction = useCallback((action: QuickAction) => {
    switch (action) {
      case "goal": setDialog("goal"); break;
      case "own-goal": setDialog("own-goal"); break;
      case "penalty": setDialog("penalty"); break;
      case "yellow": setDialog("yellow"); break;
      case "red": setDialog("red"); break;
      case "substitution": setDialog("substitution"); break;
      case "var": setDialog("var"); break;
      case "missed-penalty": setDialog("missed-penalty"); break;
      case "start": setStatus("LIVE"); break;
      case "resume": setStatus("LIVE"); break;
      case "pause": setStatus("PAUSED"); break;
      case "half-time": setStatus("HALF_TIME"); break;
      case "full-time":
        setConfirm({ title: "End the match?", description: "The final result will be processed and standings/player stats updated.", destructive: true, onConfirm: () => setStatus("COMPLETED") });
        break;
      case "undo": undoLast(); break;
    }
  }, [setStatus, undoLast]);

  const handleGoal = useCallback(async (payload: { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal: boolean; isPenalty: boolean }) => {
    const label = payload.isOwnGoal ? "Own goal added" : payload.isPenalty ? "Penalty goal added" : "Goal added";
    await runAction(
      () => liveMatchApi.addGoal(fixtureId, payload),
      "Goal Added Successfully",
      { type: "goal", label }
    );
  }, [fixtureId, runAction]);

  const handleCard = useCallback(async (payload: { teamId: string; playerId: string; cardType: "yellow" | "red" }) => {
    const statType: StatType = payload.cardType === "yellow" ? "yellowCard" : "redCard";
    const label = payload.cardType === "yellow" ? "Yellow card added" : "Red card added";
    await runAction(
      () => liveMatchApi.updateLiveStat(fixtureId, { playerId: payload.playerId, statType, teamId: payload.teamId, action: "increment" }),
      payload.cardType === "yellow" ? "Yellow card given" : "Red card given",
      { type: "card", label }
    );
  }, [fixtureId, runAction]);

  const handleSubstitution = useCallback(async (payload: { teamId: string; playerOffId: string; playerOnId: string; minute: number }) => {
    await runAction(
      () => liveMatchApi.addSubstitution(fixtureId, payload),
      "Substitution completed",
      { type: "substitution", label: "Substitution completed" }
    );
  }, [fixtureId, runAction]);

  const handleNote = useCallback(async (payload: { teamId?: string; playerId?: string; type: "VAR" | "MISSED_PENALTY"; minute: number; note?: string }) => {
    const label = payload.type === "VAR" ? "VAR review logged" : "Missed penalty logged";
    await runAction(
      () => liveMatchApi.addNote(fixtureId, payload),
      payload.type === "VAR" ? "VAR review logged" : "Missed penalty logged",
      { type: "note", label }
    );
  }, [fixtureId, runAction]);

  const handlePlayerStat = useCallback((teamId: string, playerId: string, statType: "assist" | "yellowCard" | "redCard", action: "increment" | "decrement") => {
    return runAction(
      () => liveMatchApi.updateLiveStat(fixtureId, { playerId, statType, teamId, action }),
      `${statType} ${action === "increment" ? "increased" : "decreased"}`,
      action === "increment" ? { type: statType === "assist" ? "assist" : "card", label: `${statType} updated` } : undefined
    );
  }, [fixtureId, runAction]);

  const handleTeamStat = useCallback((field: string, delta: number) => {
    const isHome = field.startsWith("home");
    const opposite = isHome ? field.replace("home", "away") : field.replace("away", "home");
    const value = Math.max(0, Number(data?.fixture[field as keyof LiveMatchData["fixture"]] || 0) + delta);
    const body: Record<string, number> = { [field]: value };
    if (field.toLowerCase().includes("possession")) {
      const oppValue = Math.max(0, 100 - value);
      body[opposite] = oppValue;
    }
    return runAction(() => liveMatchApi.updateTeamStats(fixtureId, body), `${field} updated`);
  }, [data, fixtureId, runAction]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (dialog) { if (e.key === "Escape") setDialog(null); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undoLast(); return; }
      const key = e.key.toLowerCase();
      if (key === "g") { e.preventDefault(); setDialog("goal"); }
      else if (key === "y") { e.preventDefault(); setDialog("yellow"); }
      else if (key === "r") { e.preventDefault(); setDialog("red"); }
      else if (key === "s") { e.preventDefault(); setDialog("substitution"); }
      else if (key === " ") { e.preventDefault(); setStatus(data?.fixture.status === "LIVE" ? "PAUSED" : "LIVE"); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialog, data?.fixture.status, undoLast, setStatus]);

  const handleDeleteEvent = useCallback((event: TimelineEvent) => {
    const typeMap: Record<string, "goal" | "assist" | "card" | "substitution" | "note"> = {
      "goal": "goal", "own-goal": "goal", "penalty": "goal",
      "yellow": "card", "red": "card",
      "substitution": "substitution",
      "var": "note", "missed-penalty": "note",
    };
    const type = typeMap[event.kind];
    setConfirm({
      title: `Delete ${event.kind.replace("-", " ")}?`,
      description: "This permanently removes the event from the match.",
      destructive: true,
      onConfirm: () => runAction(() => liveMatchApi.removeEvent(fixtureId, type, event.id), "Event deleted", undefined),
    });
  }, [fixtureId, runAction]);

  const handleUndoEvent = useCallback((event: TimelineEvent) => {
    const typeMap: Record<string, "goal" | "assist" | "card" | "substitution" | "note"> = {
      "goal": "goal", "own-goal": "goal", "penalty": "goal",
      "yellow": "card", "red": "card",
      "substitution": "substitution",
      "var": "note", "missed-penalty": "note",
    };
    const type = typeMap[event.kind];
    setConfirm({
      title: `Undo ${event.kind.replace("-", " ")}?`,
      description: "The event will be removed and the score/timeline/player stats restored.",
      destructive: true,
      onConfirm: () => runAction(() => liveMatchApi.removeEvent(fixtureId, type, event.id), "Event undone", undefined),
    });
  }, [fixtureId, runAction]);

  const handleCopyEvent = useCallback((event: TimelineEvent) => {
    const text = `${event.minute}' ${event.kind.replace("-", " ").toUpperCase()}${event.player ? ` — ${event.player.firstName} ${event.player.lastName}` : ""}`;
    navigator.clipboard?.writeText(text).then(() => toast("Copied to clipboard", text, "info")).catch(() => {});
  }, []);

  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="flex items-center gap-3 rounded-xl bg-background px-6 py-4 text-sm text-muted-foreground shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading live match…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="rounded-xl bg-background p-6 text-center shadow-xl">
          <p className="text-destructive">Failed to load live match</p>
          <button onClick={onClose} className="mt-3 rounded-lg bg-muted px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    );
  }

  const { homeTeam, awayTeam } = data;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <Toaster />
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5">
        <MatchHeader
          data={data}
          minute={minute}
          onMinuteChange={setMinute}
          onClose={onClose}
          onTogglePause={() => setStatus(data.fixture.status === "LIVE" ? "PAUSED" : "LIVE")}
          onResetTimer={() => setMinute(0)}
          timerRunning={timerRunning}
        />

        <div className="mt-4 rounded-xl border bg-card/40 p-3 sm:p-4">
          <QuickActions status={data.fixture.status} onAction={onQuickAction} disabled={busy || data.fixture.status === "COMPLETED"} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <PlayerPanel
              home={homeTeam}
              away={awayTeam}
              onDecrement={(t, p, s) => handlePlayerStat(t, p, s, "decrement")}
              onIncrement={(t, p, s) => handlePlayerStat(t, p, s, "increment")}
              subbedOffIds={subbedOffIds}
            />
          </div>
          <div className="order-1 lg:order-2">
            <Timeline
              events={events}
              homeTeamId={homeTeam.id}
              onDelete={handleDeleteEvent}
              onUndo={handleUndoEvent}
              onCopy={handleCopyEvent}
              onView={setViewingEvent}
            />
          </div>
          <div className="order-3 space-y-3">
            <StatisticsPanel fixture={data.fixture} onUpdate={handleTeamStat} />
            <ActivityFeed items={activity} />
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Shortcuts: <kbd className="rounded bg-muted px-1">G</kbd> Goal · <kbd className="rounded bg-muted px-1">Y</kbd> Yellow · <kbd className="rounded bg-muted px-1">R</kbd> Red · <kbd className="rounded bg-muted px-1">S</kbd> Sub · <kbd className="rounded bg-muted px-1">Space</kbd> Pause · <kbd className="rounded bg-muted px-1">Ctrl+Z</kbd> Undo · <kbd className="rounded bg-muted px-1">Esc</kbd> Close
        </p>
      </div>

      {/* Dialogs */}
      <GoalDialog
        open={dialog === "goal" || dialog === "own-goal" || dialog === "penalty"}
        goalType={(dialog === "own-goal" ? "own-goal" : dialog === "penalty" ? "penalty" : "goal") as GoalType}
        home={homeTeam}
        away={awayTeam}
        minute={minute}
        onClose={() => setDialog(null)}
        onConfirm={handleGoal}
      />
      <CardDialog
        open={dialog === "yellow" || dialog === "red"}
        cardType={dialog === "red" ? "red" : "yellow"}
        home={homeTeam}
        away={awayTeam}
        minute={minute}
        onClose={() => setDialog(null)}
        onConfirm={handleCard}
      />
      <SubstitutionDialog
        open={dialog === "substitution"}
        home={homeTeam}
        away={awayTeam}
        minute={minute}
        subbedOffIds={subbedOffIds}
        subbedOnIds={subbedOnIds}
        onClose={() => setDialog(null)}
        onConfirm={handleSubstitution}
      />
      <NoteDialog
        open={dialog === "var" || dialog === "missed-penalty"}
        noteType={(dialog === "missed-penalty" ? "missed-penalty" : "var") as NoteType}
        home={homeTeam}
        away={awayTeam}
        minute={minute}
        onClose={() => setDialog(null)}
        onConfirm={handleNote}
      />
      <ConfirmationModal
        open={!!confirm}
        title={confirm?.title || ""}
        description={confirm?.description}
        destructive={confirm?.destructive}
        loading={busy}
        onConfirm={async () => { const c = confirm; setConfirm(null); if (c) await c.onConfirm(); }}
        onCancel={() => setConfirm(null)}
      />
      <EventDetailsDialog
        open={!!viewingEvent}
        event={viewingEvent}
        teamName={viewingEvent?.teamId === homeTeam.id ? homeTeam.shortName || homeTeam.name : viewingEvent?.teamId === awayTeam.id ? awayTeam.shortName || awayTeam.name : undefined}
        onClose={() => setViewingEvent(null)}
      />
    </div>
  );
}
