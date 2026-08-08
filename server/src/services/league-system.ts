import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";

const DAYS = ["Friday", "Saturday", "Sunday"] as const;
const TEAM_COUNT = 6;
const MATCHES_PER_PAIR = 2;
const TOTAL_MATCHES = 30;
const LEAGUE_WEEKS = 7;
const MAX_MATCHES_PER_WEEKEND = 2;
const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

interface FixtureSlot {
  homeTeamIdx: number;
  awayTeamIdx: number;
}

function generateRoundRobinPairings(teams: number): FixtureSlot[][] {
  const rounds: FixtureSlot[][] = [];
  const n = teams % 2 === 0 ? teams : teams + 1;
  const half = n / 2;
  const teamIndices = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < n - 1; round++) {
    const fixtures: FixtureSlot[] = [];
    for (let i = 0; i < half; i++) {
      const home = teamIndices[i];
      const away = teamIndices[n - 1 - i];
      if (home < teams && away < teams) {
        fixtures.push(round % 2 === 0
          ? { homeTeamIdx: home, awayTeamIdx: away }
          : { homeTeamIdx: away, awayTeamIdx: home }
        );
      }
    }
    rounds.push(fixtures);
    teamIndices.splice(1, 0, teamIndices.pop()!);
  }

  return rounds;
}

export async function generateSeasonFixtures(seasonId: string, options?: {
  teamCount?: number;
  leagueWeeks?: number;
  matchesPerPair?: number;
  startDate?: string;
  fixtureDays?: string[];
}): Promise<{ generated: number }> {
  const teams = await prisma.team.findMany({ where: { seasonId, isActive: true }, orderBy: { name: "asc" } });

  const teamCount = options?.teamCount || TEAM_COUNT;
  const leagueWeeks = options?.leagueWeeks || LEAGUE_WEEKS;
  const matchesPerPair = options?.matchesPerPair || MATCHES_PER_PAIR;

  if (teams.length !== teamCount) {
    throw new Error(`Exactly ${teamCount} teams required, got ${teams.length}`);
  }

  await prisma.fixture.deleteMany({ where: { seasonId, isGrandFinal: false, isRelegationPlayoff: false } });

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Season not found");

  const seasonStart = options?.startDate ? new Date(options.startDate) : new Date(season.startDate);
  const weekDays = (options?.fixtureDays?.length ? options.fixtureDays : (season.fixtureDays || "Friday,Saturday,Sunday").split(",")).map((d) => d.trim());
  const firstMatchDay = findNextDay(seasonStart, weekDays[0]);

  const firstLeg = generateRoundRobinPairings(teamCount);
  const secondLeg = matchesPerPair >= 2 ? firstLeg.map((round) =>
    round.map((f) => ({ homeTeamIdx: f.awayTeamIdx, awayTeamIdx: f.homeTeamIdx }))
  ) : [];
  const allRounds = [...firstLeg, ...secondLeg];

  const fixtures: Array<{
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
    matchDate: Date;
    leagueWeek: number;
    round: number;
    status: "SCHEDULED";
  }> = [];

  let matchDay = new Date(firstMatchDay);

  for (let week = 0; week < leagueWeeks; week++) {
    const roundIdx = week < allRounds.length ? week : -1;
    if (roundIdx === -1) break;

    const roundFixtures = allRounds[roundIdx];
    const weekendDays = weekDays.slice(0, Math.min(weekDays.length, roundFixtures.length));

    const fixturesPerDay = Math.ceil(roundFixtures.length / weekendDays.length);
    let fixtureIdx = 0;

    for (const dayName of weekendDays) {
      const dayDate = findNextDay(matchDay, dayName);
      for (let i = 0; i < fixturesPerDay && fixtureIdx < roundFixtures.length; i++) {
        const f = roundFixtures[fixtureIdx];
        fixtures.push({
          seasonId,
          homeTeamId: teams[f.homeTeamIdx].id,
          awayTeamId: teams[f.awayTeamIdx].id,
          matchDate: new Date(dayDate),
          leagueWeek: week + 1,
          round: roundIdx + 1,
          status: "SCHEDULED",
        });
        fixtureIdx++;
      }
    }

    matchDay.setDate(matchDay.getDate() + 7);
  }

  await prisma.fixture.createMany({ data: fixtures });

  await recalculateStandings(seasonId);

  return { generated: fixtures.length };
}

function findNextDay(from: Date, targetDay: string): Date {
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const target = dayMap[targetDay.toLowerCase()];
  if (target === undefined) return new Date(from);
  const d = new Date(from);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
  return d;
}

// Fixtures that count toward league standings and player statistics: completed,
// not friendly (flag or FRIENDLY-type competition), and not post-season knockout
// games. Used both when recomputing tables and when filtering goals/assists/cards.
function countedFixturesWhere(seasonId: string): Prisma.FixtureWhereInput {
  return {
    seasonId,
    status: "COMPLETED",
    isFriendly: false,
    OR: [{ competitionId: null }, { competition: { is: { type: { not: "FRIENDLY" } } } }],
    isGrandFinal: false,
    isRelegationPlayoff: false,
  };
}

export async function recalculateStandings(seasonId: string): Promise<void> {
  const fixtures = await prisma.fixture.findMany({
    where: countedFixturesWhere(seasonId),
  });

  const teams = await prisma.team.findMany({ where: { seasonId, isActive: true } });
  const teamIds = teams.map((t) => t.id);

  const stats: Record<string, { played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; pts: number }> = {};

  for (const id of teamIds) {
    stats[id] = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  }

  for (const f of fixtures) {
    if (f.homeScore === null || f.awayScore === null) continue;
    const h = stats[f.homeTeamId];
    const a = stats[f.awayTeamId];
    h.played++;
    a.played++;
    h.gf += f.homeScore;
    h.ga += f.awayScore;
    a.gf += f.awayScore;
    a.ga += f.homeScore;
    if (f.homeScore > f.awayScore) { h.wins++; a.losses++; h.pts += POINTS_WIN; }
    else if (f.homeScore < f.awayScore) { a.wins++; h.losses++; a.pts += POINTS_WIN; }
    else { h.draws++; a.draws++; h.pts += POINTS_DRAW; a.pts += POINTS_DRAW; }
  }

  for (const id of teamIds) {
    stats[id].gd = stats[id].gf - stats[id].ga;
  }

  const headToHead = calculateHeadToHead(fixtures, teamIds);

  const sorted = teamIds.slice().sort((a, b) => {
    if (stats[a].pts !== stats[b].pts) return stats[b].pts - stats[a].pts;
    const h2h = headToHead[a]?.[b] || 0;
    if (h2h !== 0) return h2h;
    if (stats[a].gd !== stats[b].gd) return stats[b].gd - stats[a].gd;
    if (stats[a].gf !== stats[b].gf) return stats[b].gf - stats[a].gf;
    return a.localeCompare(b);
  });

  const standingsData = sorted.map((teamId, idx) => {
    const s = stats[teamId];
    const teamFixtures = fixtures.filter((f) => f.homeTeamId === teamId || f.awayTeamId === teamId)
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
      .slice(-5);
    const form = teamFixtures.map((f) => {
      if (f.homeScore === null || f.awayScore === null) return "";
      const isHome = f.homeTeamId === teamId;
      const teamScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      if (teamScore > oppScore) return "W";
      if (teamScore < oppScore) return "L";
      return "D";
    }).join("");

    return {
      seasonId,
      teamId,
      position: idx + 1,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      goalsFor: s.gf,
      goalsAgainst: s.ga,
      goalDifference: s.gd,
      points: s.pts,
      form,
    };
  });

  for (const data of standingsData) {
    await prisma.standing.upsert({
      where: { seasonId_teamId: { seasonId, teamId: data.teamId } },
      create: data,
      update: data,
    });
  }
}

function calculateHeadToHead(fixtures: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }>, teamIds: string[]): Record<string, Record<string, number>> {
  const h2h: Record<string, Record<string, number>> = {};
  for (const id of teamIds) h2h[id] = {};
  for (const f of fixtures) {
    if (f.homeScore === null || f.awayScore === null) continue;
    const homePts = f.homeScore > f.awayScore ? 3 : f.homeScore === f.awayScore ? 1 : 0;
    const awayPts = f.awayScore > f.homeScore ? 3 : f.homeScore === f.awayScore ? 1 : 0;
    h2h[f.homeTeamId][f.awayTeamId] = (h2h[f.homeTeamId][f.awayTeamId] || 0) + homePts;
    h2h[f.awayTeamId][f.homeTeamId] = (h2h[f.awayTeamId][f.homeTeamId] || 0) + awayPts;
  }
  return h2h;
}

export async function processMatchResult(fixtureId: string, homeScore: number, awayScore: number): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, include: { season: true } });
  if (!fixture) throw new Error("Fixture not found");
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) throw new Error("Scores must be non-negative integers");
  if (fixture.status === "CANCELLED" || fixture.status === "POSTPONED") throw new Error("Cancelled or postponed fixtures cannot be completed");

  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { homeScore, awayScore, status: "COMPLETED" },
  });

  await recalculateStandings(fixture.seasonId);

  // Gate suspension processing on a persisted flag rather than "was the
  // fixture already COMPLETED before this call" — the latter is only true
  // the very first time processMatchResult runs for a fixture. If a later
  // step in this pipeline (player stats / awards) throws and the caller
  // retries, the fixture is by then already COMPLETED, so that check would
  // silently skip suspension processing forever even though it never
  // actually ran. This flag is only set after serveSuspension/
  // processSuspensions both succeed, so a retry correctly re-attempts them.
  if (!fixture.suspensionsProcessedAt) {
    await serveSuspension(fixtureId);
    await processSuspensions(fixtureId);
    await prisma.fixture.update({ where: { id: fixtureId }, data: { suspensionsProcessedAt: new Date() } });
  }

  await recalculatePlayerStats(fixture.seasonId);

  await autoDetectAwards(fixture.seasonId);
}

export async function generatePostSeasonFixtures(seasonId: string): Promise<void> {
  const standings = await prisma.standing.findMany({
    where: { seasonId },
    orderBy: { position: "asc" },
    include: { team: true },
  });

  if (standings.length < 6) throw new Error("Need at least 6 teams for post-season");

  const firstPlace = standings[0].team;
  const secondPlace = standings[1].team;
  const fifthPlace = standings[4].team;
  const sixthPlace = standings[5].team;

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Season not found");
  const seasonEnd = new Date(season.endDate);

  const grandFinalDate = new Date(seasonEnd);
  grandFinalDate.setDate(grandFinalDate.getDate() + 7);

  await prisma.fixture.create({
    data: {
      seasonId,
      homeTeamId: firstPlace.id,
      awayTeamId: secondPlace.id,
      matchDate: grandFinalDate,
      leagueWeek: 8,
      round: 99,
      isGrandFinal: true,
      status: "SCHEDULED",
    },
  });

  const playoffDate = new Date(grandFinalDate);
  playoffDate.setDate(playoffDate.getDate() + 3);

  await prisma.fixture.create({
    data: {
      seasonId,
      homeTeamId: fifthPlace.id,
      awayTeamId: sixthPlace.id,
      matchDate: playoffDate,
      leagueWeek: 8,
      round: 99,
      isRelegationPlayoff: true,
      status: "SCHEDULED",
    },
  });
}

export async function openTransferWindow(seasonId: string, days: number = 7): Promise<void> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  await prisma.season.update({
    where: { id: seasonId },
    data: { transferWindowOpen: true, transferWindowStartsAt: now, transferWindowEndsAt: end },
  });
}

export async function closeTransferWindow(seasonId: string): Promise<void> {
  await prisma.season.update({
    where: { id: seasonId },
    data: { transferWindowOpen: false, transferWindowStartsAt: null, transferWindowEndsAt: null },
  });
}

export async function createNextSeason(currentSeasonId: string, newSeasonName: string, newStartDate: Date, newEndDate: Date): Promise<string> {
  const currentSeason = await prisma.season.findUnique({
    where: { id: currentSeasonId },
    include: { teams: { include: { players: true } }, standings: { orderBy: { position: "asc" } } },
  });
  if (!currentSeason) throw new Error("Current season not found");

  await prisma.season.update({ where: { id: currentSeasonId }, data: { isCurrent: false } });

  const slug = newSeasonName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `season-${Date.now()}`;
  const newSeason = await prisma.season.create({
    data: {
      name: newSeasonName,
      slug,
      startDate: newStartDate,
      endDate: newEndDate,
      isActive: true,
      isCurrent: true,
      leagueWeeks: currentSeason.leagueWeeks,
      fixtureDays: currentSeason.fixtureDays,
      transferWindowOpen: false,
    },
  });

  const relegatedTeam = currentSeason.standings.find((s) => s.position === 6)?.teamId;
  const survivingTeams = currentSeason.teams.filter((t) => t.id !== relegatedTeam);

  for (const team of survivingTeams) {
    const newTeam = await prisma.team.create({
      data: {
        seasonId: newSeason.id,
        name: team.name,
        slug: `${team.slug}-${slug}`,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        coverUrl: team.coverUrl,
        city: team.city,
        homeStadium: team.homeStadium,
        isActive: true,
      },
    });

    const existingPlayers = await prisma.player.findMany({ where: { teamId: team.id, seasonId: currentSeasonId, isActive: true } });
    for (const player of existingPlayers) {
      await prisma.player.create({
        data: {
          seasonId: newSeason.id,
          teamId: newTeam.id,
          firstName: player.firstName,
          lastName: player.lastName,
          slug: `${player.slug}-${slug}`,
          nationality: player.nationality,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          photoUrl: player.photoUrl,
          squadType: player.squadType,
          isActive: true,
        },
      });
    }
  }

  return newSeason.id;
}

export async function validateSquad(teamId: string, seasonId: string): Promise<{ valid: boolean; starters: number; subs: number; reserves: number; total: number }> {
  const starters = await prisma.player.count({ where: { teamId, seasonId, squadType: "STARTER", isActive: true } });
  const subs = await prisma.player.count({ where: { teamId, seasonId, squadType: "SUBSTITUTE", isActive: true } });
  const reserves = await prisma.player.count({ where: { teamId, seasonId, squadType: "RESERVE", isActive: true } });
  return { valid: starters === 6 && subs === 2 && reserves === 4, starters, subs, reserves, total: starters + subs + reserves };
}

export async function selectMatchdaySquad(fixtureId: string, teamId: string, playerIds: string[]): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) throw new Error("Fixture not found");
  if (fixture.status !== "SCHEDULED") throw new Error("Cannot change squad for a non-scheduled fixture");

  const players = await prisma.player.findMany({ where: { id: { in: playerIds }, teamId, seasonId: fixture.seasonId, isActive: true } });
  if (players.length !== 8) throw new Error("Matchday squad must have exactly 8 players");

  const activeSuspensions = await prisma.suspension.findMany({
    where: { playerId: { in: playerIds }, isActive: true, seasonId: fixture.seasonId },
  });
  if (activeSuspensions.length > 0) {
    throw new Error(`Suspended players cannot be selected: ${activeSuspensions.map((s) => s.playerId).join(", ")}`);
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.matchdaySquad.findUnique({ where: { fixtureId_teamId: { fixtureId, teamId } } });
    if (existing) {
      await tx.matchdaySquadEntry.deleteMany({ where: { squadId: existing.id } });
      await tx.matchdaySquad.delete({ where: { id: existing.id } });
    }

    const squad = await tx.matchdaySquad.create({ data: { fixtureId, teamId } });

    await tx.matchdaySquadEntry.createMany({
      data: playerIds.map((pid, idx) => ({
        squadId: squad.id,
        playerId: pid,
        isStarter: idx < 6,
      })),
    });
  });
}

export async function processSuspensions(fixtureId: string): Promise<void> {
  const cards = await prisma.card.findMany({ where: { fixtureId }, include: { player: true } });

  for (const card of cards) {
    if (card.type === "RED" || card.type === "SECOND_YELLOW") {
      const reason = card.type === "RED" ? "STRAIGHT_RED" : "SECOND_YELLOW";
      const existing = await prisma.suspension.findFirst({
        where: { seasonId: card.player.seasonId, playerId: card.playerId, reason, isActive: true },
      });
      if (!existing) {
        await prisma.suspension.create({
          data: { seasonId: card.player.seasonId, playerId: card.playerId, reason, matchBan: 1, isActive: true },
        });
      }
    }
  }

  await checkYellowCardAccumulation(fixtureId);
}

async function checkYellowCardAccumulation(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { seasonId: true } });
  if (!fixture) return;

  const allCards = await prisma.card.findMany({
    where: { player: { seasonId: fixture.seasonId }, type: "YELLOW" },
    select: { playerId: true },
  });

  const yellowCounts: Record<string, number> = {};
  for (const c of allCards) {
    yellowCounts[c.playerId] = (yellowCounts[c.playerId] || 0) + 1;
  }

  for (const [playerId, count] of Object.entries(yellowCounts)) {
    if (count > 0 && count % 2 === 0) {
      const existing = await prisma.suspension.findFirst({
        where: { playerId, seasonId: fixture.seasonId, reason: "YELLOW_ACCUMULATION", isActive: true },
      });
      if (!existing) {
        await prisma.suspension.create({
          data: {
            seasonId: fixture.seasonId,
            playerId,
            reason: "YELLOW_ACCUMULATION",
            matchBan: 1,
            isActive: true,
          },
        });
      }
    }
  }
}

export async function serveSuspension(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { seasonId: true, homeTeamId: true, awayTeamId: true } });
  if (!fixture) return;

  const activeSuspensions = await prisma.suspension.findMany({
    where: { seasonId: fixture.seasonId, isActive: true },
  });
  if (activeSuspensions.length === 0) return;

  const players = await prisma.player.findMany({
    where: { id: { in: activeSuspensions.map((s) => s.playerId) } },
    select: { id: true, teamId: true },
  });
  const teamByPlayerId = new Map(players.map((p) => [p.id, p.teamId]));

  const relevantSuspensions = activeSuspensions.filter((s) => {
    const teamId = teamByPlayerId.get(s.playerId);
    return teamId === fixture.homeTeamId || teamId === fixture.awayTeamId;
  });

  await Promise.all(relevantSuspensions.map((suspension) => {
    const newServed = suspension.served + 1;
    return newServed >= suspension.matchBan
      ? prisma.suspension.update({ where: { id: suspension.id }, data: { isActive: false, served: suspension.matchBan, endDate: new Date() } })
      : prisma.suspension.update({ where: { id: suspension.id }, data: { served: newServed } });
  }));
}

export async function recalculatePlayerStats(seasonId: string): Promise<void> {
  const players = await prisma.player.findMany({ where: { seasonId, isActive: true } });
  if (players.length === 0) return;

  const playerIds = players.map((player) => player.id);
  const teamIds = [...new Set(players.map((player) => player.teamId).filter((id): id is string => !!id))];
const [goals, assists, cards, fixtures] = await Promise.all([
    prisma.goal.groupBy({ by: ["playerId"], where: { playerId: { in: playerIds }, fixture: countedFixturesWhere(seasonId) }, _count: { _all: true } }),
    prisma.assist.groupBy({ by: ["playerId"], where: { playerId: { in: playerIds }, fixture: countedFixturesWhere(seasonId) }, _count: { _all: true } }),
    prisma.card.groupBy({ by: ["playerId", "type"], where: { playerId: { in: playerIds }, fixture: countedFixturesWhere(seasonId) }, _count: { _all: true } }),
    prisma.fixture.findMany({
      where: { ...countedFixturesWhere(seasonId), AND: [{ OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] }] },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    }),
  ]);

  const goalCounts = new Map(goals.map((row) => [row.playerId, row._count._all]));
  const assistCounts = new Map(assists.map((row) => [row.playerId, row._count._all]));
  const cardCounts = new Map<string, { yellow: number; red: number }>();
  for (const row of cards) {
    const current = cardCounts.get(row.playerId) || { yellow: 0, red: 0 };
    if (row.type === "YELLOW") current.yellow += row._count._all;
    if (row.type === "RED" || row.type === "SECOND_YELLOW") current.red += row._count._all;
    cardCounts.set(row.playerId, current);
  }

  const teamStats = new Map<string, { appearances: number; cleanSheets: number; conceded: number }>();
  for (const teamId of teamIds) teamStats.set(teamId, { appearances: 0, cleanSheets: 0, conceded: 0 });
  for (const fixture of fixtures) {
    for (const [teamId, goalsAgainst] of [[fixture.homeTeamId, fixture.awayScore], [fixture.awayTeamId, fixture.homeScore]] as const) {
      const stats = teamStats.get(teamId);
      if (!stats) continue;
      stats.appearances++;
      stats.conceded += goalsAgainst || 0;
      if (goalsAgainst === 0) stats.cleanSheets++;
    }
  }

  await prisma.$transaction(players.filter((player) => player.teamId).map((player) => {
    const teamId = player.teamId!;
    const team = teamStats.get(teamId) || { appearances: 0, cleanSheets: 0, conceded: 0 };
    const card = cardCounts.get(player.id) || { yellow: 0, red: 0 };
    const goalkeeper = player.position === "GK";
    const data = {
      appearances: team.appearances,
      goals: goalCounts.get(player.id) || 0,
      assists: assistCounts.get(player.id) || 0,
      yellowCards: card.yellow,
      redCards: card.red,
      cleanSheets: goalkeeper ? team.cleanSheets : null,
      goalsConceded: goalkeeper ? team.conceded : null,
    };
    return prisma.playerStat.upsert({
      where: { seasonId_playerId_teamId: { seasonId, playerId: player.id, teamId } },
      create: { seasonId, playerId: player.id, teamId, ...data },
      update: data,
    });
  }));
}

export async function autoDetectAwards(seasonId: string): Promise<void> {
  const stats = await prisma.playerStat.findMany({
    where: { seasonId },
    include: { player: true },
  });

  await autoCreateAward(seasonId, "Golden Boot", "Most goals scored", stats, (a, b) => (b.goals - a.goals) || (b.assists - a.assists));
  const goalkeeperStats = stats.filter((s) => s.player?.position === "GK");
  await autoCreateAward(seasonId, "Golden Glove", "Best goalkeeper (most clean sheets)", goalkeeperStats, (a, b) => (b.cleanSheets || 0) - (a.cleanSheets || 0) || (a.goalsConceded || 0) - (b.goalsConceded || 0));
  await autoCreateAward(seasonId, "MVP", "Most valuable player", stats, (a, b) => (b.goals + b.assists) - (a.goals + a.assists));
  await autoCreateAward(seasonId, "League Champion", "Season champion", await getChampionTeam(seasonId));
  await autoCreateAward(seasonId, "Runner-up", "Season runner-up", await getRunnerUpTeam(seasonId));
}

async function autoCreateAward(seasonId: string, name: string, description: string, data: any, sorter?: (a: any, b: any) => number): Promise<void> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const existing = await prisma.award.findFirst({ where: { seasonId, slug } });
  if (existing) return;

  let winnerId: string | undefined;
  if (sorter && Array.isArray(data) && data.length > 0) {
    data.sort(sorter);
    winnerId = data[0].playerId;
  } else if (data?.teamId) {
    const teamPlayers = await prisma.player.findFirst({ where: { teamId: data.teamId, seasonId, isActive: true } });
    if (teamPlayers) winnerId = teamPlayers.id;
  }

  await prisma.award.create({
    data: {
      seasonId,
      name,
      slug,
      description,
      winnerAnnounced: true,
      winnerId,
    },
  });
}

async function getChampionTeam(seasonId: string) {
  return prisma.standing.findFirst({ where: { seasonId, position: 1 } });
}

async function getRunnerUpTeam(seasonId: string) {
  return prisma.standing.findFirst({ where: { seasonId, position: 2 } });
}
