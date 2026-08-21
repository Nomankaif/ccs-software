import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export const validateBody = (schema: ZodType) =>
  (request: Request, response: Response, next: NextFunction) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }

    request.body = parsed.data;
    next();
  };
