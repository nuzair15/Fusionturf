import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

export type StatRow = { playerId: string; teamId: string; appearances: number; minutesPlayed: number; goals: number; assists: number; shots: number; shotsOnTarget: number; yellowCards: number; redCards: number; saves: number | null; cleanSheets: number | null; goalsConceded: number | null; averageRating: number | null };

/** Derive team attribution from match records, never from today's roster. */
export function calculateHistoricalPlayerStats(players: any[], fixtures: any[], existing: any[] = []): StatRow[] {
  const rows = new Map<string, StatRow>();
  const playerById = new Map(players.map(p => [p.id, p]));
  const row = (playerId: string, teamId: string) => {
    const key = `${playerId}:${teamId}`;
    if (!rows.has(key)) rows.set(key, { playerId, teamId, appearances: 0, minutesPlayed: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, yellowCards: 0, redCards: 0, saves: null, cleanSheets: null, goalsConceded: null, averageRating: null });
    return rows.get(key)!;
  };
  // Zero rows remain visible even before a debut; inactive players' historical rows survive.
  for (const p of players) if (p.teamId) row(p.id, p.teamId);
  for (const old of existing) row(old.playerId, old.teamId);
  const ratings = new Map<string, number[]>();
  for (const f of fixtures) {
    const affiliation = new Map<string, string>();
    const appeared = new Set<string>();
    const duration = Math.max(1, Math.round((f.matchClockSeconds || 3600) / 60));
    const entered = new Map<string, number>(), left = new Map<string, number>();
    for (const l of f.lineups) { affiliation.set(l.playerId, l.teamId); if (l.isStarter) appeared.add(l.playerId); }
    for (const a of f.appearances) { affiliation.set(a.playerId, a.teamId); appeared.add(a.playerId); if (!a.isStarter && a.enteredAt != null) entered.set(a.playerId, a.enteredAt); }
    for (const s of f.matchdaySquads) for (const e of s.entries) { affiliation.set(e.playerId, s.teamId); if (e.isStarter) appeared.add(e.playerId); }
    for (const s of f.substitutions) {
      for (const id of [s.playerOnId, s.playerOffId]) { if (s.teamId) affiliation.set(id, s.teamId); appeared.add(id); }
      entered.set(s.playerOnId, s.minute); left.set(s.playerOffId, s.minute);
    }
    const teamFor = (playerId: string, snapshot?: string | null) => {
      let teamId = snapshot || affiliation.get(playerId);
      if (!teamId) {
        const p = playerById.get(playerId);
        const transfers = [...(p?.transfers || [])].sort((a, b) => +new Date(a.transferredAt) - +new Date(b.transferredAt));
        const after = transfers.find(t => +new Date(t.transferredAt) > +new Date(f.kickoffAt || f.matchDate));
        teamId = after?.fromTeamId || transfers.at(-1)?.toTeamId || p?.teamId;
      }
      if (!teamId || ![f.homeTeamId, f.awayTeamId].includes(teamId)) throw new AppError(`Resolve historical team attribution for player ${playerId} in fixture ${f.id}`, 409);
      return teamId;
    };
    for (const id of appeared) {
      const r = row(id, teamFor(id)); r.appearances++;
      r.minutesPlayed += Math.max(0, Math.min(left.get(id) ?? duration, duration) - Math.min(entered.get(id) ?? 0, duration));
    }
    for (const g of f.goals) if (!g.isOwnGoal) row(g.playerId, teamFor(g.playerId, g.teamId)).goals++;
    for (const a of f.assists) row(a.playerId, teamFor(a.playerId, a.teamId)).assists++;
    for (const c of f.cards) { const r = row(c.playerId, teamFor(c.playerId, c.teamId)); if (c.type === "YELLOW") r.yellowCards++; else if (["RED", "SECOND_YELLOW"].includes(c.type)) r.redCards++; }
    for (const s of f.shots) { const r = row(s.playerId, teamFor(s.playerId, s.teamId)); r.shots++; if (s.outcome === "ON_TARGET") r.shotsOnTarget++; }
    for (const l of f.lineups.filter((l: any) => l.isGoalkeeper || l.role === "GK")) if (appeared.has(l.playerId)) {
      const r = row(l.playerId, l.teamId), home = l.teamId === f.homeTeamId;
      const conceded = (home ? f.awayScore : f.homeScore) || 0;
      r.goalsConceded = (r.goalsConceded || 0) + conceded;
      r.cleanSheets = (r.cleanSheets || 0) + (conceded === 0 ? 1 : 0);
      r.saves = (r.saves || 0) + Math.max(0, ((home ? f.awayShotsOnTarget : f.homeShotsOnTarget) || 0) - conceded);
    }
    for (const rating of f.matchPlayerRatings) {
      const key = `${rating.playerId}:${teamFor(rating.playerId)}`;
      ratings.set(key, [...(ratings.get(key) || []), rating.rating]);
    }
  }
  for (const [key, values] of ratings) { const r = rows.get(key); if (r) r.averageRating = values.reduce((a, b) => a + b, 0) / values.length; }
  return [...rows.values()];
}

export async function rebuildHistoricalPlayerStats(seasonId: string, friendly: boolean) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`player-stat-rebuild:${seasonId}:${friendly}`}))`;
    const where: Prisma.FixtureWhereInput = { seasonId, deletedAt: null, status: "COMPLETED", ...(friendly ? { OR: [{ isFriendly: true }, { competition: { is: { type: "FRIENDLY" } } }] } : { isFriendly: false, isGrandFinal: false, isRelegationPlayoff: false, OR: [{ competitionId: null }, { competition: { is: { type: "LEAGUE" } } }] }) };
    const [players, fixtures, existing] = await Promise.all([
      tx.player.findMany({ where: { seasonId }, include: { transfers: true } }),
      tx.fixture.findMany({ where, include: { lineups: true, appearances: true, matchdaySquads: { include: { entries: true } }, substitutions: true, goals: true, assists: true, cards: true, shots: true, matchPlayerRatings: true } }),
      friendly ? tx.friendlyPlayerStat.findMany({ where: { seasonId } }) : tx.playerStat.findMany({ where: { seasonId } }),
    ]);
    const overrides = new Map(existing.map(s => [`${s.playerId}:${s.teamId}`, s.manualOverrides]));
    for (const calculated of calculateHistoricalPlayerStats(players, fixtures, existing)) {
      const { playerId, teamId, saves, cleanSheets, goalsConceded, ...common } = calculated;
      const manual = overrides.get(`${playerId}:${teamId}`) as Record<string, any> | null;
      const data = { ...common, ...(friendly ? {} : { saves, cleanSheets, goalsConceded }), ...(manual || {}) };
      if (manual?.appearances !== undefined) data.appearances = Math.min(manual.appearances, common.appearances);
      const key = { seasonId_playerId_teamId: { seasonId, playerId, teamId } };
      if (friendly) await tx.friendlyPlayerStat.upsert({ where: key, create: { seasonId, playerId, teamId, ...data }, update: data });
      else await tx.playerStat.upsert({ where: key, create: { seasonId, playerId, teamId, ...data }, update: data });
    }
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
