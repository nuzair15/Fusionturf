import type { MatchStatus } from "@/types";

export const HALF_SECONDS = 30 * 60;
export const REGULATION_SECONDS = HALF_SECONDS * 2;

export function eventMinuteFromClock(seconds: number): number {
  return Math.max(0, Math.min(150, Math.floor(seconds / 60)));
}

export function matchPeriodClock(seconds: number, status: MatchStatus, halfLengthMinutes = 30): { label: string; seconds: number } {
  const elapsed = Math.max(0, Math.floor(seconds));
  const halfSeconds = Math.max(1, halfLengthMinutes) * 60;
  if (status === "EXTRA_TIME") return { label: "EXTRA TIME", seconds: elapsed };
  if (status === "PENALTIES") return { label: "PENALTIES", seconds: elapsed };
  if (status === "HALF_TIME") return { label: "HALF TIME", seconds: elapsed };
  if (elapsed >= halfSeconds) return { label: "2ND HALF", seconds: elapsed - halfSeconds };
  return { label: "1ST HALF", seconds: elapsed };
}
