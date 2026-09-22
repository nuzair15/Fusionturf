import { AsyncLocalStorage } from "node:async_hooks";
import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

const scope = new AsyncLocalStorage<boolean>();
export const publicSeasonScope = (_req: Request, _res: Response, next: NextFunction) => scope.run(true, next);

export const publicSeasonFilter = { lifecycle: { not: "DRAFT" }, deletedAt: null };

const privateFields = new Set(["activityReason", "activityChangedAt", "rolloverReport", "rolloverKey", "managedById", "deletedById", "deleteReason", "manualOverrides"]);
export function redactPublicMetadata(value: any): any {
  if (Array.isArray(value)) return value.map(redactPublicMetadata);
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFields.has(key)).map(([key, nested]) => [key, redactPublicMetadata(nested)]));
}

/** Applied to public request queries only; admin draft preparation remains accessible. */
export const hideDraftSeasons: Prisma.Middleware = async (params, next) => {
  if (!scope.getStore() || !["findFirst", "findMany", "findUnique", "findFirstOrThrow", "findUniqueOrThrow", "count", "aggregate", "groupBy"].includes(params.action)) return next(params);
  let filter: any;
  if (params.model === "Season") filter = publicSeasonFilter;
  if (["Team", "Player", "Fixture", "Competition", "Standing", "PlayerStat", "FriendlyPlayerStat", "Suspension", "Award", "PlayerRegistration"].includes(params.model || "")) filter = { season: publicSeasonFilter };
  if (["News", "Gallery"].includes(params.model || "")) filter = { OR: [{ seasonId: null }, { season: publicSeasonFilter }] };
  if (params.model === "Sponsor") filter = { OR: [{ teamId: null }, { team: { season: publicSeasonFilter } }] };
  if (filter) {
    params.args ||= {};
    const existing = params.args.where?.AND;
    params.args.where = { ...params.args.where, AND: [...(Array.isArray(existing) ? existing : existing ? [existing] : []), filter] };
  }
  return redactPublicMetadata(await next(params));
};
