import type { Request } from "express";
import { AppError } from "../errors/app-error.js";

export const getRouteParam = (request: Request, name: string) => {
  const value = request.params[name];
  if (typeof value !== "string") {
    throw new AppError(400, `Invalid ${name} parameter`);
  }
  return value;
};
