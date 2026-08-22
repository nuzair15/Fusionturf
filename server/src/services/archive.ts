import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

export const archiveResources = {
  season: "season",
  competition: "competition",
  competitionEntry: "competitionEntry",
  club: "club",
  seasonClub: "seasonClub",
  team: "team",
  playerProfile: "playerProfile",
  playerRegistration: "playerRegistration",
  player: "player",
  staffProfile: "staffProfile",
  staffRegistration: "staffRegistration",
  staff: "staff",
  fixture: "fixture",
  suspension: "suspension",
  standingAdjustment: "standingAdjustment",
  award: "award",
  poll: "poll",
  venue: "venue",
  turf: "turf",
  additionalService: "additionalService",
  booking: "booking",
  coupon: "coupon",
  review: "review",
  news: "news",
  gallery: "gallery",
  sponsor: "sponsor",
  advertisement: "advertisement",
  faq: "faq",
} as const;

export type ArchiveResourceType = keyof typeof archiveResources;

function displayName(type: ArchiveResourceType, row: Record<string, any>): string {
  if (type === "fixture") return `${row.homeTeamId} vs ${row.awayTeamId}`;
  if (type === "player" || type === "playerProfile" || type === "staff" || type === "staffProfile") {
    return `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.id;
  }
  return row.name || row.title || row.question || row.code || row.bookingNumber || row.reason || row.slug || row.id;
}

function lifecycleSnapshot(row: Record<string, any>) {
  const keys = ["isActive", "isPublished", "isCurrent", "status", "bracketStatus", "votingEnabled", "winnerAnnounced", "blocksAvailability"];
  return Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]]));
}

async function activeBookingCount(type: ArchiveResourceType, id: string, db: Prisma.TransactionClient | typeof prisma) {
  const active = { deletedAt: null, blocksAvailability: true };
  if (type === "booking") return db.booking.count({ where: { id, ...active } });
  if (type === "turf") return db.booking.count({ where: { turfId: id, ...active } });
  if (type === "venue") return db.booking.count({ where: { turf: { venueId: id }, ...active } });
  if (type === "additionalService") return db.booking.count({ where: { bookingServices: { some: { additionalServiceId: id } }, ...active } });
  return 0;
}

async function assertRestoreDependencies(type: ArchiveResourceType, row: Record<string, any>, tx: Prisma.TransactionClient) {
  const requireActive = async (delegateName: string, id: string | null | undefined, label: string) => {
    if (!id) return;
    const parent = await (tx as any)[delegateName].findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!parent) throw new AppError(`Restore the archived ${label} first`, 409, "ARCHIVE_DEPENDENCY_CONFLICT");
  };

  if (["competition", "seasonClub", "team", "playerRegistration", "player", "fixture", "suspension", "standingAdjustment", "award"].includes(type)) {
    await requireActive("season", row.seasonId, "season");
  }
  if (["seasonClub", "competitionEntry", "playerRegistration", "staffRegistration"].includes(type)) {
    await requireActive("club", row.clubId, "club");
  }
  if (["seasonClub", "competitionEntry", "playerRegistration", "staffRegistration"].includes(type)) {
    await requireActive("team", row.teamId, "team");
  }
  if (type === "competitionEntry") await requireActive("competition", row.competitionId, "competition");
  if (type === "playerRegistration") {
    await requireActive("playerProfile", row.playerProfileId, "player profile");
    await requireActive("competition", row.competitionId, "competition");
  }
  if (type === "staffRegistration") await requireActive("staffProfile", row.staffProfileId, "staff profile");
  if (["player", "staff", "standingAdjustment"].includes(type)) await requireActive("team", row.teamId, "team");
  if (type === "player") await requireActive("playerProfile", row.profileId, "player profile");
  if (type === "team") await requireActive("club", row.clubId, "club");
  if (type === "staff") await requireActive("staffProfile", row.profileId, "staff profile");
  if (type === "fixture") {
    await requireActive("team", row.homeTeamId, "home team");
    await requireActive("team", row.awayTeamId, "away team");
    await requireActive("competition", row.competitionId, "competition");
    await requireActive("venue", row.venueId, "venue");
    await requireActive("competitionEntry", row.homeEntryId, "home competition entry");
    await requireActive("competitionEntry", row.awayEntryId, "away competition entry");
  }
  if (type === "suspension") {
    await requireActive("player", row.playerId, "player");
    await requireActive("competition", row.competitionId, "competition");
  }
  if (type === "award") {
    await requireActive("player", row.winnerId, "winning player");
    await requireActive("team", row.winnerTeamId, "winning team");
  }
  if (type === "poll") await requireActive("fixture", row.fixtureId, "fixture");
  if (type === "turf") await requireActive("venue", row.venueId, "venue");
  if (type === "additionalService") await requireActive("turf", row.turfId, "turf");
  if (type === "booking") await requireActive("turf", row.turfId, "turf");
  if (type === "review") {
    await requireActive("venue", row.venueId, "venue");
    await requireActive("booking", row.bookingId, "booking");
  }
  if (type === "news") {
    await requireActive("season", row.seasonId, "season");
    await requireActive("team", row.teamId, "team");
  }
  if (type === "gallery") {
    await requireActive("season", row.seasonId, "season");
    await requireActive("team", row.teamId, "team");
    await requireActive("player", row.playerId, "player");
    await requireActive("fixture", row.fixtureId, "fixture");
    await requireActive("award", row.awardId, "award");
  }
  if (type === "sponsor") await requireActive("team", row.teamId, "team");
}

export async function dependencyPreview(type: ArchiveResourceType, id: string) {
  const counts: Record<string, number> = {};
  if (type === "season") {
    [counts.teams, counts.competitions, counts.fixtures, counts.players] = await Promise.all([
      prisma.team.count({ where: { seasonId: id, deletedAt: null } }),
      prisma.competition.count({ where: { seasonId: id, deletedAt: null } }),
      prisma.fixture.count({ where: { seasonId: id, deletedAt: null } }),
      prisma.player.count({ where: { seasonId: id, deletedAt: null } }),
    ]);
  } else if (type === "competition") {
    [counts.entries, counts.fixtures] = await Promise.all([
      prisma.competitionEntry.count({ where: { competitionId: id, deletedAt: null } }),
      prisma.fixture.count({ where: { competitionId: id, deletedAt: null } }),
    ]);
  } else if (type === "team") {
    [counts.players, counts.fixtures] = await Promise.all([
      prisma.player.count({ where: { teamId: id, deletedAt: null } }),
      prisma.fixture.count({ where: { deletedAt: null, OR: [{ homeTeamId: id }, { awayTeamId: id }] } }),
    ]);
  } else if (type === "fixture") {
    [counts.goals, counts.cards, counts.events] = await Promise.all([
      prisma.goal.count({ where: { fixtureId: id } }),
      prisma.card.count({ where: { fixtureId: id } }),
      prisma.matchEvent.count({ where: { fixtureId: id } }),
    ]);
  } else if (type === "venue") {
    counts.turfs = await prisma.turf.count({ where: { venueId: id, deletedAt: null } });
  } else if (type === "turf") {
    counts.services = await prisma.additionalService.count({ where: { turfId: id, deletedAt: null } });
  } else if (type === "booking") {
    [counts.payments, counts.services] = await Promise.all([
      prisma.payment.count({ where: { bookingId: id } }),
      prisma.bookingService.count({ where: { bookingId: id } }),
    ]);
  } else if (type === "player" || type === "playerProfile") {
    counts.registrations = type === "playerProfile"
      ? await prisma.playerRegistration.count({ where: { playerProfileId: id, deletedAt: null } })
      : 0;
  }
  counts.activeBookings = await activeBookingCount(type, id, prisma);
  return counts;
}

export async function archiveResource(input: {
  type: ArchiveResourceType;
  id: string;
  actorId?: string | null;
  reason?: string | null;
}) {
  const delegateName = archiveResources[input.type];
  const reason = input.reason?.trim() || "Archived by administrator";
  return prisma.$transaction(async (tx) => {
    const delegate = (tx as any)[delegateName];
    const row = await delegate.findUnique({ where: { id: input.id } });
    if (!row) throw new AppError("Record not found", 404);
    if (row.deletedAt) {
      return tx.archiveRecord.findFirstOrThrow({ where: { resourceType: input.type, resourceId: input.id, restoredAt: null } });
    }
    const activeBookings = await activeBookingCount(input.type, input.id, tx);
    if (activeBookings > 0) throw new AppError("Active bookings must be cancelled before this record can be archived", 409);
    const deletedAt = new Date();
    await delegate.update({
      where: { id: input.id },
      data: { deletedAt, deletedById: input.actorId || null, deleteReason: reason },
    });
    return tx.archiveRecord.create({
      data: {
        resourceType: input.type,
        resourceId: input.id,
        displayName: displayName(input.type, row),
        deleteReason: reason,
        deletedById: input.actorId || null,
        deletedAt,
        metadata: { lifecycle: lifecycleSnapshot(row) },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function restoreArchiveRecord(archiveRecordId: string, actorId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const archive = await tx.archiveRecord.findUnique({ where: { id: archiveRecordId } });
    if (!archive || archive.restoredAt) throw new AppError("Archive record not found", 404);
    const type = archive.resourceType as ArchiveResourceType;
    const delegateName = archiveResources[type];
    if (!delegateName) throw new AppError("This record type cannot be restored", 400);
    const delegate = (tx as any)[delegateName];
    const row = await delegate.findUnique({ where: { id: archive.resourceId } });
    if (!row || !row.deletedAt) throw new AppError("The archived record no longer exists or is already active", 409);
    await assertRestoreDependencies(type, row, tx);

    if (type === "booking" && row.blocksAvailability && row.startAt && row.endAt) {
      const overlap = await tx.booking.findFirst({
        where: {
          id: { not: row.id },
          turfId: row.turfId,
          deletedAt: null,
          blocksAvailability: true,
          startAt: { lt: row.endAt },
          endAt: { gt: row.startAt },
        },
      });
      if (overlap) throw new AppError("This booking cannot be restored because its slot is now occupied", 409);
    }

    const restored = await delegate.update({
      where: { id: archive.resourceId },
      data: { deletedAt: null, deletedById: null, deleteReason: null },
    });
    await tx.archiveRecord.update({
      where: { id: archive.id },
      data: { restoredAt: new Date(), restoredById: actorId || null },
    });
    return { archive, restored };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
