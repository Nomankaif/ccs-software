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

  it("validates case-specific order behavior and clinical state references", () => {
    const result = caseDefinitionSchema.safeParse({
      slug: "response-case", title: "Response case", specialty: "Medicine", difficulty: "Beginner", durationMinutes: 10,
      finalOrderMinutes: 2, opening: "A sufficiently detailed opening presentation.", appearance: "Unwell",
      startingLocation: "Emergency Department", allowedLocations: ["Emergency Department"], history: { HPI: "History" },
      vitals: { temperature: "37 C", pulse: "110", respirations: "18", bloodPressure: "100/60", oxygenSaturation: "99%" },
      exam: { General: "Dry" }, orders: [{ id: "fluids", name: "IV fluids", aliases: [], category: "Medication" }],
      initialClinicalStateId: "unwell",
      clinicalStates: [
        { id: "unwell" },
        { id: "improved", vitals: { temperature: "37 C", pulse: "85", respirations: "16", bloodPressure: "115/70", oxygenSaturation: "99%" } }
      ],
      orderBehaviors: [{ orderId: "fluids", classification: "beneficial", responseDelayMinutes: 30, targetStateId: "improved" }],
      results: [],
      scoreRules: [{
        id: "fluids", label: "Give fluids", domain: "Therapy", actionType: "order", match: "fluids", points: 10,
        rationale: "Treat volume depletion",
        timing: { fullCreditByMinute: 10, partialCreditByMinute: 30, partialCreditPoints: 5 },
        sequence: { requiredPriorActions: [{ actionType: "exam", match: "General" }], pointsIfViolated: 0 }
      }],
      feedback: "Clinical feedback."
    });
    expect(result.success).toBe(true);
  });

  it("validates qualifier-specific behaviors and rejects unknown qualifier values", () => {
    const base = {
      slug: "qualifier-case", title: "Qualifier case", specialty: "Medicine", difficulty: "Beginner", durationMinutes: 10,
      finalOrderMinutes: 2, opening: "A sufficiently detailed opening presentation.", appearance: "Unwell",
      startingLocation: "Emergency Department", allowedLocations: ["Emergency Department"], history: { HPI: "History" },
      vitals: { temperature: "37 C", pulse: "110", respirations: "18", bloodPressure: "100/60", oxygenSaturation: "99%" },
      exam: { General: "Unwell" },
      orders: [{ id: "dextrose", name: "IV dextrose", aliases: [], category: "Medication", route: ["IV"], dose: ["12.5 g", "25 g"] }],
      clinicalStates: [{ id: "recovered" }],
      results: [],
      scoreRules: [{
        id: "dextrose", label: "Give dextrose", domain: "Therapy", actionType: "order", match: "dextrose", points: 20,
        qualifierConditions: { route: ["IV"], dose: ["25 g"] }, pointsIfQualifierMismatch: 10, rationale: "Treat hypoglycemia"
      }],
      feedback: "Clinical feedback."
    } as const;

    expect(caseDefinitionSchema.safeParse({
      ...base,
      orderBehaviors: [
        { orderId: "dextrose", qualifierConditions: { dose: ["25 g"] }, classification: "beneficial", targetStateId: "recovered" },
        { orderId: "dextrose", classification: "neutral" }
      ]
    }).success).toBe(true);

    expect(caseDefinitionSchema.safeParse({
      ...base,
      orderBehaviors: [
        { orderId: "dextrose", qualifierConditions: { dose: ["50 g"] }, classification: "beneficial", targetStateId: "recovered" }
      ]
    }).success).toBe(false);

    expect(caseDefinitionSchema.safeParse({
      ...base,
      orderBehaviors: [{
        orderId: "dextrose",
        classification: "beneficial",
        schedule: { intervalMinutes: 15, maximumOccurrences: 3, repeatResults: true }
      }]
    }).success).toBe(false);

    expect(caseDefinitionSchema.safeParse({
      ...base,
      endConditions: [{
        id: "recovered",
        conditions: { clinicalStateId: "recovered" },
        reason: "Patient recovered"
      }]
    }).success).toBe(true);

    expect(caseDefinitionSchema.safeParse({
      ...base,
      endConditions: [{
        id: "unknown-state",
        conditions: { clinicalStateId: "missing-state" },
        reason: "Unknown state"
      }]
    }).success).toBe(false);

    expect(caseDefinitionSchema.safeParse({
      ...base,
      testScenarios: [{
        id: "ideal",
        name: "Ideal pathway",
        kind: "ideal",
        actions: [{ type: "PERFORM_EXAM", sections: ["General"] }, { type: "PLACE_ORDER", orderId: "dextrose", route: "IV", dose: "25 g" }],
        expected: { minimumScore: 20, maximumScore: 20, clinicalStateId: "recovered" }
      }]
    }).success).toBe(true);

    expect(caseDefinitionSchema.safeParse({
      ...base,
      testScenarios: [{
        id: "broken",
        name: "Broken pathway",
        kind: "custom",
        actions: [{ type: "PLACE_ORDER", orderId: "unknown-order" }],
        expected: { minimumScore: 0, maximumScore: 100 }
      }]
    }).success).toBe(false);
  });
});
