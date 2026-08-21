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

    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("accessToken="),
        expect.stringContaining("refreshToken=")
      ])
    );
  });
});
