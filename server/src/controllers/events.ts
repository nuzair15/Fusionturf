import type { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";

export const streamFixtureEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, version: true, updatedAt: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let lastSequence = Math.max(0, Number(req.get("Last-Event-ID") || req.query.after) || 0);
    let fixtureUpdatedAt = fixture.updatedAt.getTime();
    let closed = false;
    res.write(`event: ready\ndata: ${JSON.stringify({ fixtureId: fixture.id, version: fixture.version })}\n\n`);

    const poll = async () => {
      if (closed) return;
      const [events, current] = await Promise.all([
        prisma.matchEvent.findMany({
          where: { fixtureId: fixture.id, sequence: { gt: lastSequence } },
          orderBy: { sequence: "asc" },
          take: 100,
          select: { sequence: true, type: true, minute: true, second: true, teamIdSnapshot: true, playerProfileIdSnapshot: true, secondaryPlayerProfileIdSnapshot: true, createdAt: true },
        }),
        prisma.fixture.findFirst({ where: { id: fixture.id, deletedAt: null }, select: { status: true, version: true, homeScore: true, awayScore: true, matchClockSeconds: true, updatedAt: true } }),
      ]);
      if (!current) { res.write("event: archived\ndata: {}\n\n"); res.end(); closed = true; return; }
      for (const event of events) {
        lastSequence = event.sequence;
        res.write(`id: ${event.sequence}\nevent: match-event\ndata: ${JSON.stringify(event)}\n\n`);
      }
      if (current.updatedAt.getTime() > fixtureUpdatedAt) {
        fixtureUpdatedAt = current.updatedAt.getTime();
        res.write(`event: fixture\ndata: ${JSON.stringify(current)}\n\n`);
      } else {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }
      (res as any).flush?.();
    };

    const interval = setInterval(() => poll().catch((error) => {
      console.error("Fixture SSE poll failed", error);
      if (!closed) res.write(`event: error\ndata: ${JSON.stringify({ message: "Live update delayed" })}\n\n`);
    }), 3_000);
    interval.unref();
    const timeout = setTimeout(() => { if (!closed) res.end(); }, 30 * 60 * 1000);
    timeout.unref();
    req.on("close", () => { closed = true; clearInterval(interval); clearTimeout(timeout); });
  } catch (error) { next(error); }
};
