import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body;
      req.query = parsed.query;
      req.params = parsed.params;
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors?.map((e: any) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }
  };
};
