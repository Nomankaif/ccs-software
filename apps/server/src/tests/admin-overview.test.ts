import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { app } from "../app.js";
import * as service from "../services/admin-overview.service.js";
import { AuditEventModel } from "../models/audit-event.model.js";
import { UserModel } from "../models/user.model.js";

vi.mock("../services/admin-overview.service.js", () => ({
  listUsers: vi.fn(), createUser: vi.fn(), analytics: vi.fn(), auditLog: vi.fn(), changeEmployee: vi.fn()
}));
const ids: Record<string, string> = { admin: "507f1f77bcf86cd799439011", subadmin: "507f1f77bcf86cd799439012", writer: "507f1f77bcf86cd799439013", student: "507f1f77bcf86cd799439014" };
const cookie = (role: string) => `accessToken=${jwt.sign({ id: ids[role], email: "admin@example.com", role }, config.jwtSecret)}`;

describe("Admin operations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(UserModel, "findById").mockImplementation((id: any) => Promise.resolve({ role: Object.keys(ids).find(role => ids[role] === id), sessionVersion: 0 }) as never);
  });
  it.each(["users", "employees", "analytics", "audit"])("protects %s from anonymous and student access", async path => {
    expect((await request(app).get(`/api/v1/admin/${path}`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/admin/${path}`).set("Cookie", cookie("student"))).status).toBe(403);
    expect((await request(app).get(`/api/v1/admin/${path}`).set("Cookie", cookie("writer"))).status).toBe(403);
  });
  it("keeps students and employees separate", async () => {
    vi.mocked(service.listUsers).mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 25 });
    expect((await request(app).get("/api/v1/admin/users?role=admin").set("Cookie", cookie("subadmin"))).status).toBe(200);
    expect(service.listUsers).toHaveBeenLastCalledWith("", "student", 1);
    expect((await request(app).get("/api/v1/admin/employees").set("Cookie", cookie("subadmin"))).status).toBe(200);
    expect(service.listUsers).toHaveBeenLastCalledWith("", "employees", 1);
  });
  it.each(["subadmin", "writer"])("allows subadmins to provision %s accounts", async role => {
    const write = vi.spyOn(AuditEventModel, "create").mockResolvedValue({} as never);
    vi.mocked(service.createUser).mockResolvedValue({ _id: "employee", email: "staff@example.com", role: role as "writer", createdAt: new Date() });
    const result = await request(app).post("/api/v1/admin/employees").set("Cookie", cookie("subadmin"))
      .send({ email: "STAFF@example.com", password: "test1234", role });
    expect(result.status).toBe(201);
    expect(service.createUser).toHaveBeenCalledWith({ email: "staff@example.com", password: "test1234", role });
    write.mockRestore();
  });
  it("blocks role escalation and writer publication", async () => {
    expect((await request(app).post("/api/v1/admin/employees").set("Cookie", cookie("admin"))
      .send({ email: "staff@example.com", password: "test123", role: "writer" })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/admin/employees/${ids.subadmin}/status`).set("Cookie", cookie("writer")).send({ paused: true })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/admin/employees/${ids.subadmin}`).set("Cookie", cookie("writer"))).status).toBe(403);
    expect((await request(app).post("/api/v1/admin/users").set("Cookie", cookie("admin"))
      .send({ email: "staff@example.com", password: "test-password-123", role: "subadmin" })).status).toBe(400);
    expect((await request(app).post("/api/v1/admin/employees").set("Cookie", cookie("writer"))
      .send({ email: "staff@example.com", password: "test-password-123", role: "subadmin" })).status).toBe(403);
    for (const action of ["publish", "retire"]) expect((await request(app).post(`/api/v1/admin/cases/example/${action}`).set("Cookie", cookie("writer"))).status).toBe(403);
    expect((await request(app).delete("/api/v1/admin/cases/example").set("Cookie", cookie("writer"))).status).toBe(403);
  });
  it("allows administrators to pause, resume and delete employees", async () => {
    const write = vi.spyOn(AuditEventModel, "create").mockResolvedValue({} as never);
    vi.mocked(service.changeEmployee).mockResolvedValue({ _id: ids.writer, email: "writer@example.com", role: "writer", paused: true, createdAt: new Date() });
    for (const paused of [true, false]) {
      expect((await request(app).patch(`/api/v1/admin/employees/${ids.writer}/status`).set("Cookie", cookie("subadmin")).send({ paused })).status).toBe(200);
      expect(service.changeEmployee).toHaveBeenLastCalledWith(ids.writer, ids.subadmin, paused ? "pause" : "resume");
    }
    expect((await request(app).patch(`/api/v1/admin/employees/${ids.writer}/status`).set("Cookie", cookie("admin")).send({ paused: "yes" })).status).toBe(400);
    expect((await request(app).delete(`/api/v1/admin/employees/${ids.writer}`).set("Cookie", cookie("admin"))).status).toBe(204);
    expect(service.changeEmployee).toHaveBeenLastCalledWith(ids.writer, ids.admin, "delete");
    write.mockRestore();
  });
  it("passes validated pagination and filters to the user service", async () => {
    vi.mocked(service.listUsers).mockResolvedValue({ users: [], total: 0, page: 2, pageSize: 25 });
    const result = await request(app).get("/api/v1/admin/users?q=hello&role=student&page=2").set("Cookie", cookie("admin"));
    expect(result.status).toBe(200);
    expect(service.listUsers).toHaveBeenCalledWith("hello", "student", 2);
    expect((await request(app).get("/api/v1/admin/users?page=-1").set("Cookie", cookie("admin"))).status).toBe(400);
  });
  it("rejects invalid credentials before user creation", async () => {
    const result = await request(app).post("/api/v1/admin/users").set("Cookie", cookie("admin"))
      .send({ email: "invalid", password: "short", role: "admin" });
    expect(result.status).toBe(400);
    expect(service.createUser).not.toHaveBeenCalled();
  });
  it("creates an account and audits metadata without credentials", async () => {
    const write = vi.spyOn(AuditEventModel, "create").mockResolvedValue({} as never);
    vi.mocked(service.createUser).mockResolvedValue({ _id: "user", email: "new@example.com", role: "student", createdAt: new Date() });
    const result = await request(app).post("/api/v1/admin/users").set("Cookie", cookie("admin"))
      .send({ email: "NEW@example.com", password: "test-password-123", role: "student" });
    expect(result.status).toBe(201);
    expect(service.createUser).toHaveBeenCalledWith({ email: "new@example.com", password: "test-password-123", role: "student" });
    expect(write).toHaveBeenCalledWith({ actorId: "507f1f77bcf86cd799439011", action: "POST", resource: "/api/v1/admin/users", status: 201 });
    expect(JSON.stringify(result.body)).not.toContain("password");
    write.mockRestore();
  });
  it("validates analytics periods and returns audit pages", async () => {
    expect((await request(app).get("/api/v1/admin/analytics?days=9999").set("Cookie", cookie("admin"))).status).toBe(400);
    vi.mocked(service.analytics).mockResolvedValue({ days: 7, users: 0, publishedCases: 0, statuses: [], cases: [] });
    expect((await request(app).get("/api/v1/admin/analytics?days=7").set("Cookie", cookie("admin"))).status).toBe(200);
    expect(service.analytics).toHaveBeenCalledWith(7);
    vi.mocked(service.auditLog).mockResolvedValue({ events: [], total: 0, page: 1, pageSize: 25 });
    expect((await request(app).get("/api/v1/admin/audit?q=review").set("Cookie", cookie("admin"))).status).toBe(200);
    expect(service.auditLog).toHaveBeenCalledWith("review", 1);
  });
});
