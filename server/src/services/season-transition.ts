import { retrySerializable } from "../utils/transaction-retry.js";
import { syncFixtureBooking } from "./fixture-bookings.js";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureClub, ensureProfile, ensureRegistration } from "./season-identity.js";

const sourceInclude = {
  teams: { orderBy: { id: "asc" as const }, include: { staff: { where: { deletedAt: null }, orderBy: { id: "asc" as const } }, sponsors: { where: { deletedAt: null, isActive: true }, orderBy: { id: "asc" as const } } } },
  players: { orderBy: { id: "asc" as const } },
  competitions: { where: { deletedAt: null }, orderBy: { id: "asc" as const }, include: { ruleSets: { where: { isActive: true }, orderBy: { version: "desc" as const } } } },
};

async function sourceSnapshot(db: Prisma.TransactionClient | typeof prisma, id: string) {
  const source = await db.season.findFirst({ where: { id, deletedAt: null, lifecycle: { not: "DRAFT" } }, include: sourceInclude });
  if (!source) throw new AppError("Choose a published source season", 404);
  return source;
}
type Source = Awaited<ReturnType<typeof sourceSnapshot>>;

function summarize(source: Source) {
  const teams = source.teams.filter(t => t.isActive && !t.deletedAt);
  const includedTeams = new Set(teams.map(t => t.id));
  const players = source.players.map(p => ({
    id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), teamId: p.teamId,
    teamName: source.teams.find(t => t.id === p.teamId)?.name || "Unattached",
    included: !p.deletedAt && p.isActive && !!p.teamId && includedTeams.has(p.teamId),
    reason: p.deletedAt ? "Deleted" : !p.isActive ? "Inactive" : !p.teamId ? "Unattached" : !includedTeams.has(p.teamId) ? "Team inactive or deleted" : "Returning to same club",
  }));
  return { sourceId: source.id, sourceName: source.name,
    fingerprint: createHash("sha256").update(JSON.stringify(source)).digest("hex"),
    teams: teams.map(t => ({ id: t.id, name: t.name, staff: t.staff.length, sponsors: t.sponsors.length })), players,
    included: players.filter(p => p.included).length, excluded: players.filter(p => !p.included).length,
    competitions: source.competitions.map(c => ({ id: c.id, name: c.name, type: c.type })),
    banPolicy: "RESET", warnings: ["Season 1 results, awards, votes and media stay in history.", "Fixtures and matchday squads must be prepared separately."] };
}

export async function previewSeasonTransition(sourceId: string) { return summarize(await sourceSnapshot(prisma, sourceId)); }

export interface DraftSeasonInput {
  name: string; startDate: string; endDate: string; fingerprint: string; requestKey: string;
  copyStaff?: boolean; renewSponsors?: boolean;
}

export async function createSeasonDraft(sourceId: string, input: DraftSeasonInput, actorId?: string) {
  const start = new Date(input.startDate), end = new Date(input.endDate);
  if (!input.name?.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || !input.requestKey || !input.fingerprint) {
    throw new AppError("Name, valid dates, preview and request key are required", 400);
  }
  return retrySerializable(() => prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-roster:${sourceId}`}))`;
    const replay = await tx.season.findUnique({ where: { rolloverKey: input.requestKey } });
    if (replay) {
      if (replay.sourceSeasonId !== sourceId) throw new AppError("Request key belongs to another season", 409);
      const oldOptions = replay.rolloverReport as any;
      if (replay.name !== input.name.trim() || +replay.startDate !== +start || +replay.endDate !== +end || oldOptions?.copyStaff !== (input.copyStaff !== false) || oldOptions?.renewSponsors !== !!input.renewSponsors) throw new AppError("Request key was already used for different season options", 409);
      return replay;
    }
    const existing = await tx.season.findUnique({ where: { sourceSeasonId: sourceId } });
    if (existing) throw new AppError(`A next season already exists: ${existing.name}. Continue editing it.`, 409);
    const source = await sourceSnapshot(tx, sourceId);
    const issues = await tx.identityReconciliationIssue.findMany({ where: { status: "OPEN" }, select: { sourceIds: true } });
    const sourceIds = new Set([...source.players.map(p => p.id), ...source.teams.map(t => t.id)]);
    if (issues.some(issue => Array.isArray(issue.sourceIds) && issue.sourceIds.some(id => typeof id === "string" && sourceIds.has(id)))) throw new AppError("Resolve the source season's identity reconciliation issues before rollover", 409);
    const preview = summarize(source);
    if (preview.fingerprint !== input.fingerprint) throw new AppError("The source roster changed. Refresh the preview before continuing.", 409);
    if (!preview.teams.length || !preview.included) throw new AppError("The source must have active teams and returning players", 400);
    if (start <= source.startDate) throw new AppError("The next season must start after the source season starts", 400);
    const repeatedProfiles = source.players.filter(p => p.profileId && preview.players.find(x => x.id === p.id)?.included);
    if (new Set(repeatedProfiles.map(p => p.profileId)).size !== repeatedProfiles.length) throw new AppError("Resolve duplicate player identities in the source season first", 409);
    const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) throw new AppError("Season name must contain letters or numbers", 400);
    const target = await tx.season.create({ data: {
      name: input.name.trim(), slug, startDate: start, endDate: end, lifecycle: "DRAFT", isCurrent: false, isActive: false,
      sourceSeasonId: source.id, rolloverKey: input.requestKey, leagueWeeks: source.leagueWeeks, fixtureDays: source.fixtureDays,
      managedById: source.managedById,
    } });
    const competitions = [];
    for (const c of source.competitions) {
      const created = await tx.competition.create({ data: { seasonId: target.id, name: c.name, slug: c.slug, type: c.type, timezone: c.timezone, isActive: c.isActive } });
      const rules = c.ruleSets[0];
      if (rules) {
        const { id, competitionId, createdAt, createdById, version, ...settings } = rules;
        await tx.competitionRuleSet.create({ data: { ...settings, competitionId: created.id, version: 1, createdById: actorId } as Prisma.CompetitionRuleSetUncheckedCreateInput });
      } else await tx.competitionRuleSet.create({ data: { competitionId: created.id, version: 1, isActive: true } });
      competitions.push(created);
    }
    if (!competitions.some(c => c.type === "LEAGUE")) {
      const c = await tx.competition.create({ data: { seasonId: target.id, name: `${target.name} League`, slug: "league", type: "LEAGUE" } });
      await tx.competitionRuleSet.create({ data: { competitionId: c.id, version: 1, isActive: true } });
      competitions.push(c);
    }
    const teamMap: Record<string, string> = {}, playerMap: Record<string, string> = {};
    for (const old of source.teams.filter(t => t.isActive && !t.deletedAt)) {
      const clubId = await ensureClub(tx, old.id);
      const { id, seasonId, slug: oldSlug, createdAt, updatedAt, deletedAt, deletedById, deleteReason, staff, sponsors, ...fields } = old;
      const team = await tx.team.create({ data: { ...fields, achievements: fields.achievements ?? undefined, socialLinks: fields.socialLinks ?? undefined,
        clubId, seasonId: target.id, slug: `${oldSlug}-${target.slug}`, isActive: true, status: "active" } });
      teamMap[old.id] = team.id;
      await tx.seasonClub.create({ data: { seasonId: target.id, clubId, teamId: team.id } });
      for (const c of competitions) await tx.competitionEntry.create({ data: { competitionId: c.id, clubId, teamId: team.id } });
      await tx.standing.create({ data: { seasonId: target.id, teamId: team.id } });
      if (input.copyStaff !== false) for (const s of staff) {
        let profileId = s.profileId;
        if (!profileId) {
          const profile = await tx.staffProfile.create({ data: { slug: `staff-${s.id}`, firstName: s.firstName, lastName: s.lastName, photoUrl: s.photoUrl } });
          profileId = profile.id;
          await tx.staff.update({ where: { id: s.id }, data: { profileId } });
        }
        await tx.staff.create({ data: { teamId: team.id, profileId, firstName: s.firstName, lastName: s.lastName, photoUrl: s.photoUrl, role: s.role } });
        await tx.staffRegistration.create({ data: { staffProfileId: profileId, clubId, teamId: team.id, role: s.role, validFrom: start, validTo: end } });
      }
      if (input.renewSponsors) for (const s of sponsors) {
        const { id, teamId, createdAt, deletedAt, deletedById, deleteReason, ...sponsor } = s;
        await tx.sponsor.create({ data: { ...sponsor, teamId: team.id } });
      }
    }
    for (const old of source.players.filter(p => preview.players.find(x => x.id === p.id)?.included)) {
      const profileId = await ensureProfile(tx, old.id);
      await ensureRegistration(tx, old.id);
      const { id, seasonId, teamId, slug: oldSlug, createdAt, updatedAt, deletedAt, deletedById, deleteReason, ...fields } = old;
      const player = await tx.player.create({ data: { ...fields, profileId, seasonId: target.id, teamId: teamMap[teamId!], slug: `${oldSlug}-${target.slug}`, activityReason: null, activityChangedAt: null } });
      playerMap[id] = player.id;
      await ensureRegistration(tx, player.id);
    }
    const report = { ...preview, teamMap, playerMap, createdById: actorId || null, copyStaff: input.copyStaff !== false, renewSponsors: !!input.renewSponsors, createdAt: new Date().toISOString() };
    return tx.season.update({ where: { id: target.id }, data: { rolloverReport: report } });
  }, { isolationLevel: "Serializable", timeout: 60_000 }));
}

export async function seasonReadiness(id: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const season = await db.season.findFirst({ where: { id, deletedAt: null }, include: { teams: { where: { isActive: true, deletedAt: null }, include: { players: { where: { isActive: true, deletedAt: null } } } }, competitions: { where: { type: "LEAGUE", deletedAt: null }, include: { ruleSets: { where: { isActive: true } } } } } });
  if (!season) throw new AppError("Season not found", 404);
  const blockers: string[] = [];
  if (season.lifecycle !== "DRAFT") blockers.push("Only a draft can be activated.");
  if (season.teams.length < 2) blockers.push("At least two active teams are required.");
  const rules = season.competitions[0]?.ruleSets[0];
  if (!rules) blockers.push("An active league rule set is required.");
  for (const team of season.teams) {
    if (!team.clubId) blockers.push(`${team.name}: missing permanent club identity.`);
    if (team.players.some(p => p.seasonId !== id || !p.profileId)) blockers.push(`${team.name}: incomplete player identities or incorrect season.`);
    if (team.players.filter(p => p.squadType === "STARTER").length !== (rules?.starterLimit || 6)) blockers.push(`${team.name}: review the starter count.`);
    if (team.players.filter(p => p.squadType === "SUBSTITUTE").length !== (rules?.substituteLimit ?? 2)) blockers.push(`${team.name}: review the substitute count.`);
    const numbers = team.players.map(p => p.jerseyNumber).filter(n => n !== null);
    if (new Set(numbers).size !== numbers.length) blockers.push(`${team.name}: duplicate jersey numbers.`);
  }
  const players = season.teams.flatMap(t => t.players);
  const registrations = await db.playerRegistration.findMany({ where: { seasonId: id, deletedAt: null, status: "ACTIVE" } });
  for (const player of players) {
    const matching = registrations.filter(r => r.playerProfileId === player.profileId && r.teamId === player.teamId);
    if (matching.length !== 1 || matching.some(r => r.validTo && r.validFrom >= r.validTo)) blockers.push(`${player.firstName}: review active registration and dates.`);
  }
  const entries = await db.competitionEntry.findMany({ where: { competition: { seasonId: id, type: "LEAGUE", deletedAt: null }, deletedAt: null, status: "ACTIVE" } });
  if (season.teams.some(t => !entries.some(e => e.teamId === t.id && e.clubId === t.clubId))) blockers.push("Every active team must have a league competition entry.");
  if (new Set(players.map(p => p.profileId)).size !== players.length) blockers.push("Duplicate player identities in the target roster.");
  const fixtures = await db.fixture.findMany({ where: { seasonId: id, deletedAt: null }, select: { homeTeamId: true, awayTeamId: true, status: true, matchDate: true, kickoffTime: true, scheduledDate: true } });
  if (fixtures.some(f => f.status === "SCHEDULED" && (!f.kickoffTime || !f.scheduledDate))) blockers.push("Every scheduled fixture needs a date and kickoff time.");
  if (!fixtures.some(f => f.status === "SCHEDULED")) blockers.push("Prepare the Season 2 fixtures first.");
  const teamIds = new Set(season.teams.map(t => t.id));
  if (fixtures.some(f => !teamIds.has(f.homeTeamId) || !teamIds.has(f.awayTeamId) || f.homeTeamId === f.awayTeamId)) blockers.push("Fixtures contain invalid or inactive teams.");
  if (fixtures.some(f => f.matchDate < season.startDate || f.matchDate > season.endDate)) blockers.push("Fixtures fall outside the season dates.");
  if (fixtures.some(f => f.status !== "SCHEDULED" && f.status !== "CANCELLED")) blockers.push("A draft must not contain played or live fixtures.");
  const current = await db.season.findFirst({ where: { isCurrent: true, deletedAt: null } });
  if (season.sourceSeasonId && current?.id !== season.sourceSeasonId) blockers.push("The source is no longer the current season.");
  if (current) {
    const unfinished = await db.fixture.count({ where: { seasonId: current.id, deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
    if (unfinished) blockers.push(`${unfinished} source-season fixtures still need completion or cancellation.`);
    const pending = await db.projectionVersion.count({ where: { competition: { seasonId: current.id }, status: { not: "BUILT" } } });
    if (pending) blockers.push("Source-season result projections need reconciliation.");
  }
  return { seasonId: id, ready: blockers.length === 0, blockers, teams: season.teams.length, players: players.length, fixtures: fixtures.length, banPolicy: "RESET" };
}

export async function activateSeason(id: string, actorId?: string) {
  return retrySerializable(() => prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('season-activation'))`;
    const target = await tx.season.findUniqueOrThrow({ where: { id } });
    if (target.isCurrent && target.lifecycle === "ACTIVE") return target;
    for (const seasonId of [id, target.sourceSeasonId].filter((value): value is string => !!value).sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`season-roster:${seasonId}`}))`;
    const readiness = await seasonReadiness(id, tx);
    if (!readiness.ready) throw new AppError(readiness.blockers.join(" "), 409);
    const now = new Date();
    await tx.season.updateMany({ where: { isCurrent: true, deletedAt: null }, data: { isCurrent: false, lifecycle: "COMPLETED", transferWindowOpen: false, transferWindowEndsAt: now } });
    const activated = await tx.season.update({ where: { id }, data: { isCurrent: true, isActive: true, lifecycle: "ACTIVE", activatedAt: now,
      rolloverReport: { ...(target.rolloverReport as object || {}), activatedById: actorId || null, activatedAt: now.toISOString(), banPolicy: "RESET" } } });
    const fixtures = await tx.fixture.findMany({ where: { seasonId: id, deletedAt: null, status: "SCHEDULED" }, select: { id: true } });
    for (const fixture of fixtures) await syncFixtureBooking(fixture.id, tx);
    return activated;
  }, { isolationLevel: "Serializable", timeout: 60_000 }));
}
