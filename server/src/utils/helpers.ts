import prisma from "../config/database.js";

// Cache whether the players table has a legacy "name" column (from before firstName/lastName split)
let hasPlayerNameColumn: boolean | null = null;

async function playerNameColumnExists(): Promise<boolean> {
  if (hasPlayerNameColumn !== null) return hasPlayerNameColumn;
  try {
    const [row] = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='name') as "exists"`
    );
    hasPlayerNameColumn = row?.exists ?? false;
  } catch {
    hasPlayerNameColumn = false;
  }
  return hasPlayerNameColumn;
}

export async function searchPlayerIds(
  q: string,
  options?: { teamId?: string; seasonId?: string; position?: string; isActive?: boolean; limit?: number; offset?: number }
): Promise<{ ids: string[]; total: number }> {
  const { teamId, seasonId, position, isActive, limit = 10, offset = 0 } = options || {};
  const pattern = `%${q}%`;
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  // Core player name search
  conditions.push(`(p."firstName" ILIKE $${idx} OR p."lastName" ILIKE $${idx} OR (p."firstName" || ' ' || p."lastName") ILIKE $${idx})`);
  params.push(pattern);
  idx++;

  // Legacy single "name" column (if migration was partial)
  if (await playerNameColumnExists()) {
    conditions.push(`p."name" ILIKE $${idx}`);
    params.push(pattern);
    idx++;
  }

  // Jersey number (cast to text)
  conditions.push(`CAST(p."jerseyNumber" AS TEXT) ILIKE $${idx}`);
  params.push(pattern);
  idx++;

  // Player ID (partial UUID match)
  conditions.push(`p."id" ILIKE $${idx}`);
  params.push(pattern);
  idx++;

  // Team name
  conditions.push(`t."name" ILIKE $${idx}`);
  params.push(pattern);
  idx++;

  const join = `LEFT JOIN "teams" t ON t."id" = p."teamId"`;

  // Search conditions (OR'd — broaden across fields)
  const searchClause = conditions.join(" OR ");

  // Optional filters (AND'd — narrow down)
  const filterParts: string[] = [];
  if (teamId) { filterParts.push(`p."teamId" = $${idx}`); params.push(teamId); idx++; }
  if (seasonId) { filterParts.push(`p."seasonId" = $${idx}`); params.push(seasonId); idx++; }
  if (position) { filterParts.push(`p."position" = $${idx}`); params.push(position); idx++; }
  if (isActive !== undefined) { filterParts.push(`p."isActive" = $${idx}`); params.push(isActive); idx++; }

  const where = filterParts.length > 0
    ? `(${searchClause}) AND ${filterParts.join(" AND ")}`
    : searchClause;

  const [countRow] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COUNT(*) as total FROM "players" p ${join} WHERE ${where}`,
    ...params
  );

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT p."id" FROM "players" p ${join} WHERE ${where} ORDER BY p."firstName" ASC LIMIT $${idx} OFFSET $${idx + 1}`,
    ...params, limit, offset
  );

  return { ids: rows.map((r: any) => r.id), total: Number(countRow.total) };
}

export const paginate = (query: { page?: string; limit?: string }) => {
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const paginatedResponse = <T>(data: T[], total: number, page: number, limit: number) => ({
  data,
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

export const generateBookingNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FL-${timestamp}-${random}`;
};

export const calculateMatchStats = (homeScore: number, awayScore: number) => {
  if (homeScore > awayScore) return { home: "W", away: "L" };
  if (homeScore < awayScore) return { home: "L", away: "W" };
  return { home: "D", away: "D" };
};
