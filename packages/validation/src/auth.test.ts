import { describe, expect, it } from "vitest";
import { credentialsSchema, registrationSchema } from "./index";

const valid = { firstName: " Ada ", lastName: " Lovelace ", email: " ADA@example.com ", password: "practice123", confirmPassword: "practice123" };
describe("Student registration", () => {
  it("normalizes names and email", () => {
    expect(registrationSchema.parse(valid)).toMatchObject({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
  });
  it("rejects missing names, mismatched passwords, and role injection", () => {
    expect(registrationSchema.safeParse({ ...valid, firstName: " " }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, lastName: "" }).success).toBe(false);
    const mismatch = registrationSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues[0].path).toEqual(["confirmPassword"]);
    expect(registrationSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });
  it("requires valid email and bounded password", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "invalid" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
  });
  it("keeps login independent of registration names", () => {
    expect(credentialsSchema.parse({ email: "ADA@example.com", password: "practice123" })).toEqual({ email: "ada@example.com", password: "practice123" });
  });
});
