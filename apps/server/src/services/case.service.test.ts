import { describe, expect, it } from "vitest";
import { canIndependentlyReview, caseEditMode, latestCases, serializeStudentCaseSummary } from "./case.service.js";

describe("case review workflow", () => {
  it("edits the same case regardless of its previous workflow status", () => {
    expect(caseEditMode("draft")).toBe("update");
    expect(caseEditMode("changes_requested")).toBe("update");
    expect(caseEditMode("in_review")).toBe("update");
    expect(caseEditMode("approved")).toBe("update");
    expect(caseEditMode("published")).toBe("update");
    expect(caseEditMode("retired")).toBe("update");
  });
  it("shows one row per case when legacy versions exist", () => {
    const entries = [{ slug: "a", version: 1 }, { slug: "b", version: 1 }, { slug: "a", version: 3 }, { slug: "a", version: 2 }];
    expect(latestCases(entries)).toEqual([entries[2], entries[1]]);
  });

  it("requires the reviewer to be different from the last editor", () => {
    expect(canIndependentlyReview("admin-1", "admin-1")).toBe(false);
    expect(canIndependentlyReview("admin-1", "admin-2")).toBe(true);
  });
});

describe("student case answer protection", () => {
  it("returns only case-library metadata and excludes all answer-bearing fields", () => {
    const summary = serializeStudentCaseSummary({
      _id: { toString: () => "case-123" },
      version: 4,
      definition: {
        slug: "protected-case",
        title: "Protected case",
        specialty: "Emergency Medicine",
        difficulty: "Beginner",
        durationMinutes: 10,
        finalOrderMinutes: 2,
        opening: "A synthetic patient presents for testing.",
        orders: [{ id: "answer-order" }],
        orderBehaviors: [{ orderId: "answer-order", classification: "beneficial" }],
        results: [{ orderId: "answer-order", value: "Secret result" }],
        clinicalStates: [{ id: "secret-state" }],
        transitionRules: [{ id: "secret-transition" }],
        scoreRules: [{ match: "answer-order", points: 100 }],
        testScenarios: [{ id: "secret-scenario", actions: [{ type: "PLACE_ORDER", orderId: "answer-order" }] }],
        feedback: "Secret feedback"
      }
    });

    expect(summary).toEqual({
      id: "case-123",
      version: 4,
      slug: "protected-case",
      title: "Protected case",
      specialty: "Emergency Medicine",
      difficulty: "Beginner",
      durationMinutes: 10,
      finalOrderMinutes: 2,
      opening: "A synthetic patient presents for testing."
    });
    const responseBody = JSON.stringify(summary);
    for (const secret of [
      "orders",
      "orderBehaviors",
      "results",
      "clinicalStates",
      "transitionRules",
      "scoreRules",
      "testScenarios",
      "feedback",
      "Secret result",
      "answer-order"
    ]) {
      expect(responseBody).not.toContain(secret);
    }
  });
});
