/**
 * Returns a new object containing only the given keys from `obj`, skipping
 * any key whose value is `undefined`. Used to whitelist which fields a
 * client-supplied request body may set on a Prisma create/update call,
 * instead of spreading `req.body` directly (which lets a caller set any
 * column that happens to share a name with a real field — e.g. `id`,
 * `winnerAnnounced`, foreign keys — that the endpoint never intended to
 * expose).
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T | undefined | null,
  keys: readonly K[]
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  if (!obj) return result;
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}
