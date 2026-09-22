import { retrySerializable } from "../utils/transaction-retry.js";
import { randomUUID } from "node:crypto";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ACTIVE_MATCH_STATUSES } from "../utils/fixtures.js";
import { ensureProfile, ensureClub, ensureRegistration, lockSeason } from "./season-identity.js";

function playerFields(input: Record<string, unknown>) {
  const data: Record<string, any> = {};
  for (const key of ["firstName", "lastName", "position", "photoUrl", "nationality", "preferredFoot", "biography", "squadType"]) {
    if (input[key] !== undefined) data[key] = input[key] === "" && !["firstName", "lastName"].includes(key) ? null : input[key];
  }
  if (data.firstName !== undefined && (typeof data.firstName !== "string" || !data.firstName.trim())) throw new AppError("First name is required", 400);
  if (data.squadType && !["STARTER", "SUBSTITUTE", "RESERVE"].includes(data.squadType)) throw new AppError("Invalid squad type", 400);
  for (const key of ["jerseyNumber", "age", "height", "weight"]) if (input[key] !== undefined) {
    const n = input[key] === "" || input[key] === null ? null : Number(input[key]);
    if (n !== null && (!Number.isInteger(n) || n < 0)) throw new AppError(`Invalid ${key}`, 400);
    data[key] = n;
  }
  return data;
}

export async function registerPlayer(input: Record<string, any>) {
  if (!input.teamId) throw new AppError("A team is required", 400);
  return retrySerializable(() => prisma.$transaction(async tx => {
    const team = await tx.team.findFirst({ where: { id: input.teamId, deletedAt: null, isActive: true } });
    if (!team) throw new AppError("Active team not found", 404);
    await lockSeason(tx, team.seasonId);
    const profile = input.profileId ? await tx.playerProfile.findFirst({ where: { id: input.profileId, deletedAt: null } }) : null;
    if (input.profileId && !profile) throw new AppError("Player identity not found", 404);
    if (profile && await tx.player.count({ where: { profileId: profile.id, seasonId: team.seasonId } })) throw new AppError("This player already has a season record. Reactivate or restore that record.", 409);
    const data = playerFields(input);
    if (!profile && !data.firstName) throw new AppError("First name is required", 400);
    const id = randomUUID();
    const player = await tx.player.create({ data: {
      ...(profile ? { firstName: profile.firstName, lastName: profile.lastName, nationality: profile.nationality, photoUrl: profile.photoUrl, biography: profile.biography, dateOfBirth: profile.dateOfBirth, height: profile.height, weight: profile.weight, preferredFoot: profile.preferredFoot } : {}),
      ...data, id, firstName: data.firstName || profile!.firstName, lastName: data.lastName ?? profile?.lastName ?? "",
      slug: `player-${id}`, seasonId: team.seasonId, teamId: team.id, profileId: profile?.id, isActive: true,
    } });
    await ensureProfile(tx, player.id);
    await ensureRegistration(tx, player.id);
    return tx.player.findUniqueOrThrow({ where: { id: player.id } });
  }, { isolationLevel: "Serializable" }));
}

export async function updateRosterPlayer(id: string, input: Record<string, any>, actorId?: string) {
  return retrySerializable(() => prisma.$transaction(async tx => {
    const current = await tx.player.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new AppError("Player not found", 404);
    const season = await lockSeason(tx, current.seasonId);
    const data = playerFields(input);
    const transferring = input.teamId !== undefined && input.teamId !== current.teamId;
    const statusChanging = input.isActive !== undefined && input.isActive !== current.isActive;
    if (input.isActive !== undefined && typeof input.isActive !== "boolean") throw new AppError("isActive must be true or false", 400);
    if (input.seasonId && input.seasonId !== current.seasonId) throw new AppError("Register the player in the new season instead of moving this record", 400);
    const reason = String(input.activityReason || input.transferReason || "").trim();
    if ((statusChanging || transferring) && !reason) throw new AppError("A reason is required for status changes and transfers", 400);
    const now = new Date();
    if (transferring) {
      if (!current.isActive) throw new AppError("Reactivate the player before transferring", 400);
      if (!season.transferWindowOpen || !season.transferWindowStartsAt || !season.transferWindowEndsAt || now < season.transferWindowStartsAt || now >= season.transferWindowEndsAt) throw new AppError("The transfer window is closed or expired", 400);
      const team = await tx.team.findFirst({ where: { id: input.teamId, seasonId: current.seasonId, deletedAt: null, isActive: true } });
      if (!team) throw new AppError("Transfers must use an active team in the same season", 400);
      data.teamId = team.id;
    }
    if (transferring || (statusChanging && !input.isActive)) {
      const live = await tx.fixture.count({ where: { seasonId: current.seasonId, deletedAt: null, status: { in: ACTIVE_MATCH_STATUSES }, OR: [{ homeTeamId: current.teamId || "" }, { awayTeamId: current.teamId || "" }] } });
      if (live) throw new AppError("Finish the team's live match before changing player eligibility", 409);
      const future = { seasonId: current.seasonId, deletedAt: null, status: { in: ["SCHEDULED", "POSTPONED"] as any } };
      const assigned = await tx.lineup.count({ where: { playerId: id, fixture: future } }) + await tx.matchdaySquadEntry.count({ where: { playerId: id, squad: { fixture: future } } });
      if (assigned && input.clearFutureSquads !== true) throw new AppError("This player is selected for upcoming matches. Confirm removal from those squads.", 409);
      await tx.lineup.deleteMany({ where: { playerId: id, fixture: future } });
      await tx.matchdaySquadEntry.deleteMany({ where: { playerId: id, squad: { fixture: future } } });
      await tx.matchAppearance.deleteMany({ where: { playerId: id, fixture: future } });
    }
    const profileId = await ensureProfile(tx, id);
    await ensureRegistration(tx, id);
    if (statusChanging) Object.assign(data, { isActive: input.isActive, activityReason: reason, activityChangedAt: now });
    const player = await tx.player.update({ where: { id }, data });
    const identityData = Object.fromEntries(Object.entries(data).filter(([key]) => ["firstName", "lastName", "nationality", "height", "weight", "preferredFoot", "photoUrl", "biography"].includes(key)));
    if (Object.keys(identityData).length) await tx.playerProfile.update({ where: { id: profileId }, data: identityData });
    if (transferring) {
      const lastRegistration = await tx.playerRegistration.findFirst({ where: { playerProfileId: profileId, seasonId: current.seasonId }, orderBy: { validFrom: "desc" } });
      const proposed = season.lifecycle === "DRAFT" ? season.startDate : now;
      const effective = new Date(Math.max(+proposed, lastRegistration ? +lastRegistration.validFrom + 1 : +proposed));
      await tx.playerRegistration.updateMany({ where: { playerProfileId: profileId, seasonId: current.seasonId, status: { in: ["ACTIVE", "INACTIVE"] }, deletedAt: null }, data: { status: "RELEASED", validTo: effective } });
      // The legacy registration key includes validFrom; choose an unused instant for multiple draft transfers.
      let validFrom = effective;
      while (await tx.playerRegistration.findUnique({ where: { playerProfileId_seasonId_validFrom: { playerProfileId: profileId, seasonId: current.seasonId, validFrom } } })) validFrom = new Date(validFrom.getTime() + 1);
      await tx.playerRegistration.create({ data: { playerProfileId: profileId, seasonId: current.seasonId, teamId: player.teamId, clubId: await ensureClub(tx, player.teamId!), validFrom, validTo: season.endDate, position: player.position, jerseyNumber: player.jerseyNumber, status: player.isActive ? "ACTIVE" : "INACTIVE" } });
      await tx.playerTransfer.create({ data: { playerId: id, fromTeamId: current.teamId, toTeamId: player.teamId!, fromSeasonId: current.seasonId, toSeasonId: current.seasonId, reason, createdById: actorId } });
    } else {
      await tx.playerRegistration.updateMany({ where: { playerProfileId: profileId, seasonId: current.seasonId, teamId: player.teamId, status: { in: ["ACTIVE", "INACTIVE"] }, deletedAt: null }, data: { status: player.isActive ? "ACTIVE" : "INACTIVE", jerseyNumber: player.jerseyNumber, position: player.position } });
    }
    if (statusChanging || transferring) await tx.activityLog.create({ data: { userId: actorId, action: transferring ? "PLAYER_TRANSFER" : "PLAYER_ACTIVITY", entity: "Player", entityId: id, metadata: { reason, seasonId: current.seasonId, fromTeamId: current.teamId, toTeamId: player.teamId, wasActive: current.isActive, isActive: player.isActive, clearFutureSquads: !!input.clearFutureSquads } } });
    return player;
  }, { isolationLevel: "Serializable" }));
}
