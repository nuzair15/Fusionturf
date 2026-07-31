/**
 * Fixture lineup types. Lineups store normalised 0-100 pitch coordinates so the
 * same model supports 5v5, 6v6, 7v7 and 11v11 without schema changes.
 */

export interface FixtureLineup {
  id: string;
  fixtureId: string;
  teamId: string;
  playerId: string;
  isStarter: boolean;
  role?: string | null;
  xPosition: number;
  yPosition: number;
  isCaptain: boolean;
  isGoalkeeper: boolean;
}

export interface FixtureLineupPlayer {
  id: string;
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  avatar: string | null;
  position: string | null;
  role: string | null;
  xPosition: number;
  yPosition: number;
  isCaptain: boolean;
  isGoalkeeper: boolean;
  isStarter: boolean;
}

export interface FixtureLineupTeam {
  teamId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  formation: string | null;
  starters: FixtureLineupPlayer[];
  bench: FixtureLineupPlayer[];
}

export interface FixtureLineupResponse {
  fixtureId: string;
  home: FixtureLineupTeam;
  away: FixtureLineupTeam;
}

export interface LineupEntryInput {
  playerId: string;
  isStarter?: boolean;
  isCaptain?: boolean;
  isGoalkeeper?: boolean;
  role?: string | null;
  xPosition?: number;
  yPosition?: number;
}

export interface SaveLineupPayload {
  home: LineupEntryInput[];
  away: LineupEntryInput[];
}
