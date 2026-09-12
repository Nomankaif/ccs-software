import { readFileSync } from "node:fs";
import { caseDefinitionSchema, type CaseDefinitionInput } from "@ccs/validation";
import { describe, expect, it } from "vitest";
import { analyzeCaseDefinition, evaluateCaseQuality } from "./case-quality.service.js";

const vitals = {
  temperature: "37.0 C",
  pulse: "90/min",
  respirations: "16/min",
  bloodPressure: "120/80 mm Hg",
  oxygenSaturation: "99% on room air"
};

const validDefinition = (): CaseDefinitionInput => ({
  slug: "quality-test",
  title: "Quality validation test",
  specialty: "Internal Medicine",
  difficulty: "Beginner",
  durationMinutes: 15,
  finalOrderMinutes: 2,
  opening: "A synthetic patient presents for case quality validation testing.",
  appearance: "The patient appears mildly ill.",
  startingLocation: "Emergency Department",
  allowedLocations: ["Emergency Department"],
  history: { HPI: "Synthetic validation history." },
  vitals,
  exam: { General: "Mild illness." },
  initialClinicalStateId: "initial",
  clinicalStates: [{ id: "initial", vitals }, { id: "recovered", appearance: "Recovered." }],
  orders: [{ id: "therapy", name: "Synthetic therapy", aliases: [], category: "Medication", resultDelayMinutes: 5 }],
  orderBehaviors: [{ orderId: "therapy", classification: "beneficial", processingMinutes: 5, responseDelayMinutes: 5, targetStateId: "recovered" }],
  results: [{ orderId: "therapy", category: "Treatment Record", value: "Therapy completed." }],
  endConditions: [{ id: "recovered", conditions: { clinicalStateId: "recovered" }, reason: "The patient recovered." }],
  scoreRules: [{ id: "therapy", label: "Provide therapy", domain: "Therapy", actionType: "order", match: "therapy", points: 100, rationale: "Treats the patient." }],
  testScenarios: [{
    id: "ideal",
    name: "Ideal treatment pathway",
    kind: "ideal",
    actions: [{ type: "PLACE_ORDER", orderId: "therapy" }, { type: "ADVANCE_TIME", minutes: 5 }, { type: "FINISH_CASE" }],
    expected: { minimumScore: 100, maximumScore: 100, status: "completed", clinicalStateId: "recovered", resultOrderIds: ["therapy"] }
  }],
  feedback: "Synthetic clinician feedback for quality validation testing."
});

describe("case publication readiness", () => {
  it("executes an ideal golden scenario through the production engine", () => {
    const report = evaluateCaseQuality(validDefinition());
    expect(report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(report.scenarios[0]).toMatchObject({ passed: true, score: 100, clinicalStateId: "recovered" });
  });

  it("detects unreachable states, missing result timing, end conditions, and ideal scenarios", () => {
    const definition = validDefinition();
    definition.clinicalStates?.push({ id: "orphan", appearance: "Unreachable." });
    definition.orders[0].resultDelayMinutes = undefined;
    definition.orderBehaviors = [];
    definition.endConditions = [];
    definition.testScenarios = [];
    const codes = analyzeCaseDefinition(definition).issues.map((item) => item.code);
    expect(codes).toContain("UNREACHABLE_STATE");
    expect(codes).toContain("RESULT_TIMING_MISSING");
    expect(codes).toContain("END_CONDITION_MISSING");
    expect(codes).toContain("IDEAL_SCENARIO_MISSING");
  });

  it("blocks unavoidable treatment prerequisite cycles", () => {
    const definition = validDefinition();
    definition.orders.push({ id: "access", name: "Synthetic access", aliases: [], category: "Procedure" });
    definition.orderBehaviors = [
      { orderId: "therapy", classification: "beneficial", treatmentPrerequisites: { requiredOrderIds: ["access"] } },
      { orderId: "access", classification: "neutral", treatmentPrerequisites: { requiredOrderIds: ["therapy"] } }
    ];
    expect(analyzeCaseDefinition(definition).issues.map((item) => item.code)).toContain("PREREQUISITE_CYCLE");
  });

  it("passes all saved hypoglycemia regression scenarios", () => {
    const definition = caseDefinitionSchema.parse(JSON.parse(readFileSync(
      new URL("../../../../sample-cases/adult-hypoglycemia-p1-test.json", import.meta.url),
      "utf8"
    )));
    const report = evaluateCaseQuality(definition);
    expect(report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(report.scenarios.map((scenario) => ({ id: scenario.id, passed: scenario.passed, failures: scenario.failures }))).toEqual(
      report.scenarios.map((scenario) => ({ id: scenario.id, passed: true, failures: [] }))
    );
  });
});
