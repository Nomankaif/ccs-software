import type { Request } from "express";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: import("@ccs/domain").UserRole;
  sessionVersion?: number;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}
