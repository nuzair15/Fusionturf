import type { LiveMatchData, TimelineEvent, TimelineEventKind } from "@/types/live";

export function buildTimeline(data: LiveMatchData): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { goals, assists, cards, substitutions, notes } = data.matchStats;

  const assistByGoal = new Map<string, string>();
  for (const a of assists) {
    assistByGoal.set(a.id, a.player.id);
  }

  for (const g of goals) {
    let kind: TimelineEventKind = "goal";
    if (g.isOwnGoal) kind = "own-goal";
    else if (g.isPenalty) kind = "penalty";
    events.push({
      key: `goal-${g.id}`,
      id: g.id,
      kind,
      minute: g.minute,
      teamId: g.player.teamId,
      player: g.player,
    });
  }

  for (const c of cards) {
    events.push({
      key: `card-${c.id}`,
      id: c.id,
      kind: c.type === "RED" ? "red" : "yellow",
      minute: c.minute,
      teamId: c.player.teamId,
      player: c.player,
    });
  }

  for (const s of substitutions) {
    events.push({
      key: `sub-${s.id}`,
      id: s.id,
      kind: "substitution",
      minute: s.minute,
      teamId: s.playerOff.teamId,
      playerOff: s.playerOff,
      playerOn: s.playerOn,
    });
  }

  for (const n of notes) {
    const isAwardedGoal = n.type === "INFO" && n.note === "[AWARDED_GOAL]";
    events.push({
      key: `note-${n.id}`,
      id: n.id,
      kind: isAwardedGoal ? "awarded-goal" : n.type === "MISSED_PENALTY" ? "missed-penalty" : "var",
      minute: n.minute,
      teamId: n.teamId,
      player: n.player,
      note: n.note,
    });
  }

  events.sort((a, b) => b.minute - a.minute || (b.createdAt || "").localeCompare(a.createdAt || ""));
  return events;
}

export const eventKindLabel: Record<TimelineEventKind, string> = {
  goal: "GOAL",
  "awarded-goal": "AWARDED GOAL",
  "own-goal": "OWN GOAL",
  penalty: "PENALTY GOAL",
  yellow: "YELLOW CARD",
  red: "RED CARD",
  substitution: "SUBSTITUTION",
  var: "VAR",
  "missed-penalty": "MISSED PENALTY",
};
