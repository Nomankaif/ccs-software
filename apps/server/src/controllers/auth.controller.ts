import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import type { AuthedRequest } from "../types/http.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

const writeSession = (response: Response, session: authService.SessionResult) => {
  response.cookie("accessToken", session.accessToken, { ...cookieOptions, maxAge: 15 * 60_000 });
  response.cookie("refreshToken", session.refreshToken, { ...cookieOptions, maxAge: 7 * 86400_000 });
};

export const register = async (request: Request, response: Response) => {
  const session = await authService.register(request.body);
  writeSession(response, session);
  response.status(201).json({ user: session.user });
};

export const login = async (request: Request, response: Response) => {
  const session = await authService.login(request.body);
  writeSession(response, session);
  response.json({ user: session.user });
};

export const getCurrentUser = (request: AuthedRequest, response: Response) => {
  response.json({ user: request.user });
};

export const logout = (_request: Request, response: Response) => {
  response.clearCookie("accessToken", { path: "/" });
  response.clearCookie("refreshToken", { path: "/" });
  response.status(204).send();
};
