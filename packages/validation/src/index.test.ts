import { describe, expect, it } from "vitest";
import { caseDefinitionSchema } from "./index";

describe("caseDefinitionSchema", () => {
  it("rejects a result that references an unknown order", () => {
    const result = caseDefinitionSchema.safeParse({
      slug: "sample", title: "Sample case", specialty: "Medicine", difficulty: "Beginner", durationMinutes: 10,
      finalOrderMinutes: 2, opening: "A sufficiently detailed opening presentation.", appearance: "Stable",
      startingLocation: "Office", allowedLocations: ["Office"], history: { HPI: "History" },
      vitals: { temperature: "37 C", pulse: "80", respirations: "16", bloodPressure: "120/80", oxygenSaturation: "99%" },
      exam: { General: "Normal" }, orders: [{ id: "cbc", name: "CBC", aliases: [], category: "Laboratory" }],
      results: [{ orderId: "missing", category: "Lab Reports", value: "Normal" }],
      scoreRules: [{ id: "cbc", label: "CBC", domain: "Diagnosis", actionType: "order", match: "cbc", points: 10, rationale: "Useful" }], feedback: "Clinical feedback."
    });
    expect(result.success).toBe(false);
  });
});
