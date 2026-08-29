import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";
import { appendMatchEvent, reverseLegacyEvent } from "../../services/match-events.js";

// Live match console: stats, goals, substitutions, ratings, MOTM

const assertMutableFixture = (status: string, correctionReason?: unknown) => {
  if (status !== "COMPLETED") return false;
  if (typeof correctionReason !== "string" || !correctionReason.trim()) {
    throw new AppError("Completed matches require a correctionReason", 400);
  }
  return true;
};

const ACTIVE_EVENT_STATES = ["LIVE", "PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES"];
const AWARDED_GOAL_NOTE = "[AWARDED_GOAL]";
const assertEventMutable = (status: string, correctionReason?: unknown) => {
  if (ACTIVE_EVENT_STATES.includes(status)) return false;
  if (status === "COMPLETED") return assertMutableFixture(status, correctionReason);
  throw new AppError("Match events can only be recorded during an active match", 409, "ILLEGAL_MATCH_STATE");
};

const rebuildIfCorrected = async (fixture: { status: string; seasonId: string }, correctionReason?: unknown) => {
  if (assertMutableFixture(fixture.status, correctionReason)) {
    await leagueSystem.recalculateStandings(fixture.seasonId);
    await leagueSystem.recalculatePlayerStats(fixture.seasonId);
    await leagueSystem.recalculateFriendlyPlayerStats(fixture.seasonId);
    await leagueSystem.recalculateTeamStats(fixture.seasonId);
  }
};


export const getLiveStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        competition: { select: { name: true } },
      },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const homePlayers = await prisma.player.findMany({
      where: { teamId: fixture.homeTeamId, seasonId: fixture.seasonId, isActive: true },
      include: {
        homeStats: { where: { seasonId: fixture.seasonId } },
        cards: { where: { fixtureId: fixture.id } },
      },
      orderBy: { jerseyNumber: "asc" },
    });

    const awayPlayers = await prisma.player.findMany({
      where: { teamId: fixture.awayTeamId, seasonId: fixture.seasonId, isActive: true },
      include: {
        homeStats: { where: { seasonId: fixture.seasonId } },
        cards: { where: { fixtureId: fixture.id } },
      },
      orderBy: { jerseyNumber: "asc" },
    });

      const goals = await prisma.goal.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } } });
    const assists = await prisma.assist.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } } });
    const cards = await prisma.card.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } } });
    const substitutions = await prisma.substitution.findMany({ where: { fixtureId: fixture.id }, include: { playerOff: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } }, playerOn: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } }, orderBy: { minute: "asc" } });
    const notes = await prisma.matchNote.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } }, orderBy: { minute: "asc" } });
    const ratings = await prisma.matchPlayerRating.findMany({ where: { fixtureId: fixture.id }, select: { playerId: true, rating: true } });
    const appearances = await prisma.matchAppearance.findMany({ where: { fixtureId: fixture.id }, select: { playerId: true, isStarter: true, enteredAt: true } });
    const shots = await prisma.matchShot.findMany({ where: { fixtureId: fixture.id }, select: { playerId: true, outcome: true } });
    const lineups = await prisma.lineup.findMany({ where: { fixtureId: fixture.id } });
    const lineupByPlayer = new Map(lineups.map((l) => [l.playerId, l]));
    const hasLineup = lineups.length > 0;

    const inMatchSquad = (p: any) => !hasLineup || lineupByPlayer.has(p.id);

    const formatPlayer = (p: any) => {
      const lu = lineupByPlayer.get(p.id);
      return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: lu?.jerseyNumber ?? p.jerseyNumber,
      position: lu?.role ?? p.position,
      photoUrl: p.photoUrl,
      squadType: p.squadType,
      inLineup: !!lu,
      isStarter: hasLineup ? !!lu?.isStarter : (p.squadType ? p.squadType === "STARTER" : true),
      isCaptain: lu?.isCaptain ?? false,
      isGoalkeeper: lu?.isGoalkeeper ?? (p.position === "GK"),
      role: lu?.role ?? null,
      stats: {
        goals: goals.filter((g: any) => g.playerId === p.id && !g.isOwnGoal).length,
        assists: assists.filter((a: any) => a.playerId === p.id).length,
        yellowCards: cards.filter((c: any) => c.playerId === p.id && c.type === "YELLOW").length,
        redCards: cards.filter((c: any) => c.playerId === p.id && (c.type === "RED" || c.type === "SECOND_YELLOW")).length,
        shots: shots.filter((s) => s.playerId === p.id).length,
        shotsOnTarget: shots.filter((s) => s.playerId === p.id && s.outcome === "ON_TARGET").length,
      },
      appearance: appearances.find((a) => a.playerId === p.id) || null,
      };
    };

    const homeSquad = homePlayers.filter(inMatchSquad);
    const awaySquad = awayPlayers.filter(inMatchSquad);

    res.json({
      fixture: {
        id: fixture.id,
        matchDate: fixture.matchDate,
        status: fixture.status,
        matchClockSeconds: fixture.matchClockSeconds + (fixture.status === "LIVE" && fixture.matchClockStartedAt
          ? Math.max(0, Math.floor((Date.now() - fixture.matchClockStartedAt.getTime()) / 1000)) : 0),
        matchClockServerTime: new Date().toISOString(),
        kickoffTime: fixture.kickoffTime,
        round: fixture.round,
        stadium: fixture.stadium,
        competition: fixture.competition,
        manOfTheMatchId: fixture.manOfTheMatchId,
        matchPlayerRatings: Object.fromEntries(ratings.map((r) => [r.playerId, r.rating])),
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        homePossession: fixture.homePossession,
        awayPossession: fixture.awayPossession,
        homeShots: fixture.homeShots,
        awayShots: fixture.awayShots,
        homeShotsOnTarget: fixture.homeShotsOnTarget,
        awayShotsOnTarget: fixture.awayShotsOnTarget,
        homeCorners: fixture.homeCorners,
        awayCorners: fixture.awayCorners,
        homeFouls: fixture.homeFouls,
        awayFouls: fixture.awayFouls,
        homeOffsides: fixture.homeOffsides,
        awayOffsides: fixture.awayOffsides,
        homeExpectedGoals: fixture.homeExpectedGoals,
        awayExpectedGoals: fixture.awayExpectedGoals,
      },
      homeTeam: { ...fixture.homeTeam, players: homeSquad.map(formatPlayer) },
      awayTeam: { ...fixture.awayTeam, players: awaySquad.map(formatPlayer) },
      matchStats: { goals, assists, cards, substitutions, notes },
    });
  } catch (error) {
    next(error);
  }
};

export const recordMatchAppearance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, teamId, minute, isStarter } = req.body || {};
    if (!playerId || !teamId) throw new AppError("playerId and teamId are required", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, seasonId: true, homeTeamId: true, awayTeamId: true, status: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    if (![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Team is not part of this fixture", 400);
    const player = await prisma.player.findFirst({ where: { id: playerId, seasonId: fixture.seasonId, teamId, isActive: true }, select: { id: true } });
    if (!player) throw new AppError("Player does not belong to this fixture team", 400);
    const enteredAt = minute == null ? null : Math.max(0, Math.min(150, Number(minute)));
    const appearance = await prisma.$transaction(async (tx) => {
      const row = await tx.matchAppearance.upsert({
        where: { fixtureId_playerId: { fixtureId: fixture.id, playerId } },
        create: { fixtureId: fixture.id, playerId, teamId, isStarter: !!isStarter, enteredAt },
        update: { teamId, isStarter: !!isStarter, enteredAt },
      });
      await appendMatchEvent(tx, { fixtureId: fixture.id, type: "STATE_CHANGE", minute: enteredAt, teamId, playerId, payload: { action: "APPEARANCE", isStarter: !!isStarter, correctionReason: req.body.correctionReason || null }, idempotencyKey: `appearance:${fixture.id}:${playerId}:${Date.now()}`, createdById: req.user?.userId });
      return row;
    });
    res.status(201).json(appearance);
  } catch (error) { next(error); }
};

export const recordMatchShot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, teamId, outcome, minute } = req.body || {};
    if (!playerId || !teamId || !["ON_TARGET", "OFF_TARGET"].includes(outcome)) throw new AppError("playerId, teamId, and a valid shot outcome are required", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, seasonId: true, homeTeamId: true, awayTeamId: true, status: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    if (![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Team is not part of this fixture", 400);
    const player = await prisma.player.findFirst({ where: { id: playerId, seasonId: fixture.seasonId, teamId, isActive: true }, select: { id: true } });
    if (!player) throw new AppError("Shooter does not belong to this fixture team", 400);
    const eventMinute = minute == null ? null : Math.max(0, Math.min(150, Number(minute)));
    const shot = await prisma.$transaction(async (tx) => {
      const row = await tx.matchShot.create({ data: { fixtureId: fixture.id, playerId, teamId, outcome, minute: eventMinute } });
      const isHome = teamId === fixture.homeTeamId;
      await tx.fixture.update({ where: { id: fixture.id }, data: {
        [isHome ? "homeShots" : "awayShots"]: { increment: 1 },
        ...(outcome === "ON_TARGET" ? { [isHome ? "homeShotsOnTarget" : "awayShotsOnTarget"]: { increment: 1 } } : {}),
      } });
      await appendMatchEvent(tx, { fixtureId: fixture.id, type: "SHOT", minute: eventMinute, teamId, playerId, payload: { outcome, correctionReason: req.body.correctionReason || null }, idempotencyKey: `shot:${row.id}`, createdById: req.user?.userId });
      return row;
    });
    res.status(201).json(shot);
  } catch (error) { next(error); }
};

export const updateLiveStat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, statType, teamId, action, minute } = req.body;
    if (!playerId || !statType || !teamId || !action) throw new AppError("playerId, statType, teamId, action required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
    if (!player || player.teamId !== teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Player or team does not belong to this fixture", 400);
    }

    const isIncrement = action === "increment";
    const eventMinute = Math.max(0, Number(minute) || 0);

    if (statType === "goal") {
      const existing = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const goal = await prisma.$transaction(async (tx) => {
          const created = await tx.goal.create({ data: { fixtureId: fixture.id, playerId, teamId, minute: eventMinute } });
          await appendMatchEvent(tx, { fixtureId: fixture.id, type: "GOAL", minute: eventMinute, teamId, playerId, payload: { legacyGoalId: created.id }, idempotencyKey: `legacy:goal:${created.id}:created`, createdById: req.user?.userId });
          return created;
        });
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "added", goal, count: goalCount });
      } else {
        if (existing) {
          await prisma.$transaction(async (tx) => {
            await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "goal", legacyId: existing.id, reason: req.body.correctionReason, createdById: req.user?.userId });
            await tx.goal.delete({ where: { id: existing.id } });
          });
        }
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "removed", count: goalCount });
      }
    } else if (statType === "assist") {
      const existing = await prisma.assist.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const assist = await prisma.$transaction(async (tx) => {
          const created = await tx.assist.create({ data: { fixtureId: fixture.id, playerId, teamId, minute: eventMinute } });
          await appendMatchEvent(tx, { fixtureId: fixture.id, type: "ASSIST", minute: eventMinute, teamId, playerId, payload: { legacyAssistId: created.id }, idempotencyKey: `legacy:assist:${created.id}:created`, createdById: req.user?.userId });
          return created;
        });
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "added", assist, count });
      } else {
        if (existing) {
          await prisma.$transaction(async (tx) => {
            await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "assist", legacyId: existing.id, reason: req.body.correctionReason, createdById: req.user?.userId });
            await tx.assist.delete({ where: { id: existing.id } });
          });
        }
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "removed", count });
      }
    } else if (statType === "yellowCard" || statType === "redCard") {
      const cardType = statType === "yellowCard" ? "YELLOW" : "RED";
      const existing = await prisma.card.findFirst({ where: { fixtureId: fixture.id, playerId, type: cardType }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const card = await prisma.$transaction(async (tx) => {
          const created = await tx.card.create({ data: { fixtureId: fixture.id, playerId, teamId, type: cardType, minute: eventMinute } });
          await appendMatchEvent(tx, { fixtureId: fixture.id, type: cardType === "YELLOW" ? "YELLOW_CARD" : "RED_CARD", minute: eventMinute, teamId, playerId, payload: { legacyCardId: created.id }, idempotencyKey: `legacy:card:${created.id}:created`, createdById: req.user?.userId });
          return created;
        });
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "added", card, count });
      } else {
        if (existing) {
          await prisma.$transaction(async (tx) => {
            await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "card", legacyId: existing.id, reason: req.body.correctionReason, createdById: req.user?.userId });
            await tx.card.delete({ where: { id: existing.id } });
          });
        }
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "removed", count });
      }
    } else {
      throw new AppError("Invalid statType", 400);
    }
  } catch (error) {
    next(error);
  }
};

export const setMatchRating = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, rating } = req.body;
    if (!playerId || rating === undefined) throw new AppError("playerId and rating required", 400);
    const value = Math.max(0, Math.min(10, Number(rating)));
    if (Number.isNaN(value)) throw new AppError("Invalid rating", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, homeTeamId: true, awayTeamId: true, status: true, seasonId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true } });
    if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId)) {
      throw new AppError("Player does not belong to this fixture", 400);
    }

    const row = await prisma.matchPlayerRating.upsert({
      where: { fixtureId_playerId: { fixtureId: fixture.id, playerId } },
      create: { fixtureId: fixture.id, playerId, rating: value },
      update: { rating: value },
    });
    await rebuildIfCorrected(fixture, req.body.correctionReason);
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const setManOfTheMatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.body;
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, homeTeamId: true, awayTeamId: true, manOfTheMatchId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    let nextId: string | null = null;
    if (playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true } });
      if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId)) {
        throw new AppError("Player does not belong to this fixture", 400);
      }
      nextId = player.id;
    }

    const updated = await prisma.fixture.update({ where: { id: fixture.id }, data: { manOfTheMatchId: nextId } });
    res.json({ manOfTheMatchId: updated.manOfTheMatchId });
  } catch (error) {
    next(error);
  }
};

// ─── Goal & Substitution Management ───

export const addGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, scorerId, assistId, minute, isOwnGoal, isPenalty } = req.body;
    if (!teamId || !scorerId) throw new AppError("teamId and scorerId required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    const eventMinute = Number(minute);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const scorer = await prisma.player.findUnique({ where: { id: scorerId }, select: { teamId: true, seasonId: true, isActive: true } });
    if (!scorer || !scorer.isActive || scorer.seasonId !== fixture.seasonId || scorer.teamId !== teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Scorer does not belong to this fixture", 400);
    }
    if (assistId && isOwnGoal) throw new AppError("Own goals cannot have an assist", 400);
    if (assistId) {
      const assister = await prisma.player.findUnique({ where: { id: assistId }, select: { teamId: true, seasonId: true, isActive: true } });
      if (!assister || !assister.isActive || assister.seasonId !== fixture.seasonId || assister.teamId !== teamId) throw new AppError("Assister must belong to the scoring team", 400);
    }

    const goal = await prisma.$transaction(async (tx) => {
      const created = await tx.goal.create({ data: { fixtureId: fixture.id, playerId: scorerId, teamId, minute: eventMinute, isOwnGoal: !!isOwnGoal, isPenalty: !!isPenalty } });
      await appendMatchEvent(tx, {
        fixtureId: fixture.id,
        type: isOwnGoal ? "OWN_GOAL" : isPenalty ? "PENALTY_GOAL" : "GOAL",
        minute: eventMinute,
        teamId,
        playerId: scorerId,
        secondaryPlayerId: assistId || null,
        payload: { legacyGoalId: created.id, isOwnGoal: !!isOwnGoal, isPenalty: !!isPenalty, correctionReason: req.body.correctionReason || null },
        idempotencyKey: `legacy:goal:${created.id}:created`,
        createdById: req.user?.userId,
      });
      if (assistId) {
        const assist = await tx.assist.create({ data: { fixtureId: fixture.id, playerId: assistId, teamId, minute: eventMinute, goalId: created.id } });
        await appendMatchEvent(tx, { fixtureId: fixture.id, type: "ASSIST", minute: eventMinute, teamId, playerId: assistId, secondaryPlayerId: scorerId, payload: { legacyAssistId: assist.id, goalId: created.id }, idempotencyKey: `legacy:assist:${assist.id}:created`, createdById: req.user?.userId });
      }
      return created;
    });
    await recalcScore(fixture.id);
    await rebuildIfCorrected(fixture, req.body.correctionReason);
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
};

// Administrative goals are not credited to a player, keeping player statistics accurate.
export const addAwardedGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, minute } = req.body;
    if (!teamId) throw new AppError("teamId required", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    if (![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Team is not part of this fixture", 400);
    const eventMinute = Number(minute ?? 0);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const awardedGoal = await prisma.$transaction(async (tx) => {
      const note = await tx.matchNote.create({ data: { fixtureId: fixture.id, teamId, type: "INFO", minute: eventMinute, note: AWARDED_GOAL_NOTE } });
      await appendMatchEvent(tx, { fixtureId: fixture.id, type: "GOAL", minute: eventMinute, teamId, payload: { legacyNoteId: note.id, awardedGoal: true, correctionReason: req.body.correctionReason || null }, idempotencyKey: `legacy:note:${note.id}:created`, createdById: req.user?.userId });
      return note;
    });
    await recalcScore(fixture.id);
    await rebuildIfCorrected(fixture, req.body.correctionReason);
    res.status(201).json(awardedGoal);
  } catch (error) { next(error); }
};

export const updateGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);
    const goal = await prisma.goal.findFirst({ where: { id: req.params.goalId, fixtureId: fixture.id } });
    if (!goal) throw new AppError("Goal not found", 404);
    const minute = Number(req.body.minute);
    if (!Number.isInteger(minute) || minute < 0 || minute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const scorer = await prisma.player.findUnique({ where: { id: req.body.scorerId }, select: { id: true, teamId: true, seasonId: true, isActive: true } });
    const teamId = req.body.teamId || goal.teamId || scorer?.teamId;
    if (!teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Scorer team must be part of this fixture", 400);
    if (!scorer || !scorer.isActive || scorer.seasonId !== fixture.seasonId || scorer.teamId !== teamId) throw new AppError("Scorer must belong to the selected team", 400);

    const isOwnGoal = req.body.isOwnGoal === undefined ? goal.isOwnGoal : !!req.body.isOwnGoal;
    const isPenalty = req.body.isPenalty === undefined ? goal.isPenalty : !!req.body.isPenalty;
    if (isOwnGoal && isPenalty) throw new AppError("A goal cannot be both an own goal and a penalty goal", 400);

    const shouldUpdateAssist = req.body.assistId !== undefined || isOwnGoal;
    const assistId = isOwnGoal ? null : req.body.assistId;
    if (assistId === scorer.id) throw new AppError("Scorer cannot assist their own goal", 400);
    if (assistId) {
      const assister = await prisma.player.findUnique({ where: { id: assistId }, select: { teamId: true, seasonId: true, isActive: true } });
      if (!assister || !assister.isActive || assister.seasonId !== fixture.seasonId || assister.teamId !== teamId) throw new AppError("Assister must belong to the selected team", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const previousAssists = shouldUpdateAssist
        ? await tx.assist.findMany({ where: { goalId: goal.id }, select: { id: true } })
        : [];
      if (shouldUpdateAssist) {
        for (const previousAssist of previousAssists) {
          await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "assist", legacyId: previousAssist.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        }
        await tx.assist.deleteMany({ where: { goalId: goal.id } });
      }

      const row = await tx.goal.update({ where: { id: goal.id }, data: { playerId: scorer.id, teamId, minute, isOwnGoal, isPenalty } });
      if (shouldUpdateAssist && assistId) {
        const assist = await tx.assist.create({ data: { fixtureId: fixture.id, playerId: assistId, teamId, minute, goalId: goal.id } });
        await appendMatchEvent(tx, { fixtureId: fixture.id, type: "ASSIST", minute, teamId, playerId: assistId, secondaryPlayerId: scorer.id, payload: { legacyAssistId: assist.id, goalId: goal.id, correctionReason: req.body.correctionReason || null }, idempotencyKey: `legacy:assist:${assist.id}:created`, createdById: req.user?.userId });
      }
      await appendMatchEvent(tx, {
        fixtureId: fixture.id,
        type: "CORRECTION",
        minute,
        teamId,
        playerId: scorer.id,
        secondaryPlayerId: assistId || null,
        payload: {
          legacyType: "goal",
          legacyId: goal.id,
          before: { teamId: goal.teamId, playerId: goal.playerId, minute: goal.minute, isOwnGoal: goal.isOwnGoal, isPenalty: goal.isPenalty },
          after: { teamId, playerId: scorer.id, minute, isOwnGoal, isPenalty, assistId: assistId || null },
          reason: req.body.correctionReason || null,
        },
        idempotencyKey: `legacy:goal:${goal.id}:corrected:${Date.now()}`,
        createdById: req.user?.userId,
      });
      return row;
    });
    await recalcScore(fixture.id);
    await rebuildIfCorrected(fixture, req.body.correctionReason);
    res.json(updated);
  } catch (error) { next(error); }
};

export const removeGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.body;
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);

    const goal = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
    if (!goal) throw new AppError("No goal found for this player", 404);

    await prisma.$transaction(async (tx) => {
      const assists = await tx.assist.findMany({ where: { goalId: goal.id }, select: { id: true } });
      for (const assist of assists) await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "assist", legacyId: assist.id, reason: req.body.correctionReason, createdById: req.user?.userId });
      await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "goal", legacyId: goal.id, reason: req.body.correctionReason, createdById: req.user?.userId });
      await tx.assist.deleteMany({ where: { goalId: goal.id } });
      await tx.goal.delete({ where: { id: goal.id } });
    });
    await recalcScore(fixture.id);
    await rebuildIfCorrected(fixture, req.body.correctionReason);
    res.json({ message: "Goal removed" });
  } catch (error) {
    next(error);
  }
};

export const addSubstitution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, playerOffId, playerOnId, minute } = req.body;
    if (!teamId || !playerOffId || !playerOnId) throw new AppError("teamId, playerOffId, playerOnId required", 400);
    if (playerOffId === playerOnId) throw new AppError("Cannot substitute a player with themselves", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, seasonId: true, homeTeamId: true, awayTeamId: true, status: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Team is not part of this fixture", 400);
    assertEventMutable(fixture.status, req.body.correctionReason);
    const eventMinute = Number(minute);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const players = await prisma.player.findMany({ where: { id: { in: [playerOffId, playerOnId] }, teamId, seasonId: fixture.seasonId, isActive: true }, select: { id: true } });
    if (players.length !== 2) throw new AppError("Both players must belong to the selected team", 400);

    const [lineups, previousSubs, appearances] = await Promise.all([
      prisma.lineup.findMany({ where: { fixtureId: fixture.id, teamId }, select: { playerId: true, isStarter: true } }),
      prisma.substitution.findMany({ where: { fixtureId: fixture.id, teamId }, orderBy: [{ minute: "asc" }, { createdAt: "asc" }], select: { playerOffId: true, playerOnId: true } }),
      prisma.matchAppearance.findMany({ where: { fixtureId: fixture.id, teamId }, select: { playerId: true, isStarter: true } }),
    ]);
    const squad = new Set(lineups.map((row) => row.playerId));
    const onPitch = new Set((lineups.length ? lineups : appearances).filter((row) => row.isStarter).map((row) => row.playerId));
    for (const previous of previousSubs) { onPitch.delete(previous.playerOffId); onPitch.add(previous.playerOnId); }
    if (!onPitch.has(playerOffId)) throw new AppError("The outgoing player is not currently on the pitch", 409, "PLAYER_NOT_ON_PITCH");
    if (onPitch.has(playerOnId)) throw new AppError("The incoming player is already on the pitch", 409, "PLAYER_ALREADY_ON_PITCH");
    if (squad.size > 0 && !squad.has(playerOnId)) throw new AppError("The incoming player is not on the match bench", 409, "PLAYER_NOT_ON_BENCH");

    const sub = await prisma.$transaction(async (tx) => {
      const created = await tx.substitution.create({ data: { fixtureId: req.params.id, playerOffId, playerOnId, teamId, minute: eventMinute } });
      await appendMatchEvent(tx, { fixtureId: fixture.id, type: "SUBSTITUTION", minute: eventMinute, teamId, playerId: playerOffId, secondaryPlayerId: playerOnId, payload: { legacySubstitutionId: created.id }, idempotencyKey: `legacy:substitution:${created.id}:created`, createdById: req.user?.userId });
      await tx.matchAppearance.upsert({ where: { fixtureId_playerId: { fixtureId: fixture.id, playerId: playerOnId } }, create: { fixtureId: fixture.id, playerId: playerOnId, teamId, isStarter: false, enteredAt: eventMinute }, update: { enteredAt: eventMinute } });
      return created;
    });
    res.status(201).json(sub);
  } catch (error) {
    next(error);
  }
};

// Generic event removal used by Undo / Delete from the live timeline.
// `type` must be one of: goal, assist, card, substitution, note.

export const removeMatchEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.body;
    if (!type || !id) throw new AppError("type and id required", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, seasonId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);

    if (type === "goal") {
      const goal = await prisma.goal.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!goal) throw new AppError("Goal not found", 404);
      // Remove the linked assist (if created with the goal) then the goal.
      await prisma.$transaction(async (tx) => {
        const assists = await tx.assist.findMany({ where: { goalId: goal.id }, select: { id: true } });
        for (const assist of assists) await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "assist", legacyId: assist.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "goal", legacyId: goal.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        await tx.assist.deleteMany({ where: { goalId: goal.id } });
        await tx.goal.delete({ where: { id: goal.id } });
      });
      await recalcScore(fixture.id);
    } else if (type === "assist") {
      const event = await prisma.assist.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Assist not found for this fixture", 404);
      await prisma.$transaction(async (tx) => {
        await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "assist", legacyId: event.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        await tx.assist.delete({ where: { id: event.id } });
      });
    } else if (type === "card") {
      const event = await prisma.card.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Card not found for this fixture", 404);
      await prisma.$transaction(async (tx) => {
        await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "card", legacyId: event.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        await tx.card.delete({ where: { id: event.id } });
      });
    } else if (type === "substitution") {
      const event = await prisma.substitution.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Substitution not found for this fixture", 404);
      const later = await prisma.substitution.findFirst({
        where: { fixtureId: fixture.id, teamId: event.teamId, OR: [{ minute: { gt: event.minute } }, { minute: event.minute, createdAt: { gt: event.createdAt } }] },
        select: { id: true },
      });
      if (later) throw new AppError("Undo later substitutions for this team first", 409, "DEPENDENT_SUBSTITUTION");
      await prisma.$transaction(async (tx) => {
        await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "substitution", legacyId: event.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        await tx.substitution.delete({ where: { id: event.id } });
        await tx.matchAppearance.deleteMany({ where: { fixtureId: fixture.id, playerId: event.playerOnId, isStarter: false } });
      });
    } else if (type === "note") {
      const event = await prisma.matchNote.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Note not found for this fixture", 404);
      await prisma.$transaction(async (tx) => {
        await reverseLegacyEvent(tx, { fixtureId: fixture.id, legacyType: "note", legacyId: event.id, reason: req.body.correctionReason, createdById: req.user?.userId });
        await tx.matchNote.delete({ where: { id: event.id } });
      });
      if (event.note === AWARDED_GOAL_NOTE) await recalcScore(fixture.id);
    } else {
      throw new AppError("Invalid event type", 400);
    }

    await rebuildIfCorrected(fixture, req.body.correctionReason);
    res.json({ message: "Event removed" });
  } catch (error) {
    next(error);
  }
};

export const addMatchNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, playerId, type, minute, note } = req.body;
    if (!type) throw new AppError("type required", 400);
    const noteTypes = ["VAR", "MISSED_PENALTY", "INFO"];
    if (!noteTypes.includes(type)) throw new AppError("type must be VAR, MISSED_PENALTY, or INFO", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, homeTeamId: true, awayTeamId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    assertEventMutable(fixture.status, req.body.correctionReason);

    const eventMinute = Number(minute ?? 0);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    if (teamId && ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Team is not part of this fixture", 400);

    if (playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
      if (!player || (teamId && player.teamId !== teamId)) throw new AppError("Player does not belong to the selected fixture team", 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.matchNote.create({ data: { fixtureId: fixture.id, teamId: teamId || null, playerId: playerId || null, type, minute: eventMinute, note: note || null } });
      await appendMatchEvent(tx, { fixtureId: fixture.id, type: "NOTE", minute: eventMinute, teamId: teamId || null, playerId: playerId || null, payload: { legacyNoteId: row.id, noteType: type, note: note || null }, idempotencyKey: `legacy:note:${row.id}:created`, createdById: req.user?.userId });
      return row;
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

// Update fixture-level team stats (possession, shots, corners, ...).

export const updateTeamStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statFields = [
      "homePossession", "awayPossession", "homeShots", "awayShots",
      "homeShotsOnTarget", "awayShotsOnTarget", "homeCorners", "awayCorners",
      "homeFouls", "awayFouls", "homeOffsides", "awayOffsides",
      "homeExpectedGoals", "awayExpectedGoals",
    ] as const;
    const data: any = {};
    for (const field of statFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    if (Object.keys(data).length === 0) throw new AppError("No stats to update", 400);
    const current = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, seasonId: true } });
    if (!current) throw new AppError("Fixture not found", 404);
    assertEventMutable(current.status, req.body.correctionReason);
    for (const [field, raw] of Object.entries(data)) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new AppError(`${field} must be a non-negative number`, 400);
      if (field.endsWith("Possession") && value > 100) throw new AppError(`${field} must be between 0 and 100`, 400);
      data[field] = value;
    }
    const homePossession = data.homePossession;
    const awayPossession = data.awayPossession;
    if (homePossession !== undefined && awayPossession !== undefined && Math.abs(homePossession + awayPossession - 100) > 0.01) {
      throw new AppError("Home and away possession must total 100", 400);
    }
    const fixture = await prisma.fixture.update({ where: { id: req.params.id }, data });
    await rebuildIfCorrected(current, req.body.correctionReason);
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

// ─── Suspensions Management ───

async function recalcScore(fixtureId: string) {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { homeTeamId: true, awayTeamId: true } });
  if (!fixture) return;
  const [goals, awardedGoals] = await Promise.all([
    prisma.goal.findMany({ where: { fixtureId }, include: { player: { select: { teamId: true } } } }),
    prisma.matchNote.findMany({ where: { fixtureId, type: "INFO", note: AWARDED_GOAL_NOTE }, select: { teamId: true } }),
  ]);
  let homeGoals = 0;
  let awayGoals = 0;
  for (const g of goals) {
    const scorerIsHome = (g.teamId || g.player.teamId) === fixture.homeTeamId;
    if (g.isOwnGoal) {
      // Own goals count for the opposing team.
      if (scorerIsHome) awayGoals += 1;
      else homeGoals += 1;
    } else {
      if (scorerIsHome) homeGoals += 1;
      else awayGoals += 1;
    }
  }
  for (const awarded of awardedGoals) {
    if (awarded.teamId === fixture.homeTeamId) homeGoals += 1;
    if (awarded.teamId === fixture.awayTeamId) awayGoals += 1;
  }
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { homeScore: homeGoals, awayScore: awayGoals },
  });
}
