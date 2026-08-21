import argon2 from "argon2";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { RefreshSessionModel, UserModel } from "../models/index.js";
import type { AuthUser } from "../types/http.js";

interface Credentials {
  email: string;
  password: string;
}

export interface SessionResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const createSession = async (user: AuthUser): Promise<SessionResult> => {
  const accessToken = jwt.sign(user, config.jwtSecret, { expiresIn: "15m" });
  const refreshToken = crypto.randomBytes(48).toString("base64url");

  await RefreshSessionModel.create({
    userId: user.id,
    tokenHash: await argon2.hash(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 86400_000)
  });

  return { user, accessToken, refreshToken };
};

export const register = async ({ email, password }: Credentials) => {
  if (await UserModel.exists({ email })) {
    throw new AppError(409, "Email already registered");
  }

  const user = await UserModel.create({
    email,
    passwordHash: await argon2.hash(password),
    role: "student"
  });

  return createSession({ id: user.id, email: user.email, role: "student" });
};

export const login = async ({ email, password }: Credentials) => {
  const user = await UserModel.findOne({ email });
  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    throw new AppError(401, "Invalid credentials");
  }

  return createSession({
    id: user.id,
    email: user.email,
    role: user.role as AuthUser["role"]
  });
};
