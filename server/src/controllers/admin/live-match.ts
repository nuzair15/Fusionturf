import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";

// Live match console: stats, goals, substitutions, ratings, MOTM


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
        goals: goals.filter((g: any) => g.playerId === p.id).length,
        assists: assists.filter((a: any) => a.playerId === p.id).length,
        yellowCards: cards.filter((c: any) => c.playerId === p.id && c.type === "YELLOW").length,
        redCards: cards.filter((c: any) => c.playerId === p.id && (c.type === "RED" || c.type === "SECOND_YELLOW")).length,
      },
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

export const updateLiveStat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, statType, teamId, action, minute } = req.body;
    if (!playerId || !statType || !teamId || !action) throw new AppError("playerId, statType, teamId, action required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
    if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId) || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Player or team does not belong to this fixture", 400);
    }

    const isIncrement = action === "increment";
    const eventMinute = Math.max(0, Number(minute) || 0);

    if (statType === "goal") {
      const existing = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const goal = await prisma.goal.create({
          data: { fixtureId: fixture.id, playerId, minute: eventMinute },
        });
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "added", goal, count: goalCount });
      } else {
        if (existing) {
          await prisma.goal.delete({ where: { id: existing.id } });
        }
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "removed", count: goalCount });
      }
    } else if (statType === "assist") {
      const existing = await prisma.assist.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const assist = await prisma.assist.create({
          data: { fixtureId: fixture.id, playerId, minute: eventMinute },
        });
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "added", assist, count });
      } else {
        if (existing) {
          await prisma.assist.delete({ where: { id: existing.id } });
        }
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "removed", count });
      }
    } else if (statType === "yellowCard" || statType === "redCard") {
      const cardType = statType === "yellowCard" ? "YELLOW" : "RED";
      const existing = await prisma.card.findFirst({ where: { fixtureId: fixture.id, playerId, type: cardType }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const card = await prisma.card.create({
          data: { fixtureId: fixture.id, playerId, type: cardType, minute: eventMinute },
        });
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "added", card, count });
      } else {
        if (existing) {
          await prisma.card.delete({ where: { id: existing.id } });
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

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, homeTeamId: true, awayTeamId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true } });
    if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId)) {
      throw new AppError("Player does not belong to this fixture", 400);
    }

    const row = await prisma.matchPlayerRating.upsert({
      where: { fixtureId_playerId: { fixtureId: fixture.id, playerId } },
      create: { fixtureId: fixture.id, playerId, rating: value },
      update: { rating: value },
    });
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
    const eventMinute = Number(minute);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const scorer = await prisma.player.findUnique({ where: { id: scorerId }, select: { teamId: true, seasonId: true, isActive: true } });
    if (!scorer || !scorer.isActive || scorer.seasonId !== fixture.seasonId || scorer.teamId !== teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Scorer does not belong to this fixture", 400);
    }
    if (assistId) {
      const assister = await prisma.player.findUnique({ where: { id: assistId }, select: { teamId: true, seasonId: true, isActive: true } });
      if (!assister || !assister.isActive || assister.seasonId !== fixture.seasonId || assister.teamId !== teamId) throw new AppError("Assister must belong to the scoring team", 400);
    }

    const goal = await prisma.goal.create({
      data: { fixtureId: fixture.id, playerId: scorerId, minute: eventMinute, isOwnGoal: !!isOwnGoal, isPenalty: !!isPenalty },
    });

    if (assistId) {
      await prisma.assist.create({
        data: { fixtureId: fixture.id, playerId: assistId, minute: eventMinute, goalId: goal.id },
      });
    }

    await recalcScore(fixture.id);
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
};

export const removeGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.body;
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const goal = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
    if (!goal) throw new AppError("No goal found for this player", 404);

    const assist = await prisma.assist.findFirst({ where: { fixtureId: fixture.id }, orderBy: { createdAt: "desc" } });
    if (assist) {
      const goalTime = goal.createdAt;
      const assistTime = assist.createdAt;
      if (Math.abs(assistTime.getTime() - goalTime.getTime()) < 1000) {
        await prisma.assist.delete({ where: { id: assist.id } });
      }
    }

    await prisma.goal.delete({ where: { id: goal.id } });
    await recalcScore(fixture.id);
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
    if (["SCHEDULED", "COMPLETED", "CANCELLED", "POSTPONED"].includes(fixture.status)) throw new AppError("Substitutions can only be recorded during an active match", 400);
    const eventMinute = Number(minute);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const players = await prisma.player.findMany({ where: { id: { in: [playerOffId, playerOnId] }, teamId, seasonId: fixture.seasonId, isActive: true }, select: { id: true } });
    if (players.length !== 2) throw new AppError("Both players must belong to the selected team", 400);

    const sub = await prisma.substitution.create({
      data: { fixtureId: req.params.id, playerOffId, playerOnId, minute: eventMinute },
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
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    if (type === "goal") {
      const goal = await prisma.goal.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!goal) throw new AppError("Goal not found", 404);
      // Remove the linked assist (if created with the goal) then the goal.
      await prisma.assist.deleteMany({ where: { goalId: goal.id } });
      await prisma.goal.delete({ where: { id: goal.id } });
      await recalcScore(fixture.id);
    } else if (type === "assist") {
      const event = await prisma.assist.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Assist not found for this fixture", 404);
      await prisma.assist.delete({ where: { id: event.id } });
    } else if (type === "card") {
      const event = await prisma.card.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Card not found for this fixture", 404);
      await prisma.card.delete({ where: { id: event.id } });
    } else if (type === "substitution") {
      const event = await prisma.substitution.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Substitution not found for this fixture", 404);
      await prisma.substitution.delete({ where: { id: event.id } });
    } else if (type === "note") {
      const event = await prisma.matchNote.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Note not found for this fixture", 404);
      await prisma.matchNote.delete({ where: { id: event.id } });
    } else {
      throw new AppError("Invalid event type", 400);
    }

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
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    if (playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
      if (!player) throw new AppError("Player not found", 400);
    }

    const created = await prisma.matchNote.create({
      data: { fixtureId: fixture.id, teamId: teamId || null, playerId: playerId || null, type, minute: minute || 0, note: note || null },
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
    const fixture = await prisma.fixture.update({ where: { id: req.params.id }, data });
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

// ─── Suspensions Management ───

async function recalcScore(fixtureId: string) {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { homeTeamId: true, awayTeamId: true } });
  if (!fixture) return;
  const goals = await prisma.goal.findMany({
    where: { fixtureId },
    include: { player: { select: { teamId: true } } },
  });
  let homeGoals = 0;
  let awayGoals = 0;
  for (const g of goals) {
    const scorerIsHome = g.player.teamId === fixture.homeTeamId;
    if (g.isOwnGoal) {
      // Own goals count for the opposing team.
      if (scorerIsHome) awayGoals += 1;
      else homeGoals += 1;
    } else {
      if (scorerIsHome) homeGoals += 1;
      else awayGoals += 1;
    }
  }
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { homeScore: homeGoals, awayScore: awayGoals },
  });
}
