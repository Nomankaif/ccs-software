import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import type { AuthedRequest, AuthUser } from "../types/http.js";

export const requireAuth = (request: AuthedRequest, response: Response, next: NextFunction) => {
  const token = request.cookies?.accessToken;
  if (!token) return response.status(401).json({ error: "Authentication required" });

  try {
    request.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    return response.status(401).json({ error: "Session expired" });
  }
};

export const requireAdmin = (request: AuthedRequest, response: Response, next: NextFunction) => {
  requireAuth(request, response, () => {
    if (request.user?.role !== "admin") {
      return response.status(403).json({ error: "Admin access required" });
    }
    next();
  });
};
