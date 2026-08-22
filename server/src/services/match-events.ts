import { MatchEventType, Prisma } from "@prisma/client";

type EventInput = {
  fixtureId: string;
  type: MatchEventType;
  minute?: number | null;
  second?: number | null;
  teamId?: string | null;
  playerId?: string | null;
  secondaryPlayerId?: string | null;
  payload?: Prisma.InputJsonValue;
  idempotencyKey: string;
  createdById?: string | null;
  reversalOfId?: string | null;
};

export async function appendMatchEvent(tx: Prisma.TransactionClient, input: EventInput) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`match-events:${input.fixtureId}`}))`;
  const replay = await tx.matchEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) return replay;

  const [last, player, secondary] = await Promise.all([
    tx.matchEvent.findFirst({ where: { fixtureId: input.fixtureId }, orderBy: { sequence: "desc" }, select: { sequence: true } }),
    input.playerId ? tx.player.findUnique({ where: { id: input.playerId }, select: { profileId: true, seasonId: true } }) : null,
    input.secondaryPlayerId ? tx.player.findUnique({ where: { id: input.secondaryPlayerId }, select: { profileId: true } }) : null,
  ]);
  let registrationId: string | null = null;
  if (player?.profileId) {
    registrationId = (await tx.playerRegistration.findFirst({
      where: { playerProfileId: player.profileId, seasonId: player.seasonId, deletedAt: null, ...(input.teamId ? { teamId: input.teamId } : {}) },
      orderBy: { validFrom: "desc" },
      select: { id: true },
    }))?.id || null;
  }

  return tx.matchEvent.create({
    data: {
      fixtureId: input.fixtureId,
      sequence: (last?.sequence || 0) + 1,
      type: input.type,
      minute: input.minute ?? null,
      second: input.second ?? null,
      teamIdSnapshot: input.teamId ?? null,
      playerProfileIdSnapshot: player?.profileId || null,
      playerRegistrationIdSnapshot: registrationId,
      secondaryPlayerProfileIdSnapshot: secondary?.profileId || null,
      payload: input.payload,
      reversalOfId: input.reversalOfId || null,
      idempotencyKey: input.idempotencyKey,
      createdById: input.createdById || null,
    },
  });
}

export async function reverseLegacyEvent(tx: Prisma.TransactionClient, input: {
  fixtureId: string;
  legacyType: string;
  legacyId: string;
  reason?: string | null;
  createdById?: string | null;
}) {
  let source = await tx.matchEvent.findUnique({ where: { idempotencyKey: `legacy:${input.legacyType}:${input.legacyId}:created` } });
  if (!source) {
    source = await appendMatchEvent(tx, {
      fixtureId: input.fixtureId,
      type: "CORRECTION",
      payload: { legacyType: input.legacyType, legacyId: input.legacyId, importedOnFirstCorrection: true },
      idempotencyKey: `legacy:${input.legacyType}:${input.legacyId}:created`,
      createdById: input.createdById,
    });
  }
  return appendMatchEvent(tx, {
    fixtureId: input.fixtureId,
    type: "REVERSAL",
    payload: { legacyType: input.legacyType, legacyId: input.legacyId, reason: input.reason || null },
    idempotencyKey: `legacy:${input.legacyType}:${input.legacyId}:reversed`,
    createdById: input.createdById,
    reversalOfId: source.id,
  });
}
