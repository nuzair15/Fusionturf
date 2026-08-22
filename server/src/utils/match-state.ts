import type { MatchStatus } from "@prisma/client";

export const MATCH_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  SCHEDULED: ["LIVE", "POSTPONED", "CANCELLED"],
  LIVE: ["PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES", "COMPLETED"],
  PAUSED: ["LIVE", "HALF_TIME", "EXTRA_TIME", "PENALTIES", "COMPLETED"],
  HALF_TIME: ["LIVE", "EXTRA_TIME", "COMPLETED"],
  EXTRA_TIME: ["PAUSED", "PENALTIES", "COMPLETED"],
  PENALTIES: ["COMPLETED"],
  COMPLETED: [],
  POSTPONED: ["SCHEDULED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionMatch(from: MatchStatus, to: MatchStatus): boolean {
  return from === to || MATCH_TRANSITIONS[from].includes(to);
}

