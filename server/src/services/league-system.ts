import { aggregatePlayerTotals } from "../utils/player-totals.js";
import { rebuildHistoricalPlayerStats } from "./historical-player-stats.js";
import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";
import { generateRoundRobinPairings, normalizeFixtureDays, planFixtureSchedule, type WeekPlan } from "../utils/roundRobin.js";
import { AppError } from "../middleware/errorHandler.js";
import { appendMatchEvent } from "./match-events.js";
import { fixtureScheduleFields } from "../utils/fixtures.js";
import { rankStandings } from "../utils/standings.js";
import { syncFixtureBooking } from "./fixture-bookings.js";
import { consecutiveYellowMilestone } from "./yellow-suspension.js";

const TEAM_COUNT = 6;
const MATCHES_PER_PAIR = 2;
const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

export interface StandingAccumulator {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface CountedFixtureResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface FixtureSchedulePreview {
  preview: true;
  feasible: boolean;
  reason?: string;
  matchesPerDay: number;
  suggestedMatchesPerDay: number;
  minWeeks: number | null;
  teamCount: number;
  activeTeams: number;
  totalRounds: number;
  totalMatches: number;
  weeks: Array<WeekPlan & { dates: string[] }>;
}

export interface FixtureGenerationOptions {
  teamCount?: number;
  leagueWeeks?: number;
  matchesPerPair?: number;
  startDate?: string;
  fixtureDays?: string[];
  matchesPerDay?: number | null;
  kickoffTime?: string;
  preview?: boolean;
}

export interface FixtureGenerationResult {
  generated: number;
  skipped: number;
  fixtureIds?: string[];
}

const fixtureCalendarKey = (value: Date): string => value.toISOString().slice(0, 10);

function validateFixtureGenerationOptions(options: FixtureGenerationOptions, season: { startDate: Date; endDate: Date }) {
  const teamCount = options.teamCount ?? TEAM_COUNT;
  const matchesPerPair = options.matchesPerPair ?? MATCHES_PER_PAIR;
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 20) {
    throw new AppError("teamCount must be an integer between 2 and 20", 400);
  }
  if (!Number.isInteger(matchesPerPair) || matchesPerPair < 1 || matchesPerPair > 4) {
    throw new AppError("matchesPerPair must be an integer between 1 and 4", 400);
  }
  if (options.leagueWeeks !== undefined && (!Number.isInteger(options.leagueWeeks) || options.leagueWeeks < 1 || options.leagueWeeks > 52)) {
    throw new AppError("leagueWeeks must be an integer between 1 and 52", 400);
  }
  if (options.matchesPerDay !== undefined && options.matchesPerDay !== null && (!Number.isInteger(options.matchesPerDay) || options.matchesPerDay < 1 || options.matchesPerDay > Math.floor(teamCount / 2))) {
    throw new AppError(`matchesPerDay must be an integer between 1 and ${Math.floor(teamCount / 2)}`, 400);
  }
  if (options.kickoffTime !== undefined && options.kickoffTime.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(options.kickoffTime.trim())) {
    throw new AppError("kickoffTime must use 24-hour HH:mm format", 400);
  }

  const startDate = options.startDate ? new Date(options.startDate) : new Date(season.startDate);
  if (Number.isNaN(startDate.getTime())) throw new AppError("A valid fixture start date is required", 400);
  if (startDate < season.startDate || startDate > season.endDate) {
    throw new AppError("Fixture start date must fall within the season", 400);
  }
}

export async function generateSeasonFixtures(seasonId: string, options?: FixtureGenerationOptions): Promise<FixtureGenerationResult | FixtureSchedulePreview> {
  const season = await prisma.season.findFirst({ where: { id: seasonId, deletedAt: null } });
  if (!season) throw new AppError("Season not found", 404);
  validateFixtureGenerationOptions(options || {}, season);

  const teams = await prisma.team.findMany({ where: { seasonId, isActive: true, deletedAt: null }, orderBy: { name: "asc" } });
  const leagueCompetition = await prisma.competition.findFirst({
    where: { seasonId, type: "LEAGUE", isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { entries: { where: { deletedAt: null }, select: { id: true, teamId: true } } },
  });
  const entryByTeam = new Map(leagueCompetition?.entries.filter((entry) => entry.teamId).map((entry) => [entry.teamId!, entry.id]) || []);

  const teamCount = options?.teamCount ?? TEAM_COUNT;
  const matchesPerPair = options?.matchesPerPair ?? MATCHES_PER_PAIR;

  const firstLeg = generateRoundRobinPairings(teamCount);
  const allRounds = Array.from({ length: matchesPerPair }, (_, leg) => firstLeg.map((round) =>
    round.map((fixture) => leg % 2 === 0
      ? { ...fixture }
      : { homeTeamIdx: fixture.awayTeamIdx, awayTeamIdx: fixture.homeTeamIdx })))
    .flat();
  const totalRounds = allRounds.length;
  const matchesPerRound = Math.floor(teamCount / 2);
  const leagueWeeks = options?.leagueWeeks ?? totalRounds;

  const seasonStart = options?.startDate ? new Date(options.startDate) : new Date(season.startDate);
  const { days: weekDays, invalid: invalidDays } = normalizeFixtureDays(
    options?.fixtureDays?.length ? options.fixtureDays : (season.fixtureDays || "Friday,Saturday,Sunday").split(",")
  );
  const daysPerWeek = Math.max(1, weekDays.length);

  // A bad day name (typo, abbreviation, non-English) used to silently map to
  // the week's start date — the first fixture day looked skipped and a bad
  // name later in the list double-booked that first date. Surface it instead.
  if (invalidDays.length > 0) {
    const reason = `Unknown fixture day(s): ${invalidDays.join(", ")}. Use full weekday names: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday.`;
    if (options?.preview) {
      return {
        preview: true,
        feasible: false,
        reason,
        matchesPerDay: 0,
        suggestedMatchesPerDay: 0,
        minWeeks: null,
        teamCount,
        activeTeams: teams.length,
        totalRounds,
        totalMatches: totalRounds * matchesPerRound,
        weeks: [],
      };
    }
    throw new AppError(reason, 400);
  }
  if (weekDays.length === 0) {
    const reason = "At least one fixture day is required.";
    if (options?.preview) {
      return {
        preview: true,
        feasible: false,
        reason,
        matchesPerDay: 0,
        suggestedMatchesPerDay: 0,
        minWeeks: null,
        teamCount,
        activeTeams: teams.length,
        totalRounds,
        totalMatches: totalRounds * matchesPerRound,
        weeks: [],
      };
    }
    throw new AppError(reason, 400);
  }
  const firstMatchDay = findNextDay(seasonStart, weekDays[0]);

  // A team-count mismatch is surfaced through the preview plan (so the UI can
  // offer a one-click "use N teams" fix); real generation still rejects it.
  if (teams.length !== teamCount) {
    const reason = `Season has ${teams.length} active team(s) but the settings ask for ${teamCount}.`;
    if (options?.preview) {
      return {
        preview: true,
        feasible: false,
        reason,
        matchesPerDay: 0,
        suggestedMatchesPerDay: 0,
        minWeeks: null,
        teamCount,
        activeTeams: teams.length,
        totalRounds,
        totalMatches: totalRounds * matchesPerRound,
        weeks: [],
      };
    }
    throw new AppError(reason, 400);
  }

  // The whole week/day layout lives in the shared planner (roundRobin.ts) so
  // the preview and the real generation can never disagree about whether a
  // configuration fits. The old behavior rejected weeks shorter than
  // one-round-per-week; that was wrong — a week can host more than one round
  // when multiple matches share a day, so the planner load-balances instead
  // and only rejects when an explicit matches-per-day cap genuinely cannot
  // hold a round (checked BEFORE any database writes).
  const plan = planFixtureSchedule({
    rounds: allRounds,
    leagueWeeks,
    daysPerWeek,
    matchesPerDay: options?.matchesPerDay ?? undefined,
  });

  // Concrete dates per week, so a preview can show exactly when matches land.
  const weeksWithDates = plan.weeks.map((w) => {
    const weekStart = new Date(firstMatchDay);
    weekStart.setDate(weekStart.getDate() + (w.week - 1) * 7);
    const dates = weekDays.map((d) => findNextDay(weekStart, d).toISOString().split("T")[0]);
    return { ...w, dates };
  });

  const lastPlannedDate = weeksWithDates.flatMap((week) => week.dates).sort().at(-1);
  if (lastPlannedDate && new Date(`${lastPlannedDate}T00:00:00.000Z`) > season.endDate) {
    const reason = "The generated schedule extends beyond the season end date.";
    if (options?.preview) {
      return {
        preview: true,
        feasible: false,
        reason,
        matchesPerDay: plan.matchesPerDay,
        suggestedMatchesPerDay: plan.suggestedMatchesPerDay,
        minWeeks: plan.minWeeks ?? null,
        teamCount,
        activeTeams: teams.length,
        totalRounds,
        totalMatches: plan.totalMatches,
        weeks: weeksWithDates,
      };
    }
    throw new AppError(reason, 400);
  }

  if (options?.preview) {
    return {
      preview: true,
      feasible: plan.feasible,
      reason: plan.feasible ? undefined : plan.reason,
      matchesPerDay: plan.matchesPerDay,
      suggestedMatchesPerDay: plan.suggestedMatchesPerDay,
      minWeeks: plan.minWeeks ?? null,
      teamCount,
      activeTeams: teams.length,
      totalRounds,
      totalMatches: plan.totalMatches,
      weeks: weeksWithDates,
    };
  }

  if (!plan.feasible) {
    throw new AppError(`Cannot generate schedule: ${plan.reason}`, 400);
  }

  // Build the requested schedule in memory first. Persistence is additive:
  // matches. Everything else is left alone — completed/resulted fixtures,
  // cancelled/postponed ones, friendlies, cup/competition matches, and
  // post-season knockout fixtures are all preserved so a bulk regeneration
  // never wipes existing history.
  const fixtures: Array<{
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
    matchDate: Date;
    leagueWeek: number;
    round: number;
    kickoffTime: string | null;
    kickoffAt: Date | null;
    scheduledDate: string;
    competitionId: string | null;
    homeEntryId: string | null;
    awayEntryId: string | null;
    status: "SCHEDULED";
  }> = [];

  // Place fixtures exactly as the plan laid them out: the planner already
  // proved this fits and assigned every match to a concrete day while
  // guaranteeing no team plays twice on the same date.
  let matchDay = new Date(firstMatchDay);

  for (const weekPlan of plan.weeks) {
    let weekPlaced = 0;

    for (let d = 0; d < weekPlan.days.length; d++) {
      const dayDate = new Date(findNextDay(matchDay, weekDays[d]));
      for (const item of weekPlan.days[d]) {
        const kickoffTime = options?.kickoffTime?.trim() ? options.kickoffTime.trim() : null;
        const schedule = fixtureScheduleFields(dayDate, kickoffTime, leagueCompetition?.timezone || "Asia/Kolkata");
        const homeTeamId = teams[item.slot.homeTeamIdx].id;
        const awayTeamId = teams[item.slot.awayTeamIdx].id;
        fixtures.push({
          seasonId,
          competitionId: leagueCompetition?.id || null,
          homeTeamId,
          awayTeamId,
          homeEntryId: entryByTeam.get(homeTeamId) || null,
          awayEntryId: entryByTeam.get(awayTeamId) || null,
          matchDate: dayDate,
          ...schedule,
          leagueWeek: weekPlan.week,
          round: item.round,
          kickoffTime,
          status: "SCHEDULED",
        });
        weekPlaced++;
      }
    }

    // Belt-and-suspenders: if a week's rounds exceed what the planner placed,
    // fail loudly rather than silently dropping fixtures.
    if (weekPlaced < weekPlan.matchCount) {
      throw new AppError(
        `Schedule does not fit: week ${weekPlan.week} has ${weekPlan.matchCount - weekPlaced} match(es) left over at max ${plan.matchesPerDay} match(es)/day over ${daysPerWeek} day(s). Raise leagueWeeks or max matches per day.`,
        400
      );
    }

    matchDay.setDate(matchDay.getDate() + 7);
  }

  // Generation is additive. Existing fixtures are never archived, deleted,
  // or rewritten. A round/team pairing is the strongest logical identity in
  // the current schema, so regenerating the same schedule becomes a no-op.
  // The advisory transaction lock prevents concurrent requests from both
  // observing missing pairings and inserting duplicate schedules.
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixture-generation:${seasonId}`}))`;

    const existingLeagueFixtures = await tx.fixture.findMany({
      where: {
        seasonId,
        deletedAt: null,
        isFriendly: false,
        isGrandFinal: false,
        isRelegationPlayoff: false,
        OR: [{ competitionId: null }, { competition: { is: { type: "LEAGUE" } } }],
      },
      select: { homeTeamId: true, awayTeamId: true, round: true },
    });
    const logicalKeys = new Set(existingLeagueFixtures.map((fixture) => `${fixture.round ?? "none"}:${fixture.homeTeamId}:${fixture.awayTeamId}`));
    const missing = fixtures.filter((fixture) => !logicalKeys.has(`${fixture.round}:${fixture.homeTeamId}:${fixture.awayTeamId}`));

    const activeFixtures = await tx.fixture.findMany({
      where: { seasonId, deletedAt: null, status: { notIn: ["CANCELLED", "POSTPONED"] } },
      select: { id: true, homeTeamId: true, awayTeamId: true, matchDate: true },
    });
    for (const fixture of missing) {
      const dateKey = fixtureCalendarKey(fixture.matchDate);
      const collision = activeFixtures.find((existing) =>
        fixtureCalendarKey(existing.matchDate) === dateKey
        && [existing.homeTeamId, existing.awayTeamId].some((teamId) => teamId === fixture.homeTeamId || teamId === fixture.awayTeamId)
      );
      if (collision) {
        throw new AppError(`Cannot generate schedule: a team already has fixture ${collision.id} on ${dateKey}`, 409);
      }
    }

    const created = missing.length > 0
      ? await tx.fixture.createManyAndReturn({ data: missing, select: { id: true, kickoffTime: true } })
      : [];
    return { generated: missing.length, skipped: fixtures.length - missing.length, fixtureIds: created.filter((fixture) => fixture.kickoffTime).map((fixture) => fixture.id) };
  });

  // Reserve after commit so the booking can safely reference each fixture.
  await Promise.all((result.fixtureIds || []).map((fixtureId) => syncFixtureBooking(fixtureId)));
  return result;
}

export async function createFixtureSchedulePreview(competitionId: string, rawOptions: FixtureGenerationOptions, requestedById?: string) {
  const competition = await prisma.competition.findFirst({
    where: { id: competitionId, deletedAt: null, isActive: true },
    include: { season: true },
  });
  if (!competition) throw new AppError("Competition not found", 404);
  if (competition.season.lifecycle === "COMPLETED") throw new AppError("Completed seasons are read-only", 409);
  if (competition.type !== "LEAGUE") throw new AppError("Round-robin schedule previews currently support league competitions", 400);
  const options = { ...rawOptions, preview: true };
  const preview = await generateSeasonFixtures(competition.seasonId, options);
  if (!("preview" in preview)) throw new AppError("Schedule preview could not be produced", 500);
  const teams = await prisma.team.findMany({ where: { seasonId: competition.seasonId, isActive: true, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const kickoffTime = rawOptions.kickoffTime?.trim() || null;
  const candidates = preview.weeks.flatMap((week) => week.days.flatMap((day, dayIndex) => day.map((placed) => ({
    homeTeamId: teams[placed.slot.homeTeamIdx]?.id,
    homeTeamName: teams[placed.slot.homeTeamIdx]?.name,
    awayTeamId: teams[placed.slot.awayTeamIdx]?.id,
    awayTeamName: teams[placed.slot.awayTeamIdx]?.name,
    scheduledDate: week.dates[dayIndex],
    kickoffTime,
    round: placed.round,
    leagueWeek: week.week,
  })))).filter((candidate) => candidate.homeTeamId && candidate.awayTeamId);

  const existing = await prisma.fixture.findMany({
    where: { competitionId, deletedAt: null },
    select: { id: true, homeTeamId: true, awayTeamId: true, round: true, scheduledDate: true },
  });
  const active = await prisma.fixture.findMany({
    where: { seasonId: competition.seasonId, deletedAt: null, status: { notIn: ["CANCELLED", "POSTPONED"] } },
    select: { id: true, homeTeamId: true, awayTeamId: true, scheduledDate: true },
  });
  const existingKeys = new Set(existing.map((fixture) => `${fixture.round ?? "none"}:${fixture.homeTeamId}:${fixture.awayTeamId}`));
  const additions = candidates.filter((candidate) => !existingKeys.has(`${candidate.round}:${candidate.homeTeamId}:${candidate.awayTeamId}`));
  const collisions = additions.flatMap((candidate) => {
    const collision = active.find((fixture) => fixture.scheduledDate === candidate.scheduledDate
      && [fixture.homeTeamId, fixture.awayTeamId].some((teamId) => teamId === candidate.homeTeamId || teamId === candidate.awayTeamId));
    return collision ? [{ candidate, fixtureId: collision.id }] : [];
  });
  const diff = {
    feasible: preview.feasible,
    reason: preview.reason || null,
    preview,
    candidates,
    additions: additions.length,
    alreadyExists: candidates.length - additions.length,
    collisions,
  };
  return prisma.fixtureGenerationBatch.create({
    data: {
      seasonId: competition.seasonId,
      competitionId,
      status: preview.feasible ? "DRAFT" : "FAILED",
      input: { ...rawOptions, preview: false } as Prisma.InputJsonValue,
      diff: diff as unknown as Prisma.InputJsonValue,
      requestedById: requestedById || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

export async function publishFixtureSchedulePreview(batchId: string) {
  return prisma.$transaction(async (tx) => {
    let batch = await tx.fixtureGenerationBatch.findUnique({
      where: { id: batchId },
      include: { competition: { include: { entries: { where: { deletedAt: null }, select: { id: true, teamId: true } } } } },
    });
    if (!batch) throw new AppError("Schedule preview not found", 404);
    // Different preview records for the same competition must serialize
    // against one another. Locking by batch ID allowed two concurrent
    // previews to both observe an empty schedule and insert duplicates.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixture-schedule-publish:${batch.competitionId}`}))`;
    batch = await tx.fixtureGenerationBatch.findUnique({
      where: { id: batchId },
      include: { competition: { include: { entries: { where: { deletedAt: null }, select: { id: true, teamId: true } } } } },
    });
    if (!batch) throw new AppError("Schedule preview not found", 404);
    if (batch.status === "PUBLISHED") {
      return { batchId: batch.id, published: true, generated: await tx.fixture.count({ where: { generationBatchId: batch.id } }), collisions: [] };
    }
    if (batch.status !== "DRAFT") throw new AppError("Only a feasible draft preview can be published", 409);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-roster:${batch.seasonId}`}))`;
    const season = await tx.season.findUnique({ where: { id: batch.seasonId } });
    if (!season || season.deletedAt || season.lifecycle === "COMPLETED") throw new AppError("The season is unavailable or completed", 409);
    if (batch.expiresAt && batch.expiresAt < new Date()) {
      await tx.fixtureGenerationBatch.update({ where: { id: batch.id }, data: { status: "EXPIRED" } });
      throw new AppError("Schedule preview has expired; create a new preview", 409);
    }
    const diff = batch.diff as any;
    const candidates = Array.isArray(diff?.candidates) ? diff.candidates : [];
    const existing = await tx.fixture.findMany({
      where: { competitionId: batch.competitionId, deletedAt: null },
      select: { homeTeamId: true, awayTeamId: true, round: true },
    });
    const active = await tx.fixture.findMany({
      where: { seasonId: batch.seasonId, deletedAt: null, status: { notIn: ["CANCELLED", "POSTPONED"] } },
      select: { id: true, homeTeamId: true, awayTeamId: true, scheduledDate: true },
    });
    const existingKeys = new Set(existing.map((fixture) => `${fixture.round ?? "none"}:${fixture.homeTeamId}:${fixture.awayTeamId}`));
    const entryByTeam = new Map(batch.competition.entries.filter((entry) => entry.teamId).map((entry) => [entry.teamId!, entry.id]));
    const collisions: Array<{ fixtureId: string; scheduledDate: string; homeTeamId: string; awayTeamId: string }> = [];
    const safe = candidates.filter((candidate: any) => {
      if (existingKeys.has(`${candidate.round}:${candidate.homeTeamId}:${candidate.awayTeamId}`)) return false;
      const collision = active.find((fixture) => fixture.scheduledDate === candidate.scheduledDate
        && [fixture.homeTeamId, fixture.awayTeamId].some((teamId) => teamId === candidate.homeTeamId || teamId === candidate.awayTeamId));
      if (collision) {
        collisions.push({ fixtureId: collision.id, scheduledDate: candidate.scheduledDate, homeTeamId: candidate.homeTeamId, awayTeamId: candidate.awayTeamId });
        return false;
      }
      return true;
    });
    if (safe.length) {
      await tx.fixture.createMany({
        data: safe.map((candidate: any) => ({
          seasonId: batch.seasonId,
          competitionId: batch.competitionId,
          homeEntryId: entryByTeam.get(candidate.homeTeamId) || null,
          awayEntryId: entryByTeam.get(candidate.awayTeamId) || null,
          homeTeamId: candidate.homeTeamId,
          awayTeamId: candidate.awayTeamId,
          matchDate: new Date(`${candidate.scheduledDate}T00:00:00.000Z`),
          ...fixtureScheduleFields(candidate.scheduledDate, candidate.kickoffTime, batch.competition.timezone),
          kickoffTime: candidate.kickoffTime || null,
          round: candidate.round,
          leagueWeek: candidate.leagueWeek,
          status: "SCHEDULED" as const,
          generationBatchId: batch.id,
        })),
      });
    }
    await tx.fixtureGenerationBatch.update({ where: { id: batch.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    return { batchId: batch.id, published: true, generated: safe.length, skipped: candidates.length - safe.length, collisions };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
export function countedFixturesWhere(seasonId: string): Prisma.FixtureWhereInput {
  return {
    seasonId,
    deletedAt: null,
    status: "COMPLETED",
    isFriendly: false,
    OR: [{ competitionId: null }, { competition: { is: { type: "LEAGUE" } } }],
    isGrandFinal: false,
    isRelegationPlayoff: false,
  };
}

export async function recalculateStandings(seasonId: string): Promise<void> {
  const [fixtures, leagueCompetition] = await Promise.all([
    prisma.fixture.findMany({ where: countedFixturesWhere(seasonId) }),
    prisma.competition.findFirst({
      where: { seasonId, type: "LEAGUE", deletedAt: null },
      include: { ruleSets: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1 } },
    }),
  ]);
  const activeRules = leagueCompetition?.ruleSets[0];
  const points = {
    win: activeRules?.pointsForWin ?? POINTS_WIN,
    draw: activeRules?.pointsForDraw ?? POINTS_DRAW,
    loss: activeRules?.pointsForLoss ?? POINTS_LOSS,
  };

  const teams = await prisma.team.findMany({ where: { seasonId, isActive: true, deletedAt: null } });
  const teamIds = teams.map((t) => t.id);
  const adjustments = await prisma.standingAdjustment.findMany({ where: { seasonId, deletedAt: null }, select: { teamId: true, pointsDelta: true, goalsForDelta: true, goalsAgainstDelta: true } });

  const stats: Record<string, { played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; pts: number }> = {};

  for (const id of teamIds) {
    stats[id] = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  }

  for (const f of fixtures) {
    if (f.homeScore === null || f.awayScore === null) continue;
    const h = stats[f.homeTeamId];
    const a = stats[f.awayTeamId];
    // Ignore legacy orphaned fixtures rather than allowing one bad record to
    // prevent the entire season table from recalculating.
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gf += f.homeScore;
    h.ga += f.awayScore;
    a.gf += f.awayScore;
    a.ga += f.homeScore;
    if (f.homeScore > f.awayScore) { h.wins++; a.losses++; h.pts += points.win; a.pts += points.loss; }
    else if (f.homeScore < f.awayScore) { a.wins++; h.losses++; a.pts += points.win; h.pts += points.loss; }
    else { h.draws++; a.draws++; h.pts += points.draw; a.pts += points.draw; }
  }

  for (const adjustment of adjustments) {
    const team = stats[adjustment.teamId];
    if (!team) continue;
    team.pts += adjustment.pointsDelta;
    team.gf += adjustment.goalsForDelta;
    team.ga += adjustment.goalsAgainstDelta;
  }

  for (const id of teamIds) {
    stats[id].gd = stats[id].gf - stats[id].ga;
  }

  const sorted = rankStandings(
    teamIds,
    stats,
    fixtures,
    Object.fromEntries(teams.map((team) => [team.id, team.name])),
  );

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

  await prisma.standing.deleteMany({
    where: { seasonId, ...(teamIds.length ? { teamId: { notIn: teamIds } } : {}) },
  });

  for (const data of standingsData) {
    await prisma.standing.upsert({
      where: { seasonId_teamId: { seasonId, teamId: data.teamId } },
      create: data,
      update: data,
    });
  }
}

export interface MatchResultOptions {
  changedById?: string;
  reason?: string;
  idempotencyKey?: string;
  expectedVersion?: number;
  settlement?: {
    outcome?: string;
    winnerTeamId?: string | null;
    matchReport?: string | null;
    extraTimeHomeScore?: number | null;
    extraTimeAwayScore?: number | null;
    penaltiesHomeScore?: number | null;
    penaltiesAwayScore?: number | null;
  };
}

export async function processMatchResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  knockoutWinnerTeamId?: string,
  options: MatchResultOptions = {},
): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, include: { season: true, bracketMatch: true } });
  if (!fixture) throw new AppError("Fixture not found", 404);
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) throw new AppError("Scores must be non-negative integers", 400);
  if (fixture.status === "CANCELLED" || fixture.status === "POSTPONED") throw new AppError("Cancelled or postponed fixtures cannot be completed", 400);
  const requiresWinner = !!fixture.bracketMatch || fixture.isGrandFinal;
  const validSelectedWinner = !!knockoutWinnerTeamId && [fixture.homeTeamId, fixture.awayTeamId].includes(knockoutWinnerTeamId);
  if (requiresWinner && homeScore === awayScore && !validSelectedWinner) throw new AppError("Final and knockout matches require a winner; provide the penalty winner team", 400);
  if (requiresWinner && homeScore !== awayScore && knockoutWinnerTeamId && knockoutWinnerTeamId !== (homeScore > awayScore ? fixture.homeTeamId : fixture.awayTeamId)) throw new AppError("Selected winner does not match the score", 400);
  const resolvedWinner = requiresWinner
    ? (knockoutWinnerTeamId || (homeScore > awayScore ? fixture.homeTeamId : fixture.awayTeamId))
    : undefined;
  if (fixture.bracketMatch && resolvedWinner) await assertBracketCorrectionSafe(fixtureId, resolvedWinner);

  const finalized = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`match-result:${fixtureId}`}))`;
    const current = await tx.fixture.findFirst({ where: { id: fixtureId, deletedAt: null } });
    if (!current) throw new AppError("Fixture not found", 404);
    if (options.idempotencyKey) {
      const replay = await tx.matchResultRevision.findUnique({ where: { idempotencyKey: options.idempotencyKey }, select: { fixtureId: true } });
      if (replay) {
        if (replay.fixtureId !== fixtureId) throw new AppError("Idempotency key was already used for another fixture", 409, "IDEMPOTENCY_CONFLICT");
        const projection = current.competitionId ? await tx.projectionVersion.findUnique({
          where: { competitionId_projection: { competitionId: current.competitionId, projection: "MATCH_RESULT" } },
          select: { status: true },
        }) : null;
        return {
          changed: false,
          needsWork: current.suspensionsProcessedAt == null || (!!current.competitionId && projection?.status !== "BUILT"),
          version: current.version,
          competitionId: current.competitionId,
          suspensionsProcessedAt: current.suspensionsProcessedAt,
        };
      }
    }
    if (options.expectedVersion !== undefined && current.version !== options.expectedVersion) {
      throw new AppError("Fixture was changed by another operator", 409, "VERSION_CONFLICT", { currentVersion: current.version });
    }
    const settlementChanged = Object.entries(options.settlement || {}).some(([key, value]) => (current as any)[key] !== value);
    const changed = current.status !== "COMPLETED" || current.homeScore !== homeScore || current.awayScore !== awayScore || (!!resolvedWinner && current.winnerTeamId !== resolvedWinner) || settlementChanged;
    if (!changed) {
      const projection = current.competitionId ? await tx.projectionVersion.findUnique({
        where: { competitionId_projection: { competitionId: current.competitionId, projection: "MATCH_RESULT" } },
        select: { status: true },
      }) : null;
      return {
        changed: false,
        needsWork: current.suspensionsProcessedAt == null || (!!current.competitionId && projection?.status !== "BUILT"),
        version: current.version,
        competitionId: current.competitionId,
        suspensionsProcessedAt: current.suspensionsProcessedAt,
      };
    }
    const version = current.version + 1;
    const updated = await tx.fixture.updateMany({
      where: { id: fixtureId, version: current.version },
      data: {
        homeScore,
        awayScore,
        status: "COMPLETED",
        finalizedAt: new Date(),
        resultSourceVersion: version,
        version,
        ...(resolvedWinner ? { winnerTeamId: resolvedWinner } : {}),
        ...(options.settlement || {}),
      },
    });
    if (updated.count !== 1) throw new AppError("Fixture was changed by another operator", 409, "VERSION_CONFLICT");
    await tx.matchResultRevision.create({
      data: {
        fixtureId,
        changedById: options.changedById,
        previousHomeScore: current.homeScore,
        previousAwayScore: current.awayScore,
        nextHomeScore: homeScore,
        nextAwayScore: awayScore,
        reason: options.reason,
        sourceVersion: version,
        idempotencyKey: options.idempotencyKey,
      },
    });
    await appendMatchEvent(tx, {
      fixtureId,
      type: options.settlement ? "SETTLEMENT" : "STATE_CHANGE",
      payload: {
        fromStatus: current.status,
        toStatus: "COMPLETED",
        previousHomeScore: current.homeScore,
        previousAwayScore: current.awayScore,
        homeScore,
        awayScore,
        winnerTeamId: resolvedWinner || null,
        settlement: options.settlement || null,
        sourceVersion: version,
        reason: options.reason || null,
      },
      idempotencyKey: `match-result:${fixtureId}:${version}`,
      createdById: options.changedById,
    });
    if (current.competitionId) {
      await tx.projectionVersion.upsert({
        where: { competitionId_projection: { competitionId: current.competitionId, projection: "MATCH_RESULT" } },
        create: { competitionId: current.competitionId, projection: "MATCH_RESULT", sourceVersion: version, status: "PENDING" },
        update: { sourceVersion: version, status: "PENDING", lastError: null },
      });
    }
    await tx.outboxEvent.create({
      data: {
        aggregateType: "Fixture",
        aggregateId: fixtureId,
        eventType: "MATCH_RESULT_PROJECTIONS",
        payload: { fixtureId, seasonId: current.seasonId, competitionId: current.competitionId, sourceVersion: version },
        idempotencyKey: `match-result-projections:${fixtureId}:${version}`,
      },
    });
    return { changed: true, needsWork: true, version, competitionId: current.competitionId, suspensionsProcessedAt: current.suspensionsProcessedAt };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (!finalized.needsWork) return;

  await recalculateStandings(fixture.seasonId);

  // Gate suspension processing on a persisted flag rather than "was the
  // fixture already COMPLETED before this call" — the latter is only true
  // the very first time processMatchResult runs for a fixture. If a later
  // step in this pipeline (player stats / awards) throws and the caller
  // retries, the fixture is by then already COMPLETED, so that check would
  // silently skip suspension processing forever even though it never
  // actually ran. This flag is only set after serveSuspension/
  // processSuspensions both succeed, so a retry correctly re-attempts them.
  if (!finalized.suspensionsProcessedAt) {
    await serveSuspension(fixtureId);
    await processSuspensions(fixtureId);
    await prisma.fixture.update({ where: { id: fixtureId }, data: { suspensionsProcessedAt: new Date() } });
  }

  await recalculatePlayerStats(fixture.seasonId);
  await recalculateFriendlyPlayerStats(fixture.seasonId);
  await recalculateTeamStats(fixture.seasonId);

  await autoDetectAwards(fixture.seasonId);
  if (finalized.competitionId) {
    await prisma.projectionVersion.update({
      where: { competitionId_projection: { competitionId: finalized.competitionId, projection: "MATCH_RESULT" } },
      data: { status: "BUILT", lastBuiltAt: new Date(), lastError: null },
    });
  }
  if (fixture.bracketMatch) await advanceBracketWinner(fixtureId, resolvedWinner);
}

async function assertBracketCorrectionSafe(fixtureId: string, nextWinnerId: string) {
  const match = await prisma.bracketMatch.findFirst({ where: { fixtureId } });
  if (!match || !match.winnerTeamId || match.winnerTeamId === nextWinnerId) return;
  const next = await prisma.bracketMatch.findUnique({
    where: { competitionId_roundNumber_position: { competitionId: match.competitionId, roundNumber: match.roundNumber + 1, position: Math.ceil(match.position / 2) } },
    include: { fixture: { select: { status: true } } },
  });
  if (next?.fixture?.status === "COMPLETED") {
    throw new AppError("The corrected winner has already played a completed downstream bracket match", 409, "BRACKET_CORRECTION_CONFLICT");
  }
}

export async function advanceBracketWinner(fixtureId: string, knockoutWinnerTeamId?: string): Promise<void> {
  const match = await prisma.bracketMatch.findFirst({ where: { fixtureId }, include: { fixture: true } });
  if (!match || !match.fixture || match.fixture.homeScore === null || match.fixture.awayScore === null) return;
  const winnerTeamId = knockoutWinnerTeamId || (match.fixture.homeScore > match.fixture.awayScore ? match.fixture.homeTeamId : match.fixture.awayTeamId);
  await prisma.bracketMatch.update({ where: { id: match.id }, data: { winnerTeamId } });

  const next = await prisma.bracketMatch.findUnique({
    where: { competitionId_roundNumber_position: { competitionId: match.competitionId, roundNumber: match.roundNumber + 1, position: Math.ceil(match.position / 2) } },
  });
  if (!next) {
    await prisma.competition.update({ where: { id: match.competitionId }, data: { bracketStatus: "COMPLETED" } });
    return;
  }

  const isHomeSlot = match.position % 2 === 1;
  await prisma.bracketMatch.update({ where: { id: next.id }, data: isHomeSlot ? { homeTeamId: winnerTeamId } : { awayTeamId: winnerTeamId } });
  const updated = await prisma.bracketMatch.findUnique({ where: { id: next.id } });
  if (updated?.homeTeamId && updated.awayTeamId && updated.fixtureId) {
    await prisma.fixture.update({
      where: { id: updated.fixtureId },
      data: { homeTeamId: updated.homeTeamId, awayTeamId: updated.awayTeamId, version: { increment: 1 } },
    });
  }
}

export async function openTransferWindow(seasonId: string, days: number = 7): Promise<void> {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new AppError("Transfer window must be between 1 and 90 days", 400);
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

export async function validateSquad(teamId: string, seasonId: string): Promise<{ valid: boolean; starters: number; subs: number; reserves: number; total: number }> {
  const starters = await prisma.player.count({ where: { teamId, seasonId, squadType: "STARTER", isActive: true } });
  const subs = await prisma.player.count({ where: { teamId, seasonId, squadType: "SUBSTITUTE", isActive: true } });
  const reserves = await prisma.player.count({ where: { teamId, seasonId, squadType: "RESERVE", isActive: true } });
  return { valid: starters === 6 && subs === 2 && reserves === 4, starters, subs, reserves, total: starters + subs + reserves };
}

export async function selectMatchdaySquad(fixtureId: string, teamId: string, playerIds: string[]): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) throw new AppError("Fixture not found", 404);
  if (fixture.status !== "SCHEDULED") throw new AppError("Cannot change squad for a non-scheduled fixture", 400);
  if (teamId !== fixture.homeTeamId && teamId !== fixture.awayTeamId) throw new AppError("Team is not participating in this fixture", 400);
  if (!Array.isArray(playerIds) || playerIds.length !== 8 || new Set(playerIds).size !== playerIds.length) {
    throw new AppError("Matchday squad must contain 8 different players", 400);
  }

  const players = await prisma.player.findMany({ where: { id: { in: playerIds }, teamId, seasonId: fixture.seasonId, isActive: true } });
  if (players.length !== 8) throw new AppError("Matchday squad must have exactly 8 players", 400);
  const starters = players.filter((player) => player.squadType === "STARTER").length;
  const substitutes = players.filter((player) => player.squadType === "SUBSTITUTE").length;
  if (starters !== 6 || substitutes !== 2) throw new AppError("Matchday squad must contain 6 starters and 2 substitutes", 400);

  const activeSuspensions = await prisma.suspension.findMany({
    where: {
      playerId: { in: playerIds }, isActive: true, deletedAt: null, seasonId: fixture.seasonId,
      OR: [{ competitionId: null }, { competitionId: fixture.competitionId }],
    },
  });
  if (activeSuspensions.length > 0) {
    throw new AppError(`Suspended players cannot be selected: ${activeSuspensions.map((s) => s.playerId).join(", ")}`, 400);
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
        isStarter: players.find((player) => player.id === pid)?.squadType === "STARTER",
      })),
    });
  });
}

export async function processSuspensions(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { seasonId: true, competitionId: true, isFriendly: true, competition: { select: { type: true } } } });
  // Friendlies are intentionally outside competitive discipline.
  if (!fixture || fixture.isFriendly || fixture.competition?.type === "FRIENDLY") return;
  const cards = await prisma.card.findMany({ where: { fixtureId }, include: { player: true } });

  for (const card of cards) {
    if (card.type === "RED" || card.type === "SECOND_YELLOW") {
      const reason = card.type === "RED" ? "STRAIGHT_RED" : "SECOND_YELLOW";
      const existing = await prisma.suspension.findFirst({
        where: { seasonId: card.player.seasonId, playerId: card.playerId, competitionId: fixture.competitionId, reason, isActive: true, deletedAt: null },
      });
      if (!existing) {
        await prisma.suspension.create({
          data: { seasonId: card.player.seasonId, playerId: card.playerId, competitionId: fixture.competitionId, reason, matchBan: 1, isActive: true },
        });
      }
    }
  }

  await checkConsecutiveYellowCards(fixtureId);
}

async function checkConsecutiveYellowCards(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: {
      seasonId: true,
      competitionId: true,
      isFriendly: true,
      homeTeamId: true,
      awayTeamId: true,
      competition: { select: { type: true, ruleSets: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1 } } },
    },
  });
  if (!fixture) return;
  if (fixture.isFriendly || fixture.competition?.type === "FRIENDLY") return;

  const threshold = fixture.competition?.ruleSets[0]?.yellowCardThreshold ?? 2;
  const matchBan = fixture.competition?.ruleSets[0]?.yellowSuspensionMatches ?? 1;
  const cards = await prisma.card.findMany({
    where: { fixtureId, type: "YELLOW" },
    select: { playerId: true, teamId: true, player: { select: { teamId: true } } },
  });
  const teamByPlayer = new Map(cards.map((card) => [card.playerId, card.teamId || card.player.teamId]));

  for (const [playerId, teamId] of teamByPlayer) {
    if (!teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) continue;
    const teamFixtures = await prisma.fixture.findMany({
      where: {
        seasonId: fixture.seasonId,
        competitionId: fixture.competitionId,
        deletedAt: null,
        status: "COMPLETED",
        isFriendly: false,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      select: { id: true, cards: { where: { playerId, type: "YELLOW" }, select: { id: true } } },
      orderBy: [{ matchDate: "asc" }, { kickoffAt: "asc" }, { id: "asc" }],
    });
    const milestone = consecutiveYellowMilestone(teamFixtures, fixtureId, threshold);
    if (milestone !== null && matchBan > 0) {
      const existing = await prisma.suspension.findFirst({
        where: { playerId, seasonId: fixture.seasonId, competitionId: fixture.competitionId, reason: "YELLOW_ACCUMULATION", milestone, deletedAt: null },
      });
      if (!existing) {
        await prisma.suspension.create({
          data: {
            seasonId: fixture.seasonId,
            playerId,
            competitionId: fixture.competitionId,
            reason: "YELLOW_ACCUMULATION",
            milestone,
            matchBan,
            isActive: true,
          },
        });
      }
    }
  }
}

export async function serveSuspension(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: { seasonId: true, competitionId: true, homeTeamId: true, awayTeamId: true, isFriendly: true, competition: { select: { type: true } } },
  });
  if (!fixture || fixture.isFriendly || fixture.competition?.type === "FRIENDLY") return;

  const activeSuspensions = await prisma.suspension.findMany({
    where: {
      seasonId: fixture.seasonId,
      isActive: true,
      deletedAt: null,
      OR: [{ competitionId: fixture.competitionId }, { competitionId: null }],
    },
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

  await Promise.all(relevantSuspensions.filter((suspension) => {
    const servedFixtures = Array.isArray(suspension.servedFixtureIds) ? suspension.servedFixtureIds : [];
    return !servedFixtures.includes(fixtureId);
  }).map((suspension) => {
    const newServed = suspension.served + 1;
    const servedFixtureIds = [...(Array.isArray(suspension.servedFixtureIds) ? suspension.servedFixtureIds : []), fixtureId];
    return newServed >= suspension.matchBan
      ? prisma.suspension.update({ where: { id: suspension.id }, data: { isActive: false, served: suspension.matchBan, servedFixtureIds, endDate: new Date() } })
      : prisma.suspension.update({ where: { id: suspension.id }, data: { served: newServed, servedFixtureIds } });
  }));
}

export async function recalculatePlayerStats(seasonId: string): Promise<void> {
  await rebuildHistoricalPlayerStats(seasonId, false);
}
export async function recalculateFriendlyPlayerStats(seasonId: string): Promise<void> {
  await rebuildHistoricalPlayerStats(seasonId, true);
}

export async function recalculateTeamStats(seasonId: string): Promise<void> {
  const [fixtures, assists] = await Promise.all([
    prisma.fixture.findMany({ where: countedFixturesWhere(seasonId), select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, homeShots: true, awayShots: true, homeCorners: true, awayCorners: true, homeFouls: true, awayFouls: true, homeOffsides: true, awayOffsides: true, homePossession: true, awayPossession: true } }),
    prisma.assist.groupBy({ by: ["teamId"], where: { teamId: { not: null }, fixture: countedFixturesWhere(seasonId) }, _count: { _all: true } }),
  ]);
  const assistsByTeam = new Map(assists.flatMap((row) => row.teamId ? [[row.teamId, row._count._all] as const] : []));
  const stats = new Map<string, { totalGoals: number; totalShots: number; totalCorners: number; totalFouls: number; totalOffsides: number; cleanSheets: number; possession: number[] }>();
  for (const fixture of fixtures) for (const [teamId, goals, against, shots, corners, fouls, offsides, possession] of [[fixture.homeTeamId, fixture.homeScore, fixture.awayScore, fixture.homeShots, fixture.homeCorners, fixture.homeFouls, fixture.homeOffsides, fixture.homePossession], [fixture.awayTeamId, fixture.awayScore, fixture.homeScore, fixture.awayShots, fixture.awayCorners, fixture.awayFouls, fixture.awayOffsides, fixture.awayPossession]] as const) { const row = stats.get(teamId) || { totalGoals: 0, totalShots: 0, totalCorners: 0, totalFouls: 0, totalOffsides: 0, cleanSheets: 0, possession: [] }; row.totalGoals += goals || 0; row.totalShots += shots || 0; row.totalCorners += corners || 0; row.totalFouls += fouls || 0; row.totalOffsides += offsides || 0; if (against === 0) row.cleanSheets++; if (possession !== null) row.possession.push(possession || 0); stats.set(teamId, row); }
  await prisma.$transaction([prisma.teamStat.deleteMany({ where: { seasonId } }), ...[...stats.entries()].map(([teamId, row]) => prisma.teamStat.upsert({ where: { seasonId_teamId: { seasonId, teamId } }, create: { seasonId, teamId, totalGoals: row.totalGoals, totalAssists: assistsByTeam.get(teamId) || 0, totalShots: row.totalShots, totalCorners: row.totalCorners, totalFouls: row.totalFouls, totalOffsides: row.totalOffsides, cleanSheets: row.cleanSheets, avgPossession: row.possession.length ? row.possession.reduce((a, b) => a + b, 0) / row.possession.length : null }, update: { totalGoals: row.totalGoals, totalAssists: assistsByTeam.get(teamId) || 0, totalShots: row.totalShots, totalCorners: row.totalCorners, totalFouls: row.totalFouls, totalOffsides: row.totalOffsides, cleanSheets: row.cleanSheets, avgPossession: row.possession.length ? row.possession.reduce((a, b) => a + b, 0) / row.possession.length : null } }))]);
}

// Auto-detection runs after every completed fixture so the site always has a
// current "who's leading" view, but it must never look like the season's
// results are final:
//   - It keeps recomputing (upsert), not create-once. Previously this ran
//     once — on the FIRST fixture ever completed in a season — created the
//     award row, and then `if (existing) return;` skipped every future call
//     for that season. Whoever led Golden Boot/MVP/the table after matchday 1
//     stayed the on-site "winner" all season, even as other players and teams
//     overtook them, because nothing ever recalculated it.
//   - It never sets `winnerAnnounced`. That flag means "an admin has
//     officially announced this," and is otherwise only touched by
//     announceWinner() (see the AWARD_WRITABLE_FIELDS comment in
//     controllers/admin/awards.ts). Auto-detection used to set it to `true`
//     on creation, so a mid-season leader was publicly badged as the
//     announced season winner before a ball had barely been kicked.
//   - Once an admin HAS announced a winner for an award, auto-detection
//     leaves it alone — the season is decided for that award; recomputing
//     over it would silently undo the admin's call.
export async function autoDetectAwards(seasonId: string): Promise<void> {
  const stats = aggregatePlayerTotals(await prisma.playerStat.findMany({
    where: { seasonId },
    include: { player: true },
  }));

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
  if (existing?.winnerAnnounced) return;

  let winnerId: string | null | undefined;
  let winnerTeamId: string | null | undefined;
  if (sorter && Array.isArray(data) && data.length > 0) {
    data.sort(sorter);
    winnerId = data[0].playerId;
    winnerTeamId = null;
  } else if (data?.teamId) {
    winnerId = null;
    winnerTeamId = data.teamId;
  }

  if (existing) {
    // Leave a manually-edited name/description alone; only refresh the
    // current-leader pointer, and never touch winnerAnnounced here.
    await prisma.award.update({ where: { id: existing.id }, data: { winnerId, winnerTeamId, ...(winnerTeamId ? { type: "TEAM" } : {}) } });
    return;
  }

  await prisma.award.create({
    data: {
      seasonId,
      name,
      slug,
      description,
      winnerAnnounced: false,
      winnerId,
      winnerTeamId,
      type: winnerTeamId ? "TEAM" : "PLAYER",
    },
  });
}

async function getChampionTeam(seasonId: string) {
  const final = await prisma.fixture.findFirst({
    where: { seasonId, isGrandFinal: true, status: "COMPLETED", deletedAt: null, winnerTeamId: { not: null } },
    select: { winnerTeamId: true },
    orderBy: { finalizedAt: "desc" },
  });
  if (final?.winnerTeamId) return { teamId: final.winnerTeamId };
  return prisma.standing.findFirst({ where: { seasonId, position: 1 } });
}

async function getRunnerUpTeam(seasonId: string) {
  const final = await prisma.fixture.findFirst({
    where: { seasonId, isGrandFinal: true, status: "COMPLETED", deletedAt: null, winnerTeamId: { not: null } },
    select: { homeTeamId: true, awayTeamId: true, winnerTeamId: true },
    orderBy: { finalizedAt: "desc" },
  });
  if (final?.winnerTeamId) return { teamId: final.winnerTeamId === final.homeTeamId ? final.awayTeamId : final.homeTeamId };
  return prisma.standing.findFirst({ where: { seasonId, position: 2 } });
}
