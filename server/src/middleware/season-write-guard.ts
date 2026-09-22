import { assertPlayerEligibility } from "../services/player-eligibility.js";
import { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { AppError } from "./errorHandler.js";

export async function seasonWriteGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  try {
    const [resource, id, action] = req.path.split("/").filter(Boolean);
    const models: Record<string, string> = { seasons: "season", players: "player", teams: "team", fixtures: "fixture", competitions: "competition", suspensions: "suspension", awards: "award", "player-stats": "player", "process-match-result": "fixture" };
    const model = models[resource];
    if (!model) return next();
    const record = id ? await (prisma as any)[model].findUnique({ where: { id } }) : null;
    const fixture = model === "fixture" ? record : req.body?.fixtureId ? await prisma.fixture.findUnique({ where: { id: req.body.fixtureId } }) : null;
    const team = req.body?.teamId ? await prisma.team.findUnique({ where: { id: req.body.teamId } }) : null;
    const seasonIds = [...new Set([model === "season" ? record?.id : record?.seasonId, req.body?.seasonId, fixture?.seasonId, team?.seasonId].filter(Boolean))] as string[];
    for (const seasonId of seasonIds) {
      const season = await prisma.season.findUnique({ where: { id: seasonId } });
      if (!season || season.deletedAt) throw new AppError("Season not found", 404);
      if (season.lifecycle === "COMPLETED" && action !== "create-next") {
        const correction = ["SUPER_ADMIN", "LEAGUE_ADMIN"].includes(req.user?.role || "") && typeof req.body?.correctionReason === "string" && req.body.correctionReason.trim();
        if (!correction || ["player", "team", "season"].includes(model)) throw new AppError("Completed seasons are read-only. Match corrections require an administrator and a correction reason.", 409);
      }
      if (season.lifecycle === "DRAFT" && fixture) {
        const safe = [undefined, "status", "lineups", "squad", "reschedule", "referee", "restore"].includes(action) && resource !== "process-match-result";
        if (!safe || (req.body?.status && !["SCHEDULED", "CANCELLED", "POSTPONED"].includes(req.body.status)) || req.body?.homeScore !== undefined || req.body?.awayScore !== undefined) throw new AppError("Activate the season before recording match activity", 409);
      }
    }
    if (fixture) {
      const playerIds = [req.body?.playerId, req.body?.scorerId, req.body?.assistId, req.body?.playerOnId, req.body?.playerOffId, req.body?.manOfTheMatchId, ...(Array.isArray(req.body?.playerIds) ? req.body.playerIds : [])].filter(Boolean);
      for (const playerId of new Set(playerIds)) await assertPlayerEligibility(fixture, String(playerId), req.body?.teamId);
    }
    next();
  } catch (error) { next(error); }
}
