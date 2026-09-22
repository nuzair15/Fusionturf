import { config } from "../config/index.js";
import { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { escapeHtml, getSeasonOverview, seasonOverviewHtml } from "../services/season-overview.js";

export const publicSeasonOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getSeasonOverview(req.params.slug);
    res.setHeader("Cache-Control", "public, max-age=60");
    if (req.path.endsWith(".html")) return res.type("html").send(seasonOverviewHtml(data));
    res.json(data);
  } catch (error) { next(error); }
};

export const publicSeasonIndex = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const seasons = await prisma.season.findMany({ where: { deletedAt: null, lifecycle: { not: "DRAFT" } }, select: { slug: true, name: true, startDate: true, endDate: true, isCurrent: true }, orderBy: { startDate: "desc" } });
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fusion League — all seasons</title></head><body><main><h1>Fusion League season archive</h1><p>Public season overviews with complete standings, results, squads, player statistics and announced awards. These pages work without JavaScript.</p><ul>${seasons.map(s => `<li><a href="/api/league/seasons/${encodeURIComponent(s.slug)}/overview.html">${escapeHtml(s.name)}</a> (${s.startDate.toISOString().slice(0,10)} – ${s.endDate.toISOString().slice(0,10)})${s.isCurrent ? " — current" : ""} · <a href="/api/league/seasons/${encodeURIComponent(s.slug)}/overview">JSON</a></li>`).join("")}</ul><a href="${escapeHtml(config.frontendUrl.replace(/\/$/, ""))}/league">Interactive league website</a></main></body></html>`);
  } catch (error) { next(error); }
};
