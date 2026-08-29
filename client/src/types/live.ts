import type { MatchStatus } from "@/types";

export interface LivePlayer {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  position?: string;
  photoUrl?: string;
  squadType?: string;
  inLineup?: boolean;
  isStarter?: boolean;
  isCaptain?: boolean;
  isGoalkeeper?: boolean;
  role?: string | null;
  stats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
  };
  appearance?: { isStarter: boolean; enteredAt?: number | null } | null;
}

export interface LiveTeam {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  players: LivePlayer[];
}

export interface LiveEventPlayer {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  jerseyNumber?: number;
  position?: string;
  teamId?: string;
}

export interface LiveGoal {
  id: string;
  minute: number;
  teamId?: string;
  isOwnGoal: boolean;
  isPenalty: boolean;
  player: LiveEventPlayer;
}

export interface LiveAssist {
  id: string;
  goalId?: string;
  minute: number;
  player: LiveEventPlayer;
}

export interface LiveCard {
  id: string;
  minute: number;
  type: "YELLOW" | "RED" | "SECOND_YELLOW";
  reason?: string;
  player: LiveEventPlayer;
}

export interface LiveSubstitution {
  id: string;
  minute: number;
  playerOff: LiveEventPlayer;
  playerOn: LiveEventPlayer;
}

export interface LiveNote {
  id: string;
  minute: number;
  type: "VAR" | "MISSED_PENALTY" | "INFO";
  note?: string;
  teamId?: string;
  player?: LiveEventPlayer;
}

export interface LiveFixtureInfo {
  id: string;
  matchDate: string;
  status: MatchStatus;
  matchClockSeconds?: number;
  kickoffTime?: string;
  competition?: { name: string };
  round?: number;
  stadium?: string;
  homeScore?: number;
  awayScore?: number;
  homePossession?: number;
  awayPossession?: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeCorners?: number;
  awayCorners?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeOffsides?: number;
  awayOffsides?: number;
  homeExpectedGoals?: number;
  awayExpectedGoals?: number;
  matchClockServerTime?: string;
  manOfTheMatchId?: string | null;
  matchPlayerRatings?: Record<string, number>;
}

export interface LiveMatchData {
  fixture: LiveFixtureInfo;
  homeTeam: LiveTeam;
  awayTeam: LiveTeam;
  matchStats: {
    goals: LiveGoal[];
    assists: LiveAssist[];
    cards: LiveCard[];
    substitutions: LiveSubstitution[];
    notes: LiveNote[];
  };
}

export type TimelineEventKind = "goal" | "awarded-goal" | "own-goal" | "penalty" | "yellow" | "red" | "substitution" | "var" | "missed-penalty";

export interface TimelineEvent {
  key: string;
  id: string;
  kind: TimelineEventKind;
  minute: number;
  teamId?: string;
  player?: LiveEventPlayer;
  playerOn?: LiveEventPlayer;
  playerOff?: LiveEventPlayer;
  note?: string;
  assistPlayer?: LiveEventPlayer;
  createdAt?: string;
}
