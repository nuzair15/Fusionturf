/**
 * Shared serialization + formation detection for fixture lineups.
 *
 * The pitch uses normalised 0-100 coordinates (x = left-right, y = top-bottom),
 * so the same storage works for 5v5, 6v6, 7v7 or 11v11 without schema changes.
 */

export interface LineupRow {
  id: string;
  playerId: string;
  teamId: string;
  isStarter: boolean;
  position: string | null;
  jerseyNumber: number | null;
  role: string | null;
  xPosition: number;
  yPosition: number;
  isCaptain: boolean;
  isGoalkeeper: boolean;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    jerseyNumber: number | null;
    position: string | null;
  };
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}

export interface LineupPlayer {
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

export interface LineupTeam {
  teamId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface LineupResponse {
  fixtureId: string;
  home: LineupTeam;
  away: LineupTeam;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function formatPlayerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function serializePlayer(row: LineupRow): LineupPlayer {
  return {
    id: row.id,
    playerId: row.playerId,
    name: formatPlayerName(row.player.firstName, row.player.lastName),
    jerseyNumber: row.jerseyNumber ?? row.player.jerseyNumber ?? null,
    avatar: row.player.photoUrl ?? null,
    position: row.player.position ?? null,
    role: row.role ?? row.position ?? row.player.position ?? null,
    xPosition: clamp(row.xPosition),
    yPosition: clamp(row.yPosition),
    isCaptain: row.isCaptain,
    isGoalkeeper: row.isGoalkeeper,
    isStarter: row.isStarter,
  };
}

/**
 * Detect the formation from the starting XI's y-positions, excluding the
 * goalkeeper. Rows are ordered from own goal to opposition goal (defenders
 * first), matching how formations are conventionally written ("2-2-1").
 *
 * `reverseRows` must be true for the team defending the top half of the pitch
 * (the away team in a top-down render), because lower y = closer to their goal.
 */
export function calculateFormation(starters: LineupPlayer[], reverseRows = false): string | null {
  const outfield = starters.filter((p) => !p.isGoalkeeper);
  if (outfield.length < 2) return null;

  const sorted = [...outfield].sort((a, b) =>
    reverseRows ? b.yPosition - a.yPosition : a.yPosition - b.yPosition
  );

  const threshold = Math.max(10, (100 / Math.max(1, sorted.length)) * 0.75);
  const bands: number[] = [];
  let current: LineupPlayer[] = [];

  for (const player of sorted) {
    if (current.length === 0 || Math.abs(player.yPosition - current[current.length - 1].yPosition) <= threshold) {
      current.push(player);
    } else {
      bands.push(current.length);
      current = [player];
    }
  }
  if (current.length > 0) bands.push(current.length);

  return bands.length === 0 ? null : bands.join("-");
}

export function serializeTeamLineup(team: TeamInfo, rows: LineupRow[], reverseRows: boolean): LineupTeam {
  const starters: LineupPlayer[] = [];
  const bench: LineupPlayer[] = [];
  for (const row of rows) {
    const player = serializePlayer(row);
    if (row.isStarter) {
      starters.push(player);
    } else {
      bench.push(player);
    }
  }
  // Order the bench by jersey number so it renders predictably.
  bench.sort((a, b) => (a.jerseyNumber ?? 0) - (b.jerseyNumber ?? 0));
  return {
    teamId: team.id,
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl,
    formation: calculateFormation(starters, reverseRows),
    starters,
    bench,
  };
}
