import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode: number = 500, code = "APPLICATION_ERROR", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendError = (req: Request, res: Response, status: number, code: string, message: string, details?: unknown) => {
  const v2 = (req.originalUrl || req.url || "").startsWith("/api/v2/");
  return res.status(status).json(v2
    ? { code, message, ...(details !== undefined ? { details } : {}), requestId: res.locals.requestId }
    : { error: message, ...(details !== undefined ? { details } : {}), requestId: res.locals.requestId });
};

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  const respond = (status: number, code: string, message: string, details?: unknown) => sendError(req, res, status, code, message, details);
  if (err instanceof AppError) {
    return respond(err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return respond(400, "VALIDATION_ERROR", "Validation error", err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return respond(409, "RESOURCE_EXISTS", "Resource already exists");
    }
    if (err.code === "P2003") {
      return respond(400, "INVALID_REFERENCE", "Invalid reference: related record does not exist");
    }
    if (err.code === "P2025") {
      return respond(404, "NOT_FOUND", "Resource not found");
    }
  }

  console.error(`Unhandled error [${res.locals.requestId || "unknown"}] ${req.method} ${req.originalUrl}:`, err);

  return respond(500, "INTERNAL_ERROR", "Internal server error");
};

export const notFoundHandler = (req: Request, res: Response) => {
  sendError(req, res, 404, "ROUTE_NOT_FOUND", "Route not found", { method: req.method, path: req.originalUrl });
};
