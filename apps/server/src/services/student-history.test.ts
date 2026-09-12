import { describe, expect, it, vi } from "vitest";
import { AttemptModel } from "../models/attempt.model.js";
import { listAttempts } from "./attempt.service.js";

describe("Student attempt history", () => {
  it("scopes the query to the user and excludes hidden case data and active scores", async () => {
    const lean = vi.fn().mockResolvedValue([
      { _id: "a", caseVersionId: "case", status: "active", caseSnapshot: { title: "Test", specialty: "Medicine", version: 1, scoreRules: ["secret"] }, scoreReport: { total: 50 }, simulatedMinute: 3 },
      { _id: "b", caseVersionId: "case", status: "completed", caseSnapshot: { title: "Test" }, scoreReport: { total: 0, domains: [] }, simulatedMinute: 10 }
    ]);
    const select = vi.fn().mockReturnValue({ lean });
    const sort = vi.fn().mockReturnValue({ select });
    const find = vi.spyOn(AttemptModel, "find").mockReturnValue({ sort } as never);
    try {
      const result = await listAttempts("student-1");
      expect(find).toHaveBeenCalledWith({ userId: "student-1" });
      expect(result[0].scoreReport).toBeNull();
      expect(result[0].caseSnapshot).not.toHaveProperty("scoreRules");
      expect(result[1].scoreReport.total).toBe(0);
      expect(select.mock.calls[0][0]).not.toContain("caseSnapshot.scoreRules");
    } finally { find.mockRestore(); }
  });
});
