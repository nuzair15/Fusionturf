import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

export async function assertPlayerEligibility(fixture: { id: string; seasonId: string; status: string; homeTeamId: string; awayTeamId: string; matchDate: Date; kickoffAt?: Date | null; competitionId?: string | null }, playerId: string, teamId?: string) {
  const p = await prisma.player.findFirst({ where: { id: playerId, seasonId: fixture.seasonId, deletedAt: null }, include: { transfers: { orderBy: { transferredAt: "asc" } } } });
  if (!p) throw new AppError("Player is not registered in the fixture season", 400);
  let historicalTeam = p.teamId;
  if (fixture.status === "COMPLETED") {
    const evidence = await prisma.lineup.findFirst({ where: { fixtureId: fixture.id, playerId } }) || await prisma.matchAppearance.findFirst({ where: { fixtureId: fixture.id, playerId } });
    const after = p.transfers.find(t => t.transferredAt > (fixture.kickoffAt || fixture.matchDate));
    historicalTeam = evidence?.teamId || after?.fromTeamId || p.transfers.at(-1)?.toTeamId || p.teamId;
  } else {
    if (!p.isActive) throw new AppError("Inactive players cannot be selected for a match", 400);
    const banned = await prisma.suspension.count({ where: { playerId, seasonId: fixture.seasonId, isActive: true, deletedAt: null, OR: [{ competitionId: null }, { competitionId: fixture.competitionId || null }] } });
    if (banned) throw new AppError("Suspended players cannot participate in this match", 400);
  }
  if (!historicalTeam || ![fixture.homeTeamId, fixture.awayTeamId].includes(historicalTeam) || (teamId && teamId !== historicalTeam)) throw new AppError("Player does not belong to this team for this fixture", 400);
}
