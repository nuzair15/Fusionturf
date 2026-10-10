import { MatchStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

const uuid = z.string().uuid();
const minute = z.coerce.number().int().min(0).max(300);
const reason = z.string().trim().max(500).optional();
const stats = ["homePossession", "awayPossession", "homeShots", "awayShots", "homeShotsOnTarget", "awayShotsOnTarget", "homeCorners", "awayCorners", "homeFouls", "awayFouls", "homeOffsides", "awayOffsides", "homeExpectedGoals", "awayExpectedGoals"] as const;
const running = (status: MatchStatus) => status === "LIVE" || status === "EXTRA_TIME";
const knockoutStage = (stage: string) => ["KNOCKOUT", "WINNERS", "LOSERS", "FINAL"].includes(stage);
const playerName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
const jsonObject = (value: Prisma.JsonValue | null) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const eventPlayer = (p: { id: string; firstName: string; lastName: string; photoUrl: string | null; jerseyNumber: number | null; position: string | null; teamId: string } | null, snapshot?: string | null, teamId?: string | null) => p ? ({
  id: p.id, firstName: p.firstName, lastName: p.lastName, photoUrl: p.photoUrl || undefined, jerseyNumber: p.jerseyNumber || undefined, position: p.position || undefined, teamId: p.teamId,
}) : ({ id: "", firstName: snapshot || "Unknown", lastName: "", teamId: teamId || undefined });

export async function liveStats(fixtureId: string) {
  const f = await prisma.tournamentFixture.findUnique({
    where: { id: fixtureId },
    include: {
      tournament: true,
      homeTeam: { include: { players: { orderBy: { jerseyNumber: "asc" } } } },
      awayTeam: { include: { players: { orderBy: { jerseyNumber: "asc" } } } },
      lineups: true,
      events: { include: { player: true, relatedPlayer: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!f) throw new AppError("Tournament fixture not found", 404);
  const clockSeconds = f.matchClockSeconds + (running(f.status) && f.matchClockStartedAt ? Math.max(0, Math.floor((Date.now() - f.matchClockStartedAt.getTime()) / 1000)) : 0);
  const fixtureStats = jsonObject(f.teamStats);
  const goals = f.events.filter(e => ["GOAL", "OWN_GOAL", "PENALTY_GOAL"].includes(e.kind)).map(e => ({
    id: e.id, minute: e.minute, teamId: e.kind === "OWN_GOAL" ? (e.teamId === f.homeTeamId ? f.awayTeamId : f.homeTeamId) : e.teamId,
    isOwnGoal: e.kind === "OWN_GOAL", isPenalty: e.kind === "PENALTY_GOAL", player: eventPlayer(e.player, e.playerName, e.teamId),
  }));
  const assists = f.events.filter(e => e.kind === "ASSIST").map(e => ({ id: e.id, goalId: String(jsonObject(e.metadata).goalId || ""), minute: e.minute, player: eventPlayer(e.player, e.playerName, e.teamId) }));
  const cards = f.events.filter(e => ["YELLOW", "SECOND_YELLOW", "RED"].includes(e.kind)).map(e => ({ id: e.id, minute: e.minute, type: e.kind, player: eventPlayer(e.player, e.playerName, e.teamId), reason: e.note || undefined }));
  const substitutions = f.events.filter(e => e.kind === "SUBSTITUTION").map(e => ({ id: e.id, minute: e.minute, playerOff: eventPlayer(e.player, e.playerName, e.teamId), playerOn: eventPlayer(e.relatedPlayer, e.relatedPlayerName, e.teamId) }));
  const notes = f.events.filter(e => ["VAR", "MISSED_PENALTY", "INFO", "AWARDED_GOAL"].includes(e.kind)).map(e => ({
    id: e.id, minute: e.minute, type: e.kind === "AWARDED_GOAL" ? "INFO" : e.kind, note: e.kind === "AWARDED_GOAL" ? "[AWARDED_GOAL]" : e.note,
    teamId: e.teamId, player: e.playerId ? eventPlayer(e.player, e.playerName, e.teamId) : undefined,
  }));
  const ratingMap = jsonObject(f.playerRatings);
  const lineupMap = new Map(f.lineups.map(l => [l.playerId, l]));
  const present = new Set(f.events.filter(e => e.kind === "APPEARANCE" || e.kind === "SUBSTITUTION").flatMap(e => [e.playerId, e.relatedPlayerId].filter((v): v is string => !!v)));
  const team = (t: typeof f.homeTeam) => ({
    id: t.id, name: t.name, shortName: t.shortName || undefined, logoUrl: t.logoUrl || undefined,
    players: t.players.filter(p => p.isActive || f.lineups.some(l => l.playerId === p.id)).map(p => {
      const lineup = lineupMap.get(p.id);
      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, jerseyNumber: p.jerseyNumber || undefined, position: p.position || undefined,
        photoUrl: p.photoUrl || undefined, inLineup: !!lineup, isStarter: lineup?.isStarter || false, isCaptain: lineup?.isCaptain || false,
        isGoalkeeper: lineup?.isGoalkeeper || false, role: lineup?.position || p.position,
        appearance: lineup || present.has(p.id) ? { isStarter: lineup?.isStarter || false, enteredAt: null } : null,
        stats: {
          goals: f.events.filter(e => e.playerId === p.id && ["GOAL", "PENALTY_GOAL"].includes(e.kind)).length,
          assists: f.events.filter(e => e.playerId === p.id && e.kind === "ASSIST").length,
          yellowCards: f.events.filter(e => e.playerId === p.id && ["YELLOW", "SECOND_YELLOW"].includes(e.kind)).length,
          redCards: f.events.filter(e => e.playerId === p.id && e.kind === "RED").length,
        },
      };
    }),
  });
  return {
    fixture: {
      id: f.id, matchDate: f.kickoffAt.toISOString(), kickoffTime: new Intl.DateTimeFormat("en-GB", { timeZone: f.tournament.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(f.kickoffAt),
      status: f.status, matchClockSeconds: clockSeconds, matchClockServerTime: running(f.status) ? new Date().toISOString() : undefined,
      competition: { name: f.tournament.name }, round: f.round, hasKnockoutBracket: knockoutStage(f.stage), isGrandFinal: f.stage === "FINAL",
      homeScore: f.homeScore, awayScore: f.awayScore, penaltiesHomeScore: f.penaltiesHomeScore, penaltiesAwayScore: f.penaltiesAwayScore,
      winnerTeamId: f.winnerTeamId, manOfTheMatchId: f.manOfTheMatchId, matchPlayerRatings: ratingMap,
      halfLengthMinutes: f.tournament.halfLengthMinutes, halftimeBreakMinutes: f.tournament.halftimeBreakMinutes, lineupSize: f.tournament.lineupSize,
      ...fixtureStats,
    },
    homeTeam: team(f.homeTeam), awayTeam: team(f.awayTeam),
    matchStats: { goals, assists, cards, substitutions, notes },
  };
}

type Tx = Prisma.TransactionClient;
async function recalculateScore(tx: Tx, fixtureId: string, homeTeamId: string, awayTeamId: string) {
  const events = await tx.tournamentEvent.findMany({ where: { fixtureId, kind: { in: ["GOAL", "OWN_GOAL", "PENALTY_GOAL", "AWARDED_GOAL"] } } });
  let homeScore = 0, awayScore = 0;
  for (const e of events) {
    const credited = e.kind === "OWN_GOAL" ? (e.teamId === homeTeamId ? awayTeamId : homeTeamId) : e.teamId;
    if (credited === homeTeamId) homeScore++;
    else if (credited === awayTeamId) awayScore++;
  }
  const fixture = await tx.tournamentFixture.findUniqueOrThrow({ where: { id: fixtureId } });
  const winnerTeamId = homeScore === awayScore && fixture.penaltiesHomeScore != null && fixture.penaltiesAwayScore != null
    ? (fixture.penaltiesHomeScore > fixture.penaltiesAwayScore ? homeTeamId : awayTeamId)
    : homeScore === awayScore ? null : homeScore > awayScore ? homeTeamId : awayTeamId;
  await tx.tournamentFixture.update({ where: { id: fixtureId }, data: {
    homeScore, awayScore, winnerTeamId,
    ...(homeScore !== awayScore ? { penaltiesHomeScore: null, penaltiesAwayScore: null } : {}),
  } });
}

async function findPlayer(tx: Tx, tournamentId: string, teamId: string, playerId: string) {
  const player = await tx.tournamentPlayer.findFirst({ where: { id: playerId, tournamentId, teamId, isActive: true } });
  if (!player) throw new AppError("Player is not active on this tournament team", 400);
  return player;
}
async function createEvent(tx: Tx, fixture: { id: string; tournamentId: string; homeTeamId: string; awayTeamId: string }, input: { kind: string; teamId?: string; playerId?: string; relatedPlayerId?: string; minute: number; note?: string; metadata?: Prisma.InputJsonValue }) {
  if (input.teamId && ![fixture.homeTeamId, fixture.awayTeamId].includes(input.teamId)) throw new AppError("Team is not in this fixture", 400);
  const player = input.playerId && input.teamId ? await findPlayer(tx, fixture.tournamentId, input.teamId, input.playerId) : null;
  const related = input.relatedPlayerId && input.teamId ? await findPlayer(tx, fixture.tournamentId, input.teamId, input.relatedPlayerId) : null;
  return tx.tournamentEvent.create({ data: {
    fixtureId: fixture.id, kind: input.kind, teamId: input.teamId, playerId: player?.id, relatedPlayerId: related?.id,
    playerName: player ? playerName(player) : undefined, relatedPlayerName: related ? playerName(related) : undefined,
    minute: input.minute, note: input.note, metadata: input.metadata,
  } });
}
async function addCorrection(tx: Tx, fixtureId: string, action: string, correctionReason: string | undefined, userId: string) {
  if (!correctionReason?.trim()) return;
  await tx.tournamentEvent.create({ data: { fixtureId, kind: "CORRECTION", minute: 0, note: correctionReason.trim(), metadata: { action, userId } } });
}

export async function liveAction(fixtureId: string, raw: unknown, userId: string) {
  const base = z.object({ action: z.string().min(1), correctionReason: reason }).passthrough().parse(raw);
  return prisma.$transaction(async tx => {
    const f = await tx.tournamentFixture.findUnique({ where: { id: fixtureId }, include: { tournament: true } });
    if (!f) throw new AppError("Tournament fixture not found", 404);
    if (f.tournament.status === "DRAFT") throw new AppError("Publish the tournament before starting matches", 409);
    const action = base.action;
    const reopensCompletedTournament = f.tournament.status === "COMPLETED"
      && f.status === "COMPLETED"
      && action === "setStatus"
      && base.status === "LIVE";
    if (f.tournament.status === "COMPLETED" && !reopensCompletedTournament) throw new AppError("Tournament is completed", 409);
    if (["SCHEDULED", "POSTPONED", "CANCELLED"].includes(f.status) && action !== "setStatus") throw new AppError("Start the match before recording events", 409);
    if (f.status === "PENALTIES" && action !== "completePenaltyShootout") throw new AppError("Finish the penalty shootout before other changes", 409);
    if (f.status === "COMPLETED" && !["setStatus", "updateGoal", "updateCard", "removeEvent", "removeGoal", "setMatchRating", "setManOfTheMatch", "completePenaltyShootout"].includes(action)) throw new AppError("Completed matches are read-only", 409);
    if (f.status === "COMPLETED" && !base.correctionReason?.trim()) throw new AppError("Enter a correction reason for a completed match", 400);
    const downstream = f.status === "COMPLETED" && await tx.tournamentFixture.count({ where: { tournamentId: f.tournamentId, stage: { in: ["KNOCKOUT", "WINNERS", "LOSERS", "FINAL"] }, round: { gt: f.round } } });
    if (downstream && ["updateGoal", "removeEvent", "removeGoal", "completePenaltyShootout"].includes(action)) throw new AppError("A later knockout round already exists. Correct that bracket before changing this result.", 409);
    const eventMinute = (v: unknown) => minute.parse(v ?? Math.floor(f.matchClockSeconds / 60));
    let result: unknown = { ok: true };
    if (action === "setStatus") {
      const { status } = z.object({ status: z.nativeEnum(MatchStatus) }).parse(base);
      const valid: Record<string, string[]> = {
        SCHEDULED: ["LIVE", "CANCELLED", "POSTPONED"],
        POSTPONED: ["SCHEDULED"], LIVE: ["PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES", "COMPLETED"],
        PAUSED: ["LIVE", "HALF_TIME", "EXTRA_TIME", "PENALTIES", "COMPLETED"],
        HALF_TIME: ["LIVE", "EXTRA_TIME", "PENALTIES", "COMPLETED"],
        EXTRA_TIME: ["PAUSED", "PENALTIES", "COMPLETED"], PENALTIES: [], COMPLETED: ["LIVE"],
      };
      if (!valid[f.status]?.includes(status)) throw new AppError("Invalid match status change", 409);
      const elapsed = running(f.status) && f.matchClockStartedAt ? Math.max(0, Math.floor((Date.now() - f.matchClockStartedAt.getTime()) / 1000)) : 0;
      if (status === "COMPLETED" && knockoutStage(f.stage) && !f.winnerTeamId && f.homeScore === f.awayScore) throw new AppError("A knockout match needs a winner. Record a penalty shootout for a draw.", 409);
      result = await tx.tournamentFixture.update({ where: { id: f.id }, data: {
        status, matchClockSeconds: f.matchClockSeconds + elapsed, matchClockStartedAt: running(status) ? new Date() : null,
        winnerTeamId: status === "COMPLETED" ? (f.winnerTeamId || (f.homeScore === f.awayScore ? null : f.homeScore > f.awayScore ? f.homeTeamId : f.awayTeamId)) : f.status === "COMPLETED" ? null : f.winnerTeamId,
      } });
      if (status === "LIVE" && ["PUBLISHED", "COMPLETED"].includes(f.tournament.status)) await tx.tournament.update({ where: { id: f.tournamentId }, data: { status: "LIVE" } });
    } else if (action === "resetClock" || action === "setClock") {
      const seconds = action === "resetClock" ? 0 : z.number().int().min(0).max(18_000).parse(base.seconds);
      const previousSeconds = f.matchClockSeconds + (running(f.status) && f.matchClockStartedAt ? Math.max(0, Math.floor((Date.now() - f.matchClockStartedAt.getTime()) / 1000)) : 0);
      result = await tx.tournamentFixture.update({ where: { id: f.id }, data: { matchClockSeconds: seconds, matchClockStartedAt: running(f.status) ? new Date() : null } });
      await tx.tournamentEvent.create({ data: {
        fixtureId: f.id, kind: "CORRECTION", minute: Math.floor(seconds / 60), note: action === "resetClock" ? "Match clock reset" : "Match clock adjusted",
        metadata: { action: action === "resetClock" ? "CLOCK_RESET" : "CLOCK_SET", previousSeconds, nextSeconds: seconds, userId },
      } });
    } else if (action === "completePenaltyShootout") {
      const input = z.object({ penaltiesHomeScore: z.number().int().min(0), penaltiesAwayScore: z.number().int().min(0), winnerTeamId: uuid }).parse(base);
      if (!knockoutStage(f.stage) || !["PENALTIES", "COMPLETED"].includes(f.status)) throw new AppError("Penalty result is only available for a knockout shootout", 409);
      if (f.homeScore !== f.awayScore || input.penaltiesHomeScore === input.penaltiesAwayScore) throw new AppError("The match must be tied and the shootout must have a winner", 400);
      const winner = input.penaltiesHomeScore > input.penaltiesAwayScore ? f.homeTeamId : f.awayTeamId;
      if (input.winnerTeamId !== winner) throw new AppError("Shootout winner does not match the scores", 400);
      result = await tx.tournamentFixture.update({ where: { id: f.id }, data: { penaltiesHomeScore: input.penaltiesHomeScore, penaltiesAwayScore: input.penaltiesAwayScore, winnerTeamId: winner, status: "COMPLETED", matchClockStartedAt: null } });
    } else if (action === "updateTeamStats") {
      const input = z.record(z.union([z.number(), z.string()])).parse(base);
      const values = { ...jsonObject(f.teamStats) };
      for (const key of stats) {
        if (input[key] === undefined) continue;
        const value = Number(input[key]);
        if (!Number.isFinite(value) || value < 0 || (key.includes("Possession") && value > 100) || value > 10000) throw new AppError("Invalid team statistic", 400);
        values[key] = value;
      }
      result = await tx.tournamentFixture.update({ where: { id: f.id }, data: { teamStats: values as Prisma.InputJsonValue } });
    } else if (action === "addGoal" || action === "updateGoal") {
      const input = z.object({ teamId: uuid, scorerId: uuid, assistId: uuid.optional().nullable(), minute, isOwnGoal: z.boolean().default(false), isPenalty: z.boolean().default(false), goalId: uuid.optional() }).parse(base);
      if (input.isOwnGoal && input.assistId) throw new AppError("Own goals cannot have an assist", 400);
      if (input.assistId === input.scorerId) throw new AppError("Scorer and assister must differ", 400);
      if (![f.homeTeamId, f.awayTeamId].includes(input.teamId)) throw new AppError("Team is not in this fixture", 400);
      const kind = input.isOwnGoal ? "OWN_GOAL" : input.isPenalty ? "PENALTY_GOAL" : "GOAL";
      if (action === "updateGoal") {
        if (!input.goalId) throw new AppError("Goal ID required", 400);
        const old = await tx.tournamentEvent.findFirst({ where: { id: input.goalId, fixtureId: f.id, kind: { in: ["GOAL", "OWN_GOAL", "PENALTY_GOAL"] } } });
        if (!old) throw new AppError("Goal not found", 404);
        await tx.tournamentEvent.deleteMany({ where: { fixtureId: f.id, kind: "ASSIST", metadata: { path: ["goalId"], equals: old.id } } });
        const player = await findPlayer(tx, f.tournamentId, input.teamId, input.scorerId);
        result = await tx.tournamentEvent.update({ where: { id: old.id }, data: { teamId: input.teamId, playerId: player.id, playerName: playerName(player), minute: input.minute, kind } });
      } else {
        result = await createEvent(tx, f, { teamId: input.teamId, playerId: input.scorerId, minute: input.minute, kind });
      }
      if (input.assistId) await createEvent(tx, f, { teamId: input.teamId, playerId: input.assistId, minute: input.minute, kind: "ASSIST", metadata: { goalId: (result as { id: string }).id } });
      await recalculateScore(tx, f.id, f.homeTeamId, f.awayTeamId);
    } else if (action === "addAwardedGoal") {
      const input = z.object({ teamId: uuid, minute }).parse(base);
      result = await createEvent(tx, f, { ...input, kind: "AWARDED_GOAL" });
      await recalculateScore(tx, f.id, f.homeTeamId, f.awayTeamId);
    } else if (action === "updateCard") {
      const input = z.object({ cardId: uuid, teamId: uuid, playerId: uuid, type: z.enum(["YELLOW", "SECOND_YELLOW", "RED"]), minute }).parse(base);
      const old = await tx.tournamentEvent.findFirst({ where: { id: input.cardId, fixtureId: f.id, kind: { in: ["YELLOW", "SECOND_YELLOW", "RED"] } } });
      if (!old) throw new AppError("Card not found", 404);
      if (![f.homeTeamId, f.awayTeamId].includes(input.teamId)) throw new AppError("Team is not in this fixture", 400);
      const player = await findPlayer(tx, f.tournamentId, input.teamId, input.playerId);
      result = await tx.tournamentEvent.update({ where: { id: old.id }, data: { teamId: input.teamId, playerId: player.id, playerName: playerName(player), minute: input.minute, kind: input.type } });
    } else if (action === "updateLiveStat") {
      const input = z.object({ playerId: uuid, teamId: uuid, statType: z.enum(["goal", "assist", "yellowCard", "redCard"]), statAction: z.enum(["increment", "decrement"]), minute: minute.optional() }).parse(base);
      const kind = ({ goal: "GOAL", assist: "ASSIST", yellowCard: "YELLOW", redCard: "RED" } as const)[input.statType];
      if (input.statAction === "increment") {
        result = await createEvent(tx, f, { playerId: input.playerId, teamId: input.teamId, kind, minute: eventMinute(input.minute) });
      } else {
        const old = await tx.tournamentEvent.findFirst({ where: { fixtureId: f.id, playerId: input.playerId, kind }, orderBy: { createdAt: "desc" } });
        if (!old) throw new AppError("No matching event to remove", 404);
        if (kind === "GOAL") await tx.tournamentEvent.deleteMany({ where: { fixtureId: f.id, kind: "ASSIST", metadata: { path: ["goalId"], equals: old.id } } });
        await tx.tournamentEvent.delete({ where: { id: old.id } });
        result = { id: old.id };
      }
      if (kind === "GOAL") await recalculateScore(tx, f.id, f.homeTeamId, f.awayTeamId);
    } else if (action === "addSubstitution") {
      const input = z.object({ teamId: uuid, playerOffId: uuid, playerOnId: uuid, minute }).parse(base);
      if (input.playerOffId === input.playerOnId) throw new AppError("Choose two different players", 400);
      result = await createEvent(tx, f, { teamId: input.teamId, playerId: input.playerOffId, relatedPlayerId: input.playerOnId, minute: input.minute, kind: "SUBSTITUTION" });
    } else if (action === "addNote") {
      const input = z.object({ teamId: uuid.optional(), playerId: uuid.optional(), type: z.enum(["VAR", "MISSED_PENALTY", "INFO"]), minute, note: z.string().trim().max(1000).optional() }).parse(base);
      result = await createEvent(tx, f, { teamId: input.teamId, playerId: input.playerId, kind: input.type, minute: input.minute, note: input.note });
    } else if (action === "recordAppearance" || action === "recordShot") {
      const input = z.object({ playerId: uuid, teamId: uuid, minute: minute.optional(), outcome: z.enum(["ON_TARGET", "OFF_TARGET"]).optional() }).parse(base);
      if (action === "recordShot" && !input.outcome) throw new AppError("Shot outcome is required", 400);
      result = await createEvent(tx, f, { playerId: input.playerId, teamId: input.teamId, kind: action === "recordShot" ? "SHOT" : "APPEARANCE", minute: eventMinute(input.minute), metadata: action === "recordShot" ? { outcome: input.outcome } : undefined });
      if (action === "recordShot") {
        const key = input.teamId === f.homeTeamId ? "home" : "away";
        const values = { ...jsonObject(f.teamStats) };
        values[`${key}Shots`] = Number(values[`${key}Shots`] || 0) + 1;
        if (input.outcome === "ON_TARGET") values[`${key}ShotsOnTarget`] = Number(values[`${key}ShotsOnTarget`] || 0) + 1;
        await tx.tournamentFixture.update({ where: { id: f.id }, data: { teamStats: values as Prisma.InputJsonValue } });
      }
    } else if (action === "removeEvent" || action === "removeGoal") {
      const input = z.object({ eventId: uuid.optional(), playerId: uuid.optional(), type: z.string().optional() }).parse(base);
      const old = input.eventId
        ? await tx.tournamentEvent.findFirst({ where: { id: input.eventId, fixtureId: f.id } })
        : input.playerId ? await tx.tournamentEvent.findFirst({ where: { fixtureId: f.id, playerId: input.playerId, kind: { in: ["GOAL", "OWN_GOAL", "PENALTY_GOAL"] } }, orderBy: { createdAt: "desc" } }) : null;
      if (!old) throw new AppError("Match event not found", 404);
      if (input.type && !({ goal: ["GOAL", "OWN_GOAL", "PENALTY_GOAL"], assist: ["ASSIST"], card: ["YELLOW", "SECOND_YELLOW", "RED"], substitution: ["SUBSTITUTION"], note: ["VAR", "MISSED_PENALTY", "INFO", "AWARDED_GOAL"] } as Record<string, string[]>)[input.type]?.includes(old.kind)) throw new AppError("Event type does not match", 400);
      if (["GOAL", "OWN_GOAL", "PENALTY_GOAL"].includes(old.kind)) await tx.tournamentEvent.deleteMany({ where: { fixtureId: f.id, kind: "ASSIST", metadata: { path: ["goalId"], equals: old.id } } });
      await tx.tournamentEvent.delete({ where: { id: old.id } });
      if (["GOAL", "OWN_GOAL", "PENALTY_GOAL", "AWARDED_GOAL"].includes(old.kind)) await recalculateScore(tx, f.id, f.homeTeamId, f.awayTeamId);
      result = { id: old.id };
    } else if (action === "setMatchRating") {
      const input = z.object({ playerId: uuid, rating: z.number().min(0).max(10) }).parse(base);
      const player = await tx.tournamentPlayer.findFirst({ where: { id: input.playerId, tournamentId: f.tournamentId, teamId: { in: [f.homeTeamId, f.awayTeamId] } } });
      if (!player) throw new AppError("Player is not in this fixture", 400);
      const ratings = { ...jsonObject(f.playerRatings), [input.playerId]: input.rating };
      result = await tx.tournamentFixture.update({ where: { id: f.id }, data: { playerRatings: ratings as Prisma.InputJsonValue } });
    } else if (action === "setManOfTheMatch") {
      const input = z.object({ playerId: uuid.optional() }).parse(base);
      if (input.playerId) {
        const player = await tx.tournamentPlayer.findFirst({ where: { id: input.playerId, tournamentId: f.tournamentId, teamId: { in: [f.homeTeamId, f.awayTeamId] } } });
        if (!player) throw new AppError("Player is not in this fixture", 400);
      }
      result = await tx.tournamentFixture.update({ where: { id: f.id }, data: { manOfTheMatchId: input.playerId || null } });
    } else {
      throw new AppError("Unknown live match action", 400);
    }
    if (f.status === "COMPLETED") await addCorrection(tx, f.id, action, base.correctionReason, userId);
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
