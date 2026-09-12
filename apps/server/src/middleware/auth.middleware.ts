import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { defineAbility, type PermissionAction, type PermissionSubject } from "@ccs/domain";
import { config } from "../config/env.js";
import type { AuthedRequest, AuthUser } from "../types/http.js";
import { UserModel } from "../models/user.model.js";

export const requireAuth = async (request: AuthedRequest, response: Response, next: NextFunction) => {
  const token = request.cookies?.accessToken;
  if (!token) return response.status(401).json({ error: "Authentication required" });

  try {
    request.user = jwt.verify(token, config.jwtSecret) as AuthUser;
  } catch {
    return response.status(401).json({ error: "Session expired" });
  }
  try {
    if (request.user.role !== "student") {
      const account = await UserModel.findById(request.user.id);
      if (!account || account.deletedAt || account.paused || (account.sessionVersion ?? 0) !== (request.user.sessionVersion ?? 0)) {
        return response.status(401).json({ error: "Session revoked. Please sign in again or contact your administrator." });
      }
      request.user.role = account.role as AuthUser["role"];
    }
    next();
  } catch (error) { next(error); }
};

export const requirePermission = (action: PermissionAction, resource: PermissionSubject) => (request: AuthedRequest, response: Response, next: NextFunction) => {
  return requireAuth(request, response, () => {
    if (!defineAbility(request.user?.role).can(action, resource)) {
      return response.status(403).json({ error: "You do not have permission for this action" });
    }
    next();
  });
};
export const requireAdmin = requirePermission("manage", "all");
