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
