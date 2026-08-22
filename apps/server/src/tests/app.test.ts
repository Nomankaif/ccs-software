import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("REST API", () => {
  it("reports the REST-only realtime strategy", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", realtime: "rest-polling" });
  });

  it("clears session cookies even when the access token is missing or expired", async () => {
    const response = await request(app).post("/api/v1/auth/logout");
    const cookies = response.headers["set-cookie"] as unknown as string[];

    expect(response.status).toBe(204);
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining("accessToken="),
        expect.stringContaining("refreshToken=")
      ])
    );
    for (const cookie of cookies) {
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    }
  });
});
