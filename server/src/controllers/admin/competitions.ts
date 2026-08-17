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

// Cup / knockout competitions and bracket generation


export const getCompetitions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competitions = await prisma.competition.findMany({
      where: req.query.seasonId ? { seasonId: String(req.query.seasonId) } : undefined,
      include: { season: { select: { id: true, name: true } }, _count: { select: { fixtures: true, bracketMatches: true } } },
      orderBy: [{ seasonId: "desc" }, { name: "asc" }],
    });
    res.json(competitions);
  } catch (error) { next(error); }
};

export const getCompetitionBracket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        season: { select: { id: true, name: true } },
        bracketMatches: {
          include: {
            homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
            winnerTeam: { select: { id: true, name: true, shortName: true } },
            fixture: { select: { id: true, matchDate: true, kickoffTime: true, status: true, homeScore: true, awayScore: true } },
          },
          orderBy: [{ roundNumber: "asc" }, { position: "asc" }],
        },
      },
    });
    if (!competition) throw new AppError("Competition not found", 404);
    res.json(competition);
  } catch (error) { next(error); }
};

export const generateCompetitionBracket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamIds, matchDate, kickoffTime } = req.body;
    if (!Array.isArray(teamIds) || teamIds.length < 2 || teamIds.length > 32 || (teamIds.length & (teamIds.length - 1)) !== 0) {
      throw new AppError("A knockout bracket requires 2, 4, 8, 16, or 32 teams", 400);
    }
    if (new Set(teamIds).size !== teamIds.length) throw new AppError("Bracket teams must be unique", 400);
    const competition = await prisma.competition.findUnique({ where: { id: req.params.id } });
    if (!competition) throw new AppError("Competition not found", 404);
    if (competition.type !== "KNOCKOUT" && competition.type !== "CUP") throw new AppError("Only knockout or cup competitions can have brackets", 400);
    const existing = await prisma.bracketMatch.count({ where: { competitionId: competition.id } });
    if (existing) throw new AppError("This competition already has a bracket", 409);
    const teams = await prisma.team.findMany({ where: { id: { in: teamIds }, seasonId: competition.seasonId, isActive: true }, select: { id: true } });
    if (teams.length !== teamIds.length) throw new AppError("All bracket teams must be active teams from the competition season", 400);
    const baseDate = matchDate ? new Date(matchDate) : new Date();
    if (Number.isNaN(baseDate.getTime())) throw new AppError("Invalid first-round match date", 400);
    const rounds = Math.log2(teamIds.length);
    const created = await prisma.$transaction(async (tx) => {
      const rows: any[] = [];
      for (let round = 1; round <= rounds; round++) {
        const matchCount = teamIds.length / (2 ** round);
        for (let position = 1; position <= matchCount; position++) {
          const homeTeamId = round === 1 ? teamIds[(position - 1) * 2] : null;
          const awayTeamId = round === 1 ? teamIds[(position - 1) * 2 + 1] : null;
          const row = await tx.bracketMatch.create({ data: { competitionId: competition.id, roundNumber: round, position, homeTeamId, awayTeamId } });
          if (round === 1 && homeTeamId && awayTeamId) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + position - 1);
            const fixture = await tx.fixture.create({ data: { seasonId: competition.seasonId, competitionId: competition.id, homeTeamId, awayTeamId, matchDate: date, kickoffTime: kickoffTime || null, round, status: "SCHEDULED" } });
            await tx.bracketMatch.update({ where: { id: row.id }, data: { fixtureId: fixture.id } });
            rows.push({ ...row, fixtureId: fixture.id });
          } else rows.push(row);
        }
      }
      await tx.competition.update({ where: { id: competition.id }, data: { bracketSize: teamIds.length, bracketStatus: "IN_PROGRESS" } });
      return rows;
    });
    res.status(201).json({ competitionId: competition.id, bracketSize: teamIds.length, matches: created });
  } catch (error) { next(error); }
};
