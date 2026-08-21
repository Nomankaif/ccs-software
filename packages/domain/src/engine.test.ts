import { describe, expect, it } from "vitest";
import { calculateScore } from "./engine";

describe("calculateScore", () => {
  it("rewards core acute chest pain management", () => {
    const report = calculateScore(
      [{ id: "1", definitionId: "aspirin", name: "Aspirin", orderedAt: 0, status: "active" }],
      [{ id: "1", type: "exam", simulatedMinute: 0, summary: "Targeted examination" }]
    );

    expect(report.total).toBeGreaterThanOrEqual(30);
    expect(report.ideal).toContain("Aspirin");
  });
});
