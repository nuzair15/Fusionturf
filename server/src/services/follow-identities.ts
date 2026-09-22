import prisma from "../config/database.js";

/** Legacy follow rows keep their foreign keys; resolve the club/person across seasons. */
export async function expandFollowIdentities(follows: Array<{ teamId: string | null; playerId: string | null }>) {
  const teamIds = follows.flatMap(f => f.teamId ? [f.teamId] : []);
  const playerIds = follows.flatMap(f => f.playerId ? [f.playerId] : []);
  const [anchors, people] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: teamIds }, deletedAt: null } }),
    prisma.player.findMany({ where: { id: { in: playerIds }, deletedAt: null } }),
  ]);
  const [teams, players] = await Promise.all([
    prisma.team.findMany({ where: { deletedAt: null, OR: [{ id: { in: teamIds } }, { clubId: { in: anchors.flatMap(t => t.clubId ? [t.clubId] : []) } }] }, orderBy: [{ season: { isCurrent: "desc" } }, { season: { startDate: "desc" } }] }),
    prisma.player.findMany({ where: { deletedAt: null, OR: [{ id: { in: playerIds } }, { profileId: { in: people.flatMap(p => p.profileId ? [p.profileId] : []) } }] }, orderBy: [{ season: { isCurrent: "desc" } }, { season: { startDate: "desc" } }] }),
  ]);
  return { teams, players, teamIds: teams.map(t => t.id), playerIds: players.map(p => p.id) };
}
