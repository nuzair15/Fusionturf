import { Request, Response, NextFunction } from "express";
import { logActivity } from "../services/notification.js";

/**
 * Records every successful, authenticated, non-GET admin request to
 * ActivityLog. Previously logActivity() was a fully-written service with
 * zero call sites anywhere in the app — the admin "Activity Logs" tab
 * rendered a table that could never contain a row. This hooks it up
 * generically at the router level instead of instrumenting each of the
 * ~40 individual admin mutation handlers by hand.
 */
export function activityLogger(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    if (!req.user) return;

    const entityId = typeof req.params?.id === "string" ? req.params.id : undefined;

    logActivity(
      req.user.userId,
      req.method,
      req.originalUrl.split("?")[0],
      entityId,
      undefined,
      req.ip,
      req.headers["user-agent"] as string | undefined
    ).catch(() => {
      // Best-effort: a failure to write an audit-log row should never
      // affect the response already sent to the client.
    });
  });

  next();
}
