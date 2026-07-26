import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.statusCode >= 500 && { message: err.message }),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      message: err.message,
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Resource already exists", message: err.message, code: err.code, meta: err.meta });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Invalid reference: related record does not exist", message: err.message, code: err.code, meta: err.meta });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Resource not found", message: err.message, code: err.code, meta: err.meta });
    }
  }

  console.error("Unhandled error:", err);

  return res.status(500).json({
    error: "Internal server error",
    message: err.message,
    ...(err instanceof Prisma.PrismaClientKnownRequestError && { code: err.code, meta: err.meta }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
};
