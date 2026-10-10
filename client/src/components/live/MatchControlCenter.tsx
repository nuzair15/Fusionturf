import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveMatchData, TimelineEvent } from "@/types/live";
import { liveMatchApi, type StatType } from "@/services/liveMatchApi";
import { buildTimeline } from "@/lib/liveTimeline";
import { toast, Toaster } from "@/components/ui/toast";
import { MatchHeader } from "./MatchHeader";
import { QuickActions, type QuickAction } from "./QuickActions";
import { Timeline } from "./Timeline";
import { HOME_COLOR, AWAY_COLOR } from "./Timeline";
import { PlayerPanel } from "./PlayerPanel";
import { StatisticsPanel } from "./StatisticsPanel";
import { ActivityFeed, type ActivityItem } from "./ActivityFeed";
import { GoalDialog, type GoalType } from "./GoalDialog";
import { CardDialog } from "./CardDialog";
import { NoteDialog, type NoteType } from "./NoteDialog";
import { ConfirmationModal } from "./ConfirmationModal";
import { EventDetailsDialog } from "./EventDetailsDialog";
import { PlayerStatsDialog, type PlayerStatType } from "./PlayerStatsDialog";
import { ManOfTheMatchDialog } from "./ManOfTheMatchDialog";
import { AwardedGoalDialog } from "./AwardedGoalDialog";
import { EditGoalDialog, type GoalUpdatePayload } from "./EditGoalDialog";
import { EditCardDialog, type CardUpdatePayload } from "./EditCardDialog";
import { PenaltyShootoutDialog } from "./PenaltyShootoutDialog";
import type { MatchStatus } from "@/types";
import { eventMinuteFromClock } from "@/lib/matchClock";

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

type DialogKind = "goal" | "own-goal" | "penalty" | "awarded-goal" | "yellow" | "red" | "missed-penalty" | "motm" | null;

let activityId = 1;

export function MatchControlCenter({ fixtureId, onClose, apiClient = liveMatchApi, allowReopenCompleted = false }: { fixtureId: string; onClose: () => void; apiClient?: typeof liveMatchApi; allowReopenCompleted?: boolean }) {
  const [data, setData] = useState<LiveMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [minute, setMinute] = useState(0);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [viewingEvent, setViewingEvent] = useState<TimelineEvent | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<{ playerId: string; teamId: string } | null>(null);
  const [editingGoal, setEditingGoal] = useState<TimelineEvent | null>(null);
  const [editingCard, setEditingCard] = useState<TimelineEvent | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [clockSeconds, setClockSeconds] = useState(0);
  const [correctionReason, setCorrectionReason] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [shootoutDialogOpen, setShootoutDialogOpen] = useState(false);
  const [clockDialogOpen, setClockDialogOpen] = useState(false);
  const [clockMinutes, setClockMinutes] = useState("0");
  const [clockRemainderSeconds, setClockRemainderSeconds] = useState("0");
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const correctionInputRef = useRef<HTMLInputElement>(null);
  const teamStatValues = useRef<Record<string, number>>({});
  const pendingTeamStats = useRef<Record<string, number>>({});
  const teamStatsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = `fusion-live-draft:${fixtureId}`;

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
      const res = await apiClient.fetchLiveStats(fixtureId);
      for (const [key, value] of Object.entries(res.fixture)) {
        if (typeof value === "number" && pendingTeamStats.current[key] === undefined) teamStatValues.current[key] = value;
      }
      setData(res);
      const serverSeconds = res.fixture.matchClockSeconds || 0;
      const networkSeconds = (res.fixture.status === "LIVE" || res.fixture.status === "EXTRA_TIME") && res.fixture.matchClockServerTime
        ? Math.max(0, Math.floor((Date.now() - new Date(res.fixture.matchClockServerTime).getTime()) / 1000))
        : 0;
      setClockSeconds(serverSeconds + networkSeconds);
    } catch (e: any) {
      toast("Failed to load live match", e.message, "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fixtureId]);

  const correction = useCallback(() => correctionReason.trim() || undefined, [correctionReason]);

  // Match actions are committed immediately by the API. Persist only the
  // operator's working context so an accidental mobile close cannot lose it.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved) {
        if (typeof saved.minute === "number") setMinute(saved.minute);
        if (typeof saved.correctionReason === "string") setCorrectionReason(saved.correctionReason);
        setDraftSavedAt(saved.savedAt ? new Date(saved.savedAt) : null);
      }
    } catch { /* ignore corrupt local drafts */ }
    setDraftHydrated(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftHydrated) return;
    const savedAt = new Date();
    try {
      localStorage.setItem(draftKey, JSON.stringify({ minute, correctionReason, savedAt: savedAt.toISOString() }));
      setDraftSavedAt(savedAt);
    } catch { /* storage may be unavailable */ }
  }, [draftHydrated, draftKey, minute, correctionReason]);

  const closeConsole = useCallback(() => {
    if (busy) {
      toast("Saving in progress", "Please wait for the current action to finish.", "warning");
      return;
    }
    onClose();
  }, [busy, onClose]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Poll for updates while mounted. The server calculates elapsed time from
  // matchClockStartedAt; polling keeps every operator's display aligned.
  useEffect(() => {
    const id = setInterval(() => fetchStats(true), data?.fixture.status === "LIVE" || data?.fixture.status === "EXTRA_TIME" ? 2000 : 5000);
    return () => clearInterval(id);
  }, [fetchStats, data?.fixture.status]);

  // Keep timer running only while status is LIVE.
  useEffect(() => {
    setTimerRunning(data?.fixture.status === "LIVE" || data?.fixture.status === "EXTRA_TIME");
  }, [data?.fixture.status]);

  // Smoothly interpolate the server-owned clock between polls and use its
  // cumulative minute for every newly recorded event.
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setClockSeconds((current) => current + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    setMinute(eventMinuteFromClock(clockSeconds));
  }, [clockSeconds]);

  useEffect(() => () => {
    if (fetchRef.current) clearTimeout(fetchRef.current);
    if (teamStatsTimer.current) clearTimeout(teamStatsTimer.current);
  }, []);

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

  const setStatus = useCallback((status: MatchStatus, statusCorrectionReason?: string) => {
    return runAction(() => apiClient.setStatus(fixtureId, status, statusCorrectionReason), `Match ${status === "LIVE" ? "started/resumed" : status.toLowerCase().replace("_", " ")}`);
  }, [fixtureId, runAction]);

  const subbedOffIds = useMemo(() => {
    const set = new Set<string>();
    data?.matchStats.substitutions.forEach((s) => set.add(s.playerOff.id));
    return set;
  }, [data]);
  const events = useMemo(() => (data ? buildTimeline(data) : []), [data]);

  const openClockDialog = useCallback(() => {
    setClockMinutes(String(Math.floor(clockSeconds / 60)));
    setClockRemainderSeconds(String(clockSeconds % 60));
    setClockDialogOpen(true);
  }, [clockSeconds]);

  const setMatchClock = useCallback(async () => {
    const minutes = Number(clockMinutes);
    const seconds = Number(clockRemainderSeconds);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 300 || !Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
      toast("Invalid clock time", "Use 0–300 minutes and 0–59 seconds.", "warning");
      return;
    }
    const total = minutes * 60 + seconds;
    const result = await runAction(() => apiClient.setClock(fixtureId, total), `Match clock set to ${minutes}:${String(seconds).padStart(2, "0")}`);
    if (result) {
      setClockSeconds(total);
      setMinute(Math.floor(total / 60));
      setClockDialogOpen(false);
    }
  }, [apiClient, clockMinutes, clockRemainderSeconds, fixtureId, runAction]);

  const undoLast = useCallback(() => {
    if (undoStack.length === 0) { toast("Nothing to undo", undefined, "warning"); return; }
    const last = undoStack[0];
    setConfirm({
      title: `Undo "${last.label}"?`,
      description: "The event will be removed and the score/timeline/player stats restored.",
      destructive: true,
      onConfirm: () => runAction(() => apiClient.removeEvent(fixtureId, last.type, last.id, correction()), "Event undone", undefined).then(() => setUndoStack((x) => x.slice(1))),
    });
  }, [correction, undoStack, fixtureId, runAction]);

  const onQuickAction = useCallback((action: QuickAction) => {
    switch (action) {
      case "goal": setDialog("goal"); break;
      case "awarded-goal": setDialog("awarded-goal"); break;
      case "own-goal": setDialog("own-goal"); break;
      case "penalty": setDialog("penalty"); break;
      case "yellow": setDialog("yellow"); break;
      case "red": setDialog("red"); break;
      case "motm": setDialog("motm"); break;
      case "missed-penalty": setDialog("missed-penalty"); break;
      case "start": setStatus("LIVE"); break;
      case "resume": setStatus(data?.fixture.halfLengthMinutes && clockSeconds >= data.fixture.halfLengthMinutes * 120 ? "EXTRA_TIME" : "LIVE"); break;
      case "pause": setStatus("PAUSED"); break;
      case "half-time": setStatus("HALF_TIME"); break;
      case "extra-time": setStatus("EXTRA_TIME"); break;
      case "shootout": setConfirm({ title: "Start the penalty shootout?", description: "The match will remain live in penalty-shootout mode until you enter the shootout result.", onConfirm: () => setStatus("PENALTIES") }); break;
      case "finish-shootout": setShootoutDialogOpen(true); break;
      case "full-time":
        setConfirm({ title: "End the match?", description: "The final result will be processed and standings/player stats updated.", destructive: true, onConfirm: () => setStatus("COMPLETED") });
        break;
      case "undo": undoLast(); break;
    }
  }, [clockSeconds, data?.fixture.halfLengthMinutes, setStatus, undoLast]);

  const handleGoal = useCallback(async (payload: { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal: boolean; isPenalty: boolean }) => {
    const label = payload.isOwnGoal ? "Own goal added" : payload.isPenalty ? "Penalty goal added" : "Goal added";
    const result = await runAction(
      () => apiClient.addGoal(fixtureId, { ...payload, correctionReason: correction() }),
      "Goal Added Successfully",
      { type: "goal", label }
    );
    return Boolean(result);
  }, [correction, fixtureId, runAction]);

  const handleAwardedGoal = useCallback(async (teamId: string) => {
    const result = await runAction(
      () => apiClient.addAwardedGoal(fixtureId, { teamId, minute, correctionReason: correction() }),
      "Awarded team goal added",
      { type: "note", label: "Awarded team goal" },
    );
    return Boolean(result);
  }, [correction, fixtureId, minute, runAction]);

  const handleUpdateGoal = useCallback(async (goalId: string, payload: GoalUpdatePayload) => {
    const result = await runAction(
      () => apiClient.updateGoal(fixtureId, goalId, { ...payload, correctionReason: correction() }),
      "Goal updated",
    );
    return Boolean(result);
  }, [correction, fixtureId, runAction]);

  const handleCard = useCallback(async (payload: { teamId: string; playerId: string; cardType: "yellow" | "red"; minute: number }) => {
    const statType: StatType = payload.cardType === "yellow" ? "yellowCard" : "redCard";
    const label = payload.cardType === "yellow" ? "Yellow card added" : "Red card added";
    const result = await runAction(
      () => apiClient.updateLiveStat(fixtureId, { playerId: payload.playerId, statType, teamId: payload.teamId, action: "increment", minute: payload.minute, correctionReason: correction() }),
      payload.cardType === "yellow" ? "Yellow card given" : "Red card given",
      { type: "card", label }
    );
    return Boolean(result);
  }, [correction, fixtureId, runAction]);

  const handleUpdateCard = useCallback(async (cardId: string, payload: CardUpdatePayload) => {
    const result = await runAction(
      () => apiClient.updateCard(fixtureId, cardId, { ...payload, correctionReason: correction() }),
      "Card updated",
    );
    return Boolean(result);
  }, [correction, fixtureId, runAction]);

  const handleNote = useCallback(async (payload: { teamId?: string; playerId?: string; type: "VAR" | "MISSED_PENALTY"; minute: number; note?: string }) => {
    const label = payload.type === "VAR" ? "VAR review logged" : "Missed penalty logged";
    await runAction(
      () => apiClient.addNote(fixtureId, { ...payload, correctionReason: correction() }),
      payload.type === "VAR" ? "VAR review logged" : "Missed penalty logged",
      { type: "note", label }
    );
  }, [fixtureId, runAction]);

  const handleTeamStat = useCallback((field: string, delta: number) => {
    const nextValue = Math.max(0, (teamStatValues.current[field] ?? 0) + delta);
    teamStatValues.current[field] = nextValue;
    setData((current) => {
      if (!current) return current;
      const nextFixture = { ...current.fixture, [field]: nextValue };
      if (field.toLowerCase().includes("possession")) {
        const opposite = field.startsWith("home") ? field.replace("home", "away") : field.replace("away", "home");
        const oppositeValue = Math.max(0, 100 - nextValue);
        teamStatValues.current[opposite] = oppositeValue;
        nextFixture[opposite as keyof typeof nextFixture] = oppositeValue as never;
      }
      return { ...current, fixture: nextFixture };
    });
    pendingTeamStats.current[field] = nextValue;
    if (field.toLowerCase().includes("possession")) {
      const opposite = field.startsWith("home") ? field.replace("home", "away") : field.replace("away", "home");
      pendingTeamStats.current[opposite] = Math.max(0, 100 - pendingTeamStats.current[field]);
    }
    if (teamStatsTimer.current) clearTimeout(teamStatsTimer.current);
    teamStatsTimer.current = setTimeout(async () => {
      const body = { ...pendingTeamStats.current, correctionReason: correction() || "" };
      pendingTeamStats.current = {};
      try {
        await apiClient.updateTeamStats(fixtureId, body);
        await fetchStats(true);
        toast("Team stats saved", undefined, "success");
      } catch (error: any) {
        toast("Team stats save failed", error.message, "error");
        await fetchStats(true);
      }
    }, 1500);
  }, [correction, fetchStats, fixtureId]);

  const handleAppearance = useCallback((teamId: string, player: LiveMatchData["homeTeam"]["players"][number]) => {
    return runAction(
      () => apiClient.recordAppearance(fixtureId, { playerId: player.id, teamId, minute, isStarter: player.isStarter === true, correctionReason: correction() }),
      `${player.firstName} ${player.lastName} marked as appeared`,
      undefined,
    );
  }, [correction, fixtureId, minute, runAction]);

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
      else if (key === " ") { e.preventDefault(); setStatus(data?.fixture.status === "LIVE" || data?.fixture.status === "EXTRA_TIME" ? "PAUSED" : data?.fixture.halfLengthMinutes && clockSeconds >= data.fixture.halfLengthMinutes * 120 ? "EXTRA_TIME" : "LIVE"); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [clockSeconds, dialog, data?.fixture.status, data?.fixture.halfLengthMinutes, undoLast, setStatus]);

  const handleDeleteEvent = useCallback((event: TimelineEvent) => {
    if (data?.fixture.status === "COMPLETED" && !correction()) {
      toast("Correction reason required", "Enter a reason above before deleting the goal.", "warning");
      correctionInputRef.current?.focus();
      correctionInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const typeMap: Record<string, "goal" | "assist" | "card" | "substitution" | "note"> = {
      "goal": "goal", "own-goal": "goal", "penalty": "goal", "awarded-goal": "note",
      "yellow": "card", "red": "card",
      "substitution": "substitution",
      "var": "note", "missed-penalty": "note",
    };
    const type = typeMap[event.kind];
    setConfirm({
      title: `Delete ${event.kind.replace("-", " ")}?`,
      description: "This permanently removes the event from the match.",
      destructive: true,
      onConfirm: () => runAction(() => apiClient.removeEvent(fixtureId, type, event.id, correction()), "Event deleted", undefined),
    });
  }, [correction, data?.fixture.status, fixtureId, runAction]);

  const handleUndoEvent = useCallback((event: TimelineEvent) => {
    const typeMap: Record<string, "goal" | "assist" | "card" | "substitution" | "note"> = {
      "goal": "goal", "own-goal": "goal", "penalty": "goal", "awarded-goal": "note",
      "yellow": "card", "red": "card",
      "substitution": "substitution",
      "var": "note", "missed-penalty": "note",
    };
    const type = typeMap[event.kind];
    setConfirm({
      title: `Undo ${event.kind.replace("-", " ")}?`,
      description: "The event will be removed and the score/timeline/player stats restored.",
      destructive: true,
      onConfirm: () => runAction(() => apiClient.removeEvent(fixtureId, type, event.id, correction()), "Event undone", undefined),
    });
  }, [correction, fixtureId, runAction]);

  const handleCopyEvent = useCallback((event: TimelineEvent) => {
    const text = `${event.minute}' ${event.kind.replace("-", " ").toUpperCase()}${event.player ? ` — ${event.player.firstName} ${event.player.lastName}` : ""}`;
    navigator.clipboard?.writeText(text).then(() => toast("Copied to clipboard", text, "info")).catch(() => {});
  }, []);

  const handleEventStatChange = useCallback((statType: PlayerStatType, action: "increment" | "decrement") => {
    const target = editingPlayer;
    if (!target) return;
    return runAction(
      () => apiClient.updateLiveStat(fixtureId, { playerId: target.playerId, statType, teamId: target.teamId, action, minute, correctionReason: correction() }),
      `${statType} ${action === "increment" ? "increased" : "decreased"}`,
      action === "increment" ? { type: statType === "goal" ? "goal" : statType === "assist" ? "assist" : "card", label: `${statType} updated` } : undefined
    );
  }, [correction, editingPlayer, fixtureId, minute, runAction]);

  const handleSetRating = useCallback((rating: number) => {
    const target = editingPlayer;
    if (!target) return;
    return runAction(
      () => apiClient.setMatchRating(fixtureId, { playerId: target.playerId, rating, correctionReason: correction() }),
      `Rating set to ${rating.toFixed(1)}`,
      undefined
    );
  }, [correction, editingPlayer, fixtureId, runAction]);

  const handleSetMotm = useCallback((playerId: string | null) => {
    return runAction(
      () => apiClient.setManOfTheMatch(fixtureId, { playerId: playerId || undefined, correctionReason: correction() }),
      playerId ? "Man of the Match set" : "Man of the Match cleared",
      undefined
    );
  }, [correction, fixtureId, runAction]);

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
          onClose={closeConsole}
          onTogglePause={() => setStatus(data.fixture.status === "LIVE" || data.fixture.status === "EXTRA_TIME" ? "PAUSED" : data.fixture.halfLengthMinutes && clockSeconds >= data.fixture.halfLengthMinutes * 120 ? "EXTRA_TIME" : "LIVE")}
          onResetTimer={() => runAction(() => apiClient.resetClock(fixtureId), "Match clock reset").then(result => { if (result) { setMinute(0); setClockSeconds(0); } })}
          onSetTimer={openClockDialog}
          clockSeconds={clockSeconds}
          timerRunning={timerRunning}
        />
        {clockDialogOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="set-clock-title">
          <div className="w-full max-w-sm rounded-xl border bg-background p-5 text-foreground shadow-2xl">
            <h2 id="set-clock-title" className="text-lg font-bold">Set match clock</h2>
            <p className="mt-1 text-sm text-muted-foreground">Jump to an exact elapsed match time. A running clock continues from the new value.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Minutes<input type="number" min="0" max="300" step="1" value={clockMinutes} onChange={event => setClockMinutes(event.target.value)} className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2" /></label>
              <label className="text-sm font-medium">Seconds<input type="number" min="0" max="59" step="1" value={clockRemainderSeconds} onChange={event => setClockRemainderSeconds(event.target.value)} className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setClockDialogOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void setMatchClock()}>Set clock</Button></div>
          </div>
        </div>}
        {data.fixture.halfLengthMinutes && <p className="mt-2 rounded-lg border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
          {data.fixture.lineupSize} a side · Half time at {data.fixture.halfLengthMinutes}' · Full time at {data.fixture.halfLengthMinutes * 2}' · {data.fixture.halftimeBreakMinutes} minute break
        </p>}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Match status", value: data.fixture.status.replace("_", " "), tone: "text-emerald-700" },
            { label: "Shots on target", value: `${data.fixture.homeShotsOnTarget ?? 0} – ${data.fixture.awayShotsOnTarget ?? 0}`, tone: "text-blue-700" },
            { label: "Total shots", value: `${data.fixture.homeShots ?? 0} – ${data.fixture.awayShots ?? 0}`, tone: "text-violet-700" },
            { label: "Save state", value: draftSavedAt ? "Saved" : "Ready", tone: "text-emerald-700" },
          ].map((item) => <div key={item.label} className="rounded-xl border bg-card px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className={`mt-0.5 text-sm font-black ${item.tone}`}>{item.value}</p>
          </div>)}
        </div>

        <div className="mt-4 rounded-xl border bg-card/40 p-3 sm:p-4">
          <QuickActions status={data.fixture.status} onAction={onQuickAction} disabled={busy} allowsDecider={!!data.fixture.isGrandFinal || !!data.fixture.hasKnockoutBracket} />
        </div>

        {data.fixture.status === "COMPLETED" && <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
          <p className="text-sm font-bold">Correct completed match</p>
          <p className="mt-1 text-xs text-muted-foreground">1. Enter a reason. 2. Open the incorrect goal's three-dot menu in the timeline and delete it. 3. Once the score is tied, save the penalty score below.</p>
          <label className="mt-3 block text-sm font-medium" htmlFor="fixture-correction-reason">Correction reason</label>
          <input ref={correctionInputRef} id="fixture-correction-reason" className="mt-2 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Example: Incorrect goal recorded after full time" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {allowReopenCompleted && <Button
              type="button"
              disabled={busy || !correction()}
              onClick={() => {
                const reason = correctionReason.trim();
                if (!reason) {
                  correctionInputRef.current?.focus();
                  return;
                }
                setConfirm({
                  title: "Reopen this match?",
                  description: "The match will return to Live at its current clock and score. Its winner will be cleared until you finish it again.",
                  onConfirm: () => setStatus("LIVE", reason),
                });
              }}
            >
              Reopen match
            </Button>}
            {(data.fixture.isGrandFinal || data.fixture.hasKnockoutBracket) && (
              <Button
                type="button"
                disabled={busy || !correction() || data.fixture.homeScore !== data.fixture.awayScore}
                onClick={() => setShootoutDialogOpen(true)}
              >
                Set / correct penalty result
              </Button>
            )}
            {data.fixture.homeScore !== data.fixture.awayScore && <p className="text-xs font-medium text-amber-800">Delete the incorrect goal first so the match score is tied.</p>}
            {!correction() && <p className="text-xs font-medium text-amber-800">A correction reason is required.</p>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Every correction is audited, and standings, player statistics, the champion, and public match result are recalculated.</p>
        </div>}

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <PlayerPanel
              home={homeTeam}
              away={awayTeam}
              onPickHome={(p) => setEditingPlayer({ playerId: p.id, teamId: homeTeam.id })}
              onPickAway={(p) => setEditingPlayer({ playerId: p.id, teamId: awayTeam.id })}
              onAppearance={handleAppearance}
              subbedOffIds={subbedOffIds}
            />
          </div>
          <div className="order-1 lg:order-2">
            <Timeline
              events={events}
              homeTeamId={homeTeam.id}
              awayTeamId={awayTeam.id}
              homeName={homeTeam.shortName || homeTeam.name}
              awayName={awayTeam.shortName || awayTeam.name}
              onDelete={handleDeleteEvent}
              onUndo={handleUndoEvent}
              onCopy={handleCopyEvent}
              onView={setViewingEvent}
              onEditStats={(e) => e.player && e.teamId && setEditingPlayer({ playerId: e.player.id, teamId: e.teamId })}
              onEditGoal={setEditingGoal}
              onEditCard={setEditingCard}
            />
          </div>
          <div className="order-3 space-y-3">
            <StatisticsPanel fixture={data.fixture} onUpdate={handleTeamStat} />
            <ActivityFeed items={activity} />
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Shortcuts: <kbd className="rounded bg-muted px-1">G</kbd> Goal · <kbd className="rounded bg-muted px-1">Y</kbd> Yellow · <kbd className="rounded bg-muted px-1">R</kbd> Red · <kbd className="rounded bg-muted px-1">Space</kbd> Pause · <kbd className="rounded bg-muted px-1">Ctrl+Z</kbd> Undo · <kbd className="rounded bg-muted px-1">Esc</kbd> Close
        </p>
      </div>

      {/* Dialogs */}
      <PenaltyShootoutDialog
        open={shootoutDialogOpen}
        home={homeTeam}
        away={awayTeam}
        busy={busy}
        initialHomeScore={data.fixture.penaltiesHomeScore ?? 0}
        initialAwayScore={data.fixture.penaltiesAwayScore ?? 0}
        correction={data.fixture.status === "COMPLETED"}
        onClose={() => setShootoutDialogOpen(false)}
        onConfirm={async (result) => {
          const saved = await runAction(() => apiClient.completePenaltyShootout(fixtureId, {
            homeScore: data.fixture.homeScore ?? 0,
            awayScore: data.fixture.awayScore ?? 0,
            reason: correction(),
            version: data.fixture.version,
            ...result,
          }), "Penalty shootout result saved");
          if (saved) setShootoutDialogOpen(false);
        }}
      />
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
      <NoteDialog
        open={dialog === "missed-penalty"}
        noteType={"missed-penalty" as NoteType}
        home={homeTeam}
        away={awayTeam}
        minute={minute}
        onClose={() => setDialog(null)}
        onConfirm={handleNote}
      />
      <AwardedGoalDialog
        open={dialog === "awarded-goal"}
        home={homeTeam}
        away={awayTeam}
        minute={minute}
        onClose={() => setDialog(null)}
        onConfirm={handleAwardedGoal}
      />
      <ManOfTheMatchDialog
        open={dialog === "motm"}
        home={homeTeam}
        away={awayTeam}
        selectedId={data.fixture.manOfTheMatchId}
        onClose={() => setDialog(null)}
        onSelect={async (playerId) => { const result = await handleSetMotm(playerId); if (result) setDialog(null); }}
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
      <PlayerStatsDialog
        open={!!editingPlayer}
        playerId={editingPlayer?.playerId ?? null}
        teamId={editingPlayer?.teamId ?? null}
        home={homeTeam}
        away={awayTeam}
        stripColor={editingPlayer?.teamId === homeTeam.id ? HOME_COLOR : editingPlayer?.teamId === awayTeam.id ? AWAY_COLOR : undefined}
        manOfTheMatchId={data.fixture.manOfTheMatchId}
        ratings={data.fixture.matchPlayerRatings}
        onClose={() => setEditingPlayer(null)}
        onUpdateStat={handleEventStatChange}
        onSetRating={handleSetRating}
        onSetMotm={handleSetMotm}
      />
      <EditGoalDialog
        event={editingGoal}
        home={homeTeam}
        away={awayTeam}
        onClose={() => setEditingGoal(null)}
        onConfirm={handleUpdateGoal}
      />
      <EditCardDialog
        event={editingCard}
        home={homeTeam}
        away={awayTeam}
        onClose={() => setEditingCard(null)}
        onConfirm={handleUpdateCard}
      />
    </div>
  );
}
