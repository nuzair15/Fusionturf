import { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

const numericFields = ["goals", "assists", "minutesPlayed", "shots", "shotsOnTarget", "yellowCards", "redCards"] as const;

async function eligibleAppearances(playerId: string, seasonId: string, friendly: boolean) {
  const fixtures = await prisma.fixture.findMany({ where: { seasonId, status: { in: ["COMPLETED", "LIVE", "HALF_TIME", "PAUSED", "EXTRA_TIME", "PENALTIES"] }, ...(friendly ? { OR: [{ isFriendly: true }, { competition: { is: { type: "FRIENDLY" } } }] } : { isFriendly: false }) }, select: { id: true } });
  if (!fixtures.length) return 0;
  const fixtureIds = fixtures.map((f) => f.id);
  const [lineups, squadEntries] = await Promise.all([
    prisma.lineup.findMany({ where: { playerId, fixtureId: { in: fixtureIds } }, select: { fixtureId: true } }),
    prisma.matchdaySquadEntry.findMany({ where: { playerId, squad: { fixtureId: { in: fixtureIds } } }, select: { squad: { select: { fixtureId: true } } } }),
  ]);
  return new Set([...lineups.map((x) => x.fixtureId), ...squadEntries.map((x) => x.squad.fixtureId)]).size;
}

export const getAdminPlayerStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seasonId = String(req.query.seasonId || "");
    const friendly = req.query.friendly === "true";
    if (!seasonId) throw new AppError("seasonId is required", 400);
    const stats = friendly
      ? await prisma.player.findMany({
          where: { seasonId, isActive: true, teamId: { not: null } },
          include: { team: true, friendlyStats: { where: { seasonId } } },
          orderBy: { firstName: "asc" },
        }).then((players) => players.map((player) => ({
          ...(player.friendlyStats[0] || { id: `friendly-${player.id}`, seasonId, playerId: player.id, teamId: player.teamId, appearances: 0, goals: 0, assists: 0, minutesPlayed: 0, shots: 0, shotsOnTarget: 0, yellowCards: 0, redCards: 0, averageRating: null }),
          player,
          team: player.team,
        })))
      : await prisma.playerStat.findMany({ where: { seasonId }, include: { player: true, team: true }, orderBy: { player: { firstName: "asc" } } });
    res.json(stats);
  } catch (e) { next(e); }
};

export const updateAdminPlayerStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, teamId, friendly = false } = req.body;
    const playerId = req.params.playerId;
    if (!seasonId || !teamId) throw new AppError("seasonId and teamId are required", 400);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true } });
    if (!player) throw new AppError("Player not found", 404);
    const appearancesAllowed = await eligibleAppearances(playerId, seasonId, !!friendly);
    const data: any = { appearances: Math.min(Math.max(0, Number(req.body.appearances) || 0), appearancesAllowed) };
    for (const field of numericFields) if (req.body[field] !== undefined) data[field] = Math.max(0, Number(req.body[field]) || 0);
    if (req.body.averageRating !== undefined) data.averageRating = req.body.averageRating === "" ? null : Math.max(0, Math.min(10, Number(req.body.averageRating)));
    const stats = friendly
      ? await prisma.friendlyPlayerStat.upsert({ where: { seasonId_playerId_teamId: { seasonId, playerId, teamId } }, create: { seasonId, playerId, teamId, ...data }, update: data })
      : await prisma.playerStat.upsert({ where: { seasonId_playerId_teamId: { seasonId, playerId, teamId } }, create: { seasonId, playerId, teamId, ...data }, update: data });
    res.json(stats);
  } catch (e) { next(e); }
};
