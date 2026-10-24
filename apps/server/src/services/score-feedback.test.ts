import { describe, expect, it } from "vitest";
import { scoreAttempt } from "./attempt.service.js";

describe("Detailed score feedback", () => {
  it("explains earned points, penalties, omissions and placeholder labels", () => {
    const report = scoreAttempt({
      caseSnapshot: {
        orders: [{ id: "cxr", name: "Chest X-ray" }, { id: "saline", name: "Sodium chloride" }],
        scoreRules: [
          { id: "positive", label: "New score rule", domain: "Diagnosis", actionType: "order", match: "cxr", points: 100, rationale: "Case-specific diagnostic rationale" },
          { id: "negative", label: "New score rule", domain: "Treatment", actionType: "order", match: "saline", points: -59, rationale: "Explain why this matters." },
          { id: "exam", label: "Examination", domain: "Diagnosis", actionType: "exam", match: "General Appearance", points: 10 },
          { id: "avoid", label: "Avoid discharge", domain: "Disposition", actionType: "location", match: "Home", points: -10 }
        ], feedback: "Review your actions."
      }, orders: [], actions: [
        { type: "order", match: "cxr", simulatedMinute: 0 },
        { type: "order", match: "saline", simulatedMinute: 15 }
      ]
    } as any);
    expect(report.total).toBe(41);
    expect(report.rawTotal).toBe(41);
    expect(report.details[0]).toMatchObject({ label: "Order: Chest X-ray", awardedPoints: 100, status: "met", simulatedMinute: 0 });
    expect(report.details[1]).toMatchObject({ label: "Order: Sodium chloride", awardedPoints: -59, status: "penalty", simulatedMinute: 15, rationale: undefined });
    expect(report.details[1].explanation).toContain("configured by the case author");
    expect(report.details[2]).toMatchObject({ status: "missed", awardedPoints: 0, possiblePoints: 10 });
    expect(report.details[3]).toMatchObject({ status: "avoided", awardedPoints: 0 });
  });
});
