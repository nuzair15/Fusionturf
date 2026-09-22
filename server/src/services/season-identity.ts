import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";

export async function lockSeason(tx: Prisma.TransactionClient, seasonId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-roster:${seasonId}`}))`;
  const season = await tx.season.findFirst({ where: { id: seasonId, deletedAt: null } });
  if (!season) throw new AppError("Season not found", 404);
  if (season.lifecycle === "COMPLETED") throw new AppError("This season is completed. Its roster is read-only.", 409);
  return season;
}

export async function ensureClub(tx: Prisma.TransactionClient, teamId: string) {
  const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
  if (team.clubId) {
    await tx.seasonClub.upsert({ where: { seasonId_clubId: { seasonId: team.seasonId, clubId: team.clubId } }, create: { seasonId: team.seasonId, clubId: team.clubId, teamId }, update: {} });
    for (const competition of await tx.competition.findMany({ where: { seasonId: team.seasonId, type: "LEAGUE", deletedAt: null } })) await tx.competitionEntry.upsert({ where: { competitionId_clubId: { competitionId: competition.id, clubId: team.clubId } }, create: { competitionId: competition.id, clubId: team.clubId, teamId }, update: {} });
    return team.clubId;
  }
  // Deterministic identity: never infer that two equal names are the same club.
  const club = await tx.club.upsert({
    where: { slug: `club-${team.id}` }, update: {},
    create: { slug: `club-${team.id}`, name: team.name, shortName: team.shortName, logoUrl: team.logoUrl,
      coverUrl: team.coverUrl, city: team.city, description: team.description, history: team.history,
      foundedYear: team.foundedYear, homeStadium: team.homeStadium, website: team.website,
      socialLinks: team.socialLinks ?? undefined, achievements: team.achievements ?? undefined },
  });
  await tx.team.update({ where: { id: team.id }, data: { clubId: club.id } });
  await tx.seasonClub.upsert({ where: { seasonId_clubId: { seasonId: team.seasonId, clubId: club.id } },
    create: { seasonId: team.seasonId, clubId: club.id, teamId }, update: {} });
  return ensureClub(tx, teamId);
}

export async function ensureProfile(tx: Prisma.TransactionClient, playerId: string) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  if (player.profileId) return player.profileId;
  const profile = await tx.playerProfile.upsert({
    where: { slug: `player-${player.id}` }, update: {},
    create: { slug: `player-${player.id}`, firstName: player.firstName, lastName: player.lastName,
      nationality: player.nationality, dateOfBirth: player.dateOfBirth, height: player.height,
      weight: player.weight, preferredFoot: player.preferredFoot, photoUrl: player.photoUrl, biography: player.biography },
  });
  await tx.player.update({ where: { id: player.id }, data: { profileId: profile.id } });
  return profile.id;
}

export async function ensureRegistration(tx: Prisma.TransactionClient, playerId: string) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, include: { season: true } });
  if (!player.teamId) return;
  const profileId = await ensureProfile(tx, player.id);
  const clubId = await ensureClub(tx, player.teamId);
  const existing = await tx.playerRegistration.findFirst({ where: { playerProfileId: profileId, seasonId: player.seasonId, teamId: player.teamId, deletedAt: null } });
  if (!existing) await tx.playerRegistration.create({ data: {
    playerProfileId: profileId, seasonId: player.seasonId, teamId: player.teamId, clubId,
    validFrom: player.season.startDate, validTo: player.season.endDate,
    status: player.isActive ? "ACTIVE" : "INACTIVE", jerseyNumber: player.jerseyNumber, position: player.position,
  } });
}
