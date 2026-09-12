import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import { UserModel, RefreshSessionModel } from "../models/index.js";
import { changeEmployee } from "./admin-overview.service.js";
import { login } from "./auth.service.js";
import { config } from "../config/env.js";
import { app } from "../app.js";

const id = "507f1f77bcf86cd799439011";
const actor = "507f1f77bcf86cd799439012";
afterEach(() => vi.restoreAllMocks());
describe("Employee access lifecycle", () => {
  it.each(["pause", "resume", "delete"] as const)("%s updates access and revokes refresh sessions", async action => {
    const update = vi.spyOn(UserModel, "findOneAndUpdate").mockResolvedValue({ id, role: "writer" } as never);
    const revoke = vi.spyOn(RefreshSessionModel, "deleteMany").mockResolvedValue({} as never);
    await changeEmployee(id, actor, action);
    expect(update).toHaveBeenCalledWith({ _id: id, role: { $in: ["subadmin", "writer"] }, deletedAt: null }, {
      $set: action === "delete" ? { deletedAt: expect.any(Date), paused: true } : { paused: action === "pause" },
      $inc: { sessionVersion: 1 }
    }, { new: true });
    expect(revoke).toHaveBeenCalledWith({ userId: id });
  });
  it("protects self, administrators, students and missing accounts", async () => {
    const update = vi.spyOn(UserModel, "findOneAndUpdate").mockResolvedValue(null);
    await expect(changeEmployee(id, id, "delete")).rejects.toMatchObject({ statusCode: 400 });
    expect(update).not.toHaveBeenCalled();
    await expect(changeEmployee(id, actor, "pause")).rejects.toMatchObject({ statusCode: 404 });
    await expect(changeEmployee("invalid", actor, "pause")).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([{ paused: true }, { deletedAt: new Date() }])("prevents unavailable employees from logging in", async state => {
    vi.spyOn(UserModel, "findOne").mockResolvedValue({ passwordHash: "hash", ...state } as never);
    vi.spyOn(argon2, "verify").mockResolvedValue(true);
    const sessions = vi.spyOn(RefreshSessionModel, "create");
    await expect(login({ email: "staff@example.com", password: "password12345" })).rejects.toMatchObject({ statusCode: 403 });
    expect(sessions).not.toHaveBeenCalled();
  });
  it.each([null, { paused: true }, { deletedAt: new Date() }, { sessionVersion: 1 }])("rejects a revoked employee session", async state => {
    vi.spyOn(UserModel, "findById").mockResolvedValue(state as never);
    const token = jwt.sign({ id, role: "writer", sessionVersion: 0 }, config.jwtSecret);
    expect((await request(app).get("/api/v1/auth/me").set("Cookie", `accessToken=${token}`)).status).toBe(401);
  });
  it("requires a fresh login after resume", async () => {
    vi.spyOn(UserModel, "findById").mockResolvedValue({ role: "writer", paused: false, sessionVersion: 2 } as never);
    const token = jwt.sign({ id, role: "writer", sessionVersion: 2 }, config.jwtSecret);
    expect((await request(app).get("/api/v1/auth/me").set("Cookie", `accessToken=${token}`)).status).toBe(200);
  });
});
