import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { fixtureScheduleFields } from "../utils/fixtures.js";
import { rankStandings } from "../utils/standings.js";
import { retrySerializable } from "../utils/transaction-retry.js";
import { countedFixturesWhere, recalculateStandings } from "./league-system.js";
import { syncFixtureBooking } from "./fixture-bookings.js";

type Db = Prisma.TransactionClient | typeof prisma;

const regularFixtures = (seasonId: string): Prisma.FixtureWhereInput => ({
  seasonId, deletedAt: null, isFriendly: false, isGrandFinal: false, isRelegationPlayoff: false,
  OR: [{ competitionId: null }, { competition: { is: { type: "LEAGUE" } } }],
});

function suggestedFinalDate(endDate: Date) {
  const date = new Date(Math.max(endDate.getTime(), Date.now()));
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

async function preview(db: Db, seasonId: string) {
  const season = await db.season.findFirst({ where: { id: seasonId, deletedAt: null }, select: { id: true, name: true, endDate: true, lifecycle: true } });
  if (!season) throw new AppError("Season not found", 404);

  const [standings, results, pendingMatches, finals] = await Promise.all([
    db.standing.findMany({ where: { seasonId, team: { isActive: true, deletedAt: null } }, include: { team: { select: { id: true, name: true } } } }),
    db.fixture.findMany({ where: countedFixturesWhere(seasonId), select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true } }),
    db.fixture.count({ where: { ...regularFixtures(seasonId), status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    db.fixture.findMany({ where: { seasonId, isGrandFinal: true, deletedAt: null }, select: { id: true, homeTeamId: true, awayTeamId: true, status: true, scheduledDate: true, kickoffTime: true, venueId: true, stadium: true, isGrandFinal: true } }),
  ]);
  if (finals.length > 1) throw new AppError("More than one final exists for this season. Resolve the duplicate fixtures before scheduling.", 409);

  const byId = new Map(standings.map((row) => [row.teamId, row]));
  const ranked = rankStandings(
    standings.map((row) => row.teamId),
    Object.fromEntries(standings.map((row) => [row.teamId, { pts: row.points, gd: row.goalDifference, gf: row.goalsFor }])),
    results,
    Object.fromEntries(standings.map((row) => [row.teamId, row.team.name])),
  );
  const finalists = ranked.slice(0, 2).map((id) => {
    const standing = byId.get(id)!;
    const tied = new Set(standings.filter((row) => row.points === standing.points).map((row) => row.teamId));
    const headToHeadGoalDifference = tied.size < 2 ? null : results.reduce((difference, fixture) => {
      if (!tied.has(fixture.homeTeamId) || !tied.has(fixture.awayTeamId)) return difference;
      if (fixture.homeTeamId === id) return difference + fixture.homeScore! - fixture.awayScore!;
      if (fixture.awayTeamId === id) return difference + fixture.awayScore! - fixture.homeScore!;
      return difference;
    }, 0);
    return { id, name: standing.team.name, points: standing.points, headToHeadGoalDifference };
  });
  const ready = season.lifecycle === "ACTIVE" && pendingMatches === 0 && results.length > 0 && finalists.length === 2;
  const reason = season.lifecycle !== "ACTIVE" ? "Activate the season before setting its final."
    : pendingMatches ? `${pendingMatches} league match${pendingMatches === 1 ? "" : "es"} still need a result.`
    : !results.length ? "Complete at least one league match first."
    : finalists.length < 2 ? "At least two teams need standings." : null;

  return { seasonId, seasonName: season.name, ready, reason, completedMatches: results.length, pendingMatches, finalists, suggestedDate: suggestedFinalDate(season.endDate), final: finals[0] || null };
}

export function previewLeagueFinal(seasonId: string) {
  return preview(prisma, seasonId);
}

export async function setLeagueFinal(seasonId: string, input: { matchDate: string; kickoffTime: string; venueId: string; stadium?: string }) {
  const { matchDate, kickoffTime, venueId } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate || "") || Number.isNaN(Date.parse(`${matchDate}T00:00:00Z`)) || new Date(`${matchDate}T00:00:00Z`).toISOString().slice(0, 10) !== matchDate) throw new AppError("A valid final date is required", 400);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(kickoffTime || "")) throw new AppError("A valid kickoff time is required", 400);
  if (!venueId) throw new AppError("Choose a venue for the final", 400);

  await recalculateStandings(seasonId);
  return retrySerializable(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20260922, hashtext(${seasonId}))::text`;
    const state = await preview(tx, seasonId);
    if (!state.ready) throw new AppError(state.reason || "The final is not ready", 409);
    const [home, away] = state.finalists;
    const existing = state.final;
    if (existing && !["SCHEDULED", "POSTPONED"].includes(existing.status)) {
      if (existing.homeTeamId !== home.id || existing.awayTeamId !== away.id) throw new AppError("The final has started, so its teams cannot change", 409);
      return existing;
    }

    const [venue, competition] = await Promise.all([
      tx.venue.findFirst({ where: { id: venueId, isActive: true, deletedAt: null }, select: { id: true, name: true, timezone: true } }),
      tx.competition.findFirst({ where: { seasonId, type: "LEAGUE", isActive: true, deletedAt: null }, select: { id: true } }),
    ]);
    if (!venue) throw new AppError("Choose an active venue for the final", 400);
    if (existing && (existing.homeTeamId !== home.id || existing.awayTeamId !== away.id)) {
      const selections = await tx.lineup.count({ where: { fixtureId: existing.id } });
      if (selections) throw new AppError("The final's teams changed after lineups were selected. Clear those lineups before updating the final.", 409);
    }
    const schedule = fixtureScheduleFields(matchDate, kickoffTime, venue.timezone || "Asia/Kolkata");
    const conflict = await tx.fixture.findFirst({
      where: {
        seasonId, deletedAt: null, scheduledDate: matchDate,
        kickoffAt: schedule.kickoffAt,
        status: { notIn: ["CANCELLED", "POSTPONED"] },
        ...(existing ? { id: { not: existing.id } } : {}),
        OR: [{ homeTeamId: { in: [home.id, away.id] } }, { awayTeamId: { in: [home.id, away.id] } }],
      },
      select: { id: true },
    });
    if (conflict) throw new AppError("One of the finalists already has a match at this time", 409);

    const data = {
      homeTeamId: home.id, awayTeamId: away.id, competitionId: competition?.id || null,
      matchDate: new Date(`${matchDate}T00:00:00Z`), scheduledDate: matchDate, kickoffTime, kickoffAt: schedule.kickoffAt,
      venueId: venue.id, stadium: input.stadium?.trim() || venue.name,
      isGrandFinal: true, isRelegationPlayoff: false, isFriendly: false, status: "SCHEDULED" as const,
    };
    const fixture = existing
      ? await tx.fixture.update({ where: { id: existing.id }, data })
      : await tx.fixture.create({ data: { ...data, seasonId, round: 99 } });
    await syncFixtureBooking(fixture.id, tx);
    return fixture;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
