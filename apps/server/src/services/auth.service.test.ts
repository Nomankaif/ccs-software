import { afterEach, describe, expect, it, vi } from "vitest";
import argon2 from "argon2";
import { UserModel, RefreshSessionModel } from "../models/index.js";
import { register, login } from "./auth.service.js";

afterEach(() => vi.restoreAllMocks());
describe("Student account flow", () => {
  it("stores names and a hashed password, always as a student", async () => {
    vi.spyOn(UserModel, "exists").mockResolvedValue(null);
    vi.spyOn(argon2, "hash").mockResolvedValue("hashed-password");
    const create = vi.spyOn(UserModel, "create").mockResolvedValue({ id: "123", email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" } as never);
    vi.spyOn(RefreshSessionModel, "create").mockResolvedValue({} as never);
    const session = await register({ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", password: "practice123" });
    expect(create).toHaveBeenCalledWith({ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", passwordHash: "hashed-password", role: "student" });
    expect(session.user).toMatchObject({ firstName: "Ada", lastName: "Lovelace", role: "student" });
    expect(session.user).not.toHaveProperty("passwordHash");
    expect(session.accessToken).toBeTruthy();
  });
  it("rejects duplicate accounts including concurrent creation", async () => {
    const exists = vi.spyOn(UserModel, "exists").mockResolvedValue({ _id: "123" } as never);
    const input = { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", password: "practice123" };
    await expect(register(input)).rejects.toMatchObject({ statusCode: 409 });
    exists.mockResolvedValue(null);
    vi.spyOn(argon2, "hash").mockResolvedValue("hash");
    vi.spyOn(UserModel, "create").mockRejectedValue({ code: 11000 });
    await expect(register(input)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects invalid login without creating a session", async () => {
    vi.spyOn(UserModel, "findOne").mockResolvedValue({ passwordHash: "hash" } as never);
    vi.spyOn(argon2, "verify").mockResolvedValue(false);
    const sessions = vi.spyOn(RefreshSessionModel, "create");
    await expect(login({ email: "ada@example.com", password: "incorrect" })).rejects.toMatchObject({ statusCode: 401 });
    expect(sessions).not.toHaveBeenCalled();
  });
});
