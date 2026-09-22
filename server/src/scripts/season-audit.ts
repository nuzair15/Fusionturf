import "dotenv/config";
import prisma from "../config/database.js";
import { ensureClub, ensureProfile, ensureRegistration } from "../services/season-identity.js";

async function main() {
  const repair = process.argv.includes("--repair-identities");
  const seasons = await prisma.season.findMany({ where: { deletedAt: null }, orderBy: { startDate: "asc" } });
  const report = [];
  for (const season of seasons) {
    if (repair) await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-roster:${season.id}`}))`;
      const teams = await tx.team.findMany({ where: { seasonId: season.id, deletedAt: null } });
      for (const team of teams) await ensureClub(tx, team.id);
      const players = await tx.player.findMany({ where: { seasonId: season.id, deletedAt: null } });
      for (const player of players) {
        await ensureProfile(tx, player.id);
        if (!player.teamId || !teams.some(t => t.id === player.teamId)) continue;
        await ensureRegistration(tx, player.id);
      }
      await tx.activityLog.create({ data: { action: "IDENTITY_BACKFILL", entity: "Season", entityId: season.id, metadata: { source: "season-audit --repair-identities", players: players.length, teams: teams.length } } });
    }, { isolationLevel: "Serializable", timeout: 60_000 });
    const [players, teams, fixtures, bans] = await Promise.all([
      prisma.player.findMany({ where: { seasonId: season.id, deletedAt: null }, select: { id: true, profileId: true, isActive: true, teamId: true, team: { select: { seasonId: true } } } }),
      prisma.team.findMany({ where: { seasonId: season.id, deletedAt: null }, select: { id: true, clubId: true } }),
      prisma.fixture.count({ where: { seasonId: season.id, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      prisma.suspension.count({ where: { seasonId: season.id, deletedAt: null, isActive: true } }),
    ]);
    report.push({ seasonId: season.id, name: season.name, lifecycle: season.lifecycle, current: season.isCurrent,
      teams: teams.length, players: players.length, inactive: players.filter(p => !p.isActive).length,
      missingClubs: teams.filter(t => !t.clubId).map(t => t.id), missingProfiles: players.filter(p => !p.profileId).map(p => p.id),
      duplicateProfiles: [...new Set(players.filter(p => p.profileId && players.some(other => other.id !== p.id && other.profileId === p.profileId)).map(p => p.profileId))],
      mismatchedTeams: players.filter(p => p.team && p.team.seasonId !== season.id).map(p => p.id),
      unattached: players.filter(p => !p.teamId).map(p => p.id), unfinishedFixtures: fixtures, outstandingBans: bans });
  }
  const unresolved = await prisma.identityReconciliationIssue.findMany({ where: { status: "OPEN" }, select: { id: true, entityType: true, sourceIds: true, reason: true } });
  console.log(JSON.stringify({ mode: repair ? "identity-repair" : "read-only", seasons: report, unresolvedIdentities: unresolved }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
