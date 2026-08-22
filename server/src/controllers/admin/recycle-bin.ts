import { Request, Response, NextFunction } from "express";
import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import * as leagueSystem from "../../services/league-system.js";
import { archiveResource, archiveResources, ArchiveResourceType, dependencyPreview, restoreArchiveRecord } from "../../services/archive.js";

export const archiveToRecycleBin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.params.type as ArchiveResourceType;
    if (!(type in archiveResources)) throw new AppError("This record type cannot be archived", 400);
    const archive = await archiveResource({
      type,
      id: req.params.id,
      actorId: req.user?.userId,
      reason: typeof req.body?.reason === "string" ? req.body.reason : null,
    });
    res.status(201).json(archive);
  } catch (error) {
    next(error);
  }
};

export const getRecycleBin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const page = Math.max(1, Number(req.query.page) || 1);
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (type && !(type in archiveResources)) throw new AppError("Unknown recycle-bin record type", 400);
    const where = {
      restoredAt: null,
      ...(type ? { resourceType: type } : {}),
      ...(search ? { displayName: { contains: search, mode: "insensitive" as const } } : {}),
    };
    const [records, total] = await Promise.all([
      prisma.archiveRecord.findMany({
        where,
        orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.archiveRecord.count({ where }),
    ]);
    const actorIds = [...new Set(records.map((record) => record.deletedById).filter((id): id is string => !!id))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    const data = records.map((record) => ({ ...record, deletedBy: record.deletedById ? actorById.get(record.deletedById) || null : null }));
    const totalPages = Math.ceil(total / limit);
    res.json({ data, meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 } });
  } catch (error) {
    next(error);
  }
};

export const getRecycleBinDependencies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const archive = await prisma.archiveRecord.findFirst({ where: { id: req.params.archiveId, restoredAt: null } });
    if (!archive) throw new AppError("Archive record not found", 404);
    const type = archive.resourceType as ArchiveResourceType;
    if (!(type in archiveResources)) throw new AppError("This record type is not supported", 400);
    res.json({ archive, dependencies: await dependencyPreview(type, archive.resourceId) });
  } catch (error) {
    next(error);
  }
};

export const restoreFromRecycleBin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let archiveRecordId = req.params.archiveId;
    // One-release v1 adapter: old clients sent resource type/id rather than
    // the immutable archive-record identifier.
    if (!archiveRecordId && req.params.type && req.params.id) {
      const archive = await prisma.archiveRecord.findFirst({
        where: { resourceType: req.params.type, resourceId: req.params.id, restoredAt: null },
        orderBy: { deletedAt: "desc" },
      });
      if (!archive) throw new AppError("Archive record not found", 404);
      archiveRecordId = archive.id;
    }
    if (!archiveRecordId) throw new AppError("Archive record ID is required", 400);
    const result = await restoreArchiveRecord(archiveRecordId, req.user?.userId);
    if (result.archive.resourceType === "fixture" || result.archive.resourceType === "standingAdjustment") {
      await leagueSystem.recalculateStandings(result.restored.seasonId);
      if (result.archive.resourceType === "fixture") await leagueSystem.recalculatePlayerStats(result.restored.seasonId);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
};
