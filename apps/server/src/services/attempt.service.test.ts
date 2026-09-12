import { describe, expect, it } from "vitest";
import {
  activateBlockedTreatmentResponses,
  discontinuePlacedOrder,
  evaluateCaseEndConditions,
  mergeSearchableOrders,
  previewCaseDefinition,
  resolveCaseResultValue,
  resolveDueEvents,
  scheduleOrderClinicalResponse,
  scoreAttempt,
  selectOrderBehavior,
  selectAttemptOrder,
  serializeStudentPlacedOrder,
  toStudentCase,
  updateDeadline
} from "./attempt.service.js";

describe("admin case preview", () => {
  it("replays actions through the clinical engine without a persisted attempt", () => {
    const vitals = {
      temperature: "37.0 C",
      pulse: "88/min",
      respirations: "16/min",
      bloodPressure: "118/76 mm Hg",
      oxygenSaturation: "99% on room air"
    };
    const preview = previewCaseDefinition({
      slug: "preview-test",
      title: "Preview engine test",
      specialty: "Internal Medicine",
      difficulty: "Beginner",
      durationMinutes: 15,
      finalOrderMinutes: 2,
      opening: "A synthetic patient presents for an administrative preview test.",
      appearance: "The patient is awake.",
      startingLocation: "Emergency Department",
      allowedLocations: ["Emergency Department"],
      history: { HPI: "Synthetic history." },
      vitals,
      exam: { General: "Awake." },
      orders: [{ id: "test-lab", name: "Test laboratory", aliases: [], category: "Laboratory", resultDelayMinutes: 5 }],
      initialClinicalStateId: "initial",
      clinicalStates: [{ id: "initial", vitals }, { id: "improved", appearance: "The patient improves." }],
      orderBehaviors: [{ orderId: "test-lab", classification: "beneficial", processingMinutes: 5, responseDelayMinutes: 5, targetStateId: "improved" }],
      results: [{ orderId: "test-lab", category: "Lab Reports", value: "Normal" }],
      scoreRules: [{ id: "test-lab-score", label: "Order test laboratory", domain: "Diagnosis", actionType: "order", match: "test-lab", points: 10, rationale: "Validates preview scoring." }],
      feedback: "Administrative preview feedback for this synthetic test case."
    }, [
      { type: "PLACE_ORDER", orderId: "test-lab" },
      { type: "ADVANCE_TIME", minutes: 5 }
    ]);

    expect(preview.attemptId).toBe("admin-preview");
    expect(preview.simulatedMinute).toBe(5);
    expect(preview.results).toHaveLength(1);
    expect(preview.currentClinicalStateId).toBe("improved");
    expect(preview.scoreReport.total).toBe(10);
  });
});

const cbcSnapshot = {
  id: "cbc",
  name: "CBC with differential",
  aliases: ["complete blood count"],
  category: "Laboratory" as const,
  resultDelayMinutes: 15
};

describe("attempt order access", () => {
  it("merges global search results while preserving frozen case definitions", () => {
    const matches = mergeSearchableOrders(
      [cbcSnapshot],
      [
        { ...cbcSnapshot, name: "Renamed CBC", resultDelayMinutes: 90 },
        {
          id: "cmp",
          name: "Comprehensive metabolic panel",
          aliases: ["chemistry panel"],
          category: "Laboratory"
        }
      ],
      "c"
    );

    expect(matches.map((order) => order.id)).toEqual(["cbc", "cmp"]);
    expect(matches.find((order) => order.id === "cbc")?.name).toBe("CBC with differential");
    expect(matches.find((order) => order.id === "cbc")?.resultDelayMinutes).toBe(15);
  });

  it("accepts an active global order that is not configured in the case", () => {
    const globalOrder = {
      id: "ct-abdomen",
      name: "CT abdomen",
      aliases: [],
      category: "Imaging" as const
    };

    expect(selectAttemptOrder([cbcSnapshot], globalOrder, globalOrder.id)).toEqual(globalOrder);
  });

  it("rejects an order that is neither configured nor active in the catalog", () => {
    expect(selectAttemptOrder([cbcSnapshot], null, "inactive-order")).toBeNull();
  });

  it("does not expose case answers in the student attempt payload", () => {
    const studentCase = toStudentCase({
      slug: "hidden-answer-test",
      title: "Hidden answer test",
      specialty: "Internal Medicine",
      difficulty: "Beginner",
      durationMinutes: 10,
      finalOrderMinutes: 2,
      opening: "A synthetic patient presents for a software validation encounter.",
      appearance: "Stable",
      startingLocation: "Office",
      allowedLocations: ["Office"],
      history: { HPI: "Testing" },
      vitals: {
        temperature: "37 C",
        pulse: "80/min",
        respirations: "16/min",
        bloodPressure: "120/80 mm Hg",
        oxygenSaturation: "98%"
      },
      exam: { General: "Normal" },
      orders: [cbcSnapshot],
      results: [{ orderId: "cbc", category: "Lab Reports", value: "Secret result" }],
      scoreRules: [{
        id: "secret",
        label: "Secret answer",
        domain: "Diagnosis",
        actionType: "order",
        match: "cbc",
        points: 10,
        rationale: "Secret rationale"
      }],
      feedback: "Secret clinician feedback"
    });

    expect(studentCase).not.toHaveProperty("orders");
    expect(studentCase).not.toHaveProperty("results");
    expect(studentCase).not.toHaveProperty("scoreRules");
    expect(studentCase).not.toHaveProperty("feedback");
  });
});

describe("qualifier-sensitive order behavior", () => {
  const behaviors = [
    {
      orderId: "dextrose",
      qualifierConditions: { dose: ["25 g"], priority: ["STAT"] },
      classification: "beneficial" as const,
      responseDelayMinutes: 5,
      targetStateId: "recovered"
    },
    {
      orderId: "dextrose",
      qualifierConditions: { dose: ["12.5 g"] },
      classification: "beneficial" as const,
      responseDelayMinutes: 10,
      targetStateId: "partial"
    },
    {
      orderId: "dextrose",
      classification: "neutral" as const,
      responseDelayMinutes: 20,
      targetStateId: "partial"
    }
  ];

  it("selects the most specific matching behavior before the fallback", () => {
    expect(selectOrderBehavior(behaviors, "dextrose", { dose: "25 g", priority: "STAT" })?.targetStateId).toBe("recovered");
    expect(selectOrderBehavior(behaviors, "dextrose", { dose: "12.5 g", priority: "STAT" })?.responseDelayMinutes).toBe(10);
    expect(selectOrderBehavior(behaviors, "dextrose", { dose: "25 g", priority: "Routine" })?.responseDelayMinutes).toBe(20);
  });

  it("awards partial credit when the order ID is correct but its qualifiers are not", () => {
    const definition = {
      orders: [{
        id: "dextrose",
        name: "Dextrose",
        aliases: [],
        category: "Medication"
      }],
      scoreRules: [{
        id: "correct-dextrose",
        label: "Give immediate full-dose dextrose",
        domain: "Therapy",
        actionType: "order",
        match: "dextrose",
        qualifierConditions: { dose: ["25 g"], priority: ["STAT"] },
        points: 25,
        pointsIfQualifierMismatch: 10,
        rationale: "Correct dose and urgency are required"
      }],
      feedback: "Qualifier feedback"
    } as any;
    const report = scoreAttempt({
      caseSnapshot: definition,
      orders: [],
      actions: [{
        type: "order",
        match: "dextrose",
        dose: "12.5 g",
        priority: "STAT",
        simulatedMinute: 1,
        summary: "Ordered Dextrose"
      }]
    } as any);

    expect(report.total).toBe(10);
    expect(report.partial).toEqual(["Give immediate full-dose dextrose (10/25 points)"]);
  });

  it("awards full credit when every configured qualifier matches", () => {
    const report = scoreAttempt({
      caseSnapshot: {
        orders: [{ id: "dextrose", name: "Dextrose", aliases: [], category: "Medication" }],
        scoreRules: [{
          id: "correct-dextrose",
          label: "Give immediate full-dose dextrose",
          domain: "Therapy",
          actionType: "order",
          match: "dextrose",
          qualifierConditions: { dose: ["25 g"], priority: ["STAT"] },
          points: 25,
          pointsIfQualifierMismatch: 10,
          rationale: "Correct dose and urgency are required"
        }],
        feedback: "Qualifier feedback"
      },
      orders: [],
      actions: [{
        type: "order",
        match: "dextrose",
        dose: "25 g",
        priority: "STAT",
        simulatedMinute: 1,
        summary: "Ordered Dextrose"
      }]
    } as any);

    expect(report.total).toBe(25);
    expect(report.ideal).toContain("Give immediate full-dose dextrose");
  });
});

describe("state-dependent repeat results", () => {
  const glucoseResult = {
    orderId: "poc-glucose",
    category: "Lab Reports" as const,
    value: "Glucose: 34 mg/dL",
    variants: [
      { clinicalStateId: "recovered", value: "Glucose: 104 mg/dL" },
      { clinicalStateId: "severe", value: "Glucose: 22 mg/dL" }
    ]
  };

  it("selects the result associated with the clinical state at collection time", () => {
    expect(resolveCaseResultValue(glucoseResult, "symptomatic")).toBe("Glucose: 34 mg/dL");
    expect(resolveCaseResultValue(glucoseResult, "recovered")).toBe("Glucose: 104 mg/dL");
    expect(resolveCaseResultValue(glucoseResult, "severe")).toBe("Glucose: 22 mg/dL");
  });

  it("does not expose a frozen unreleased result in the student order payload", () => {
    const serialized = serializeStudentPlacedOrder({
      id: "placed-glucose",
      definitionId: "poc-glucose",
      name: "Point-of-care glucose",
      category: "Laboratory",
      orderedAt: 0,
      reportAt: 5,
      status: "active",
      resultValueSnapshot: "Secret glucose result",
      resultCategorySnapshot: "Lab Reports",
      caseConfigured: true,
      definitionSnapshot: { id: "poc-glucose" }
    });

    expect(serialized).not.toHaveProperty("resultValueSnapshot");
    expect(serialized).not.toHaveProperty("resultCategorySnapshot");
    expect(serialized).not.toHaveProperty("caseConfigured");
    expect(serialized).not.toHaveProperty("definitionSnapshot");
  });
});

describe("treatment prerequisites", () => {
  const behavior = {
    orderId: "dextrose",
    classification: "beneficial" as const,
    responseDelayMinutes: 10,
    targetStateId: "recovered",
    notification: "The patient recovers.",
    treatmentPrerequisites: { requiredOrderIds: ["iv-access"] }
  };

  const createAttempt = () => ({
    simulatedMinute: 0,
    currentClinicalStateId: "symptomatic",
    caseSnapshot: {
      results: [],
      transitionRules: [],
      clinicalStates: [{ id: "recovered", appearance: "Alert" }]
    },
    orders: [{
      id: "placed-dextrose",
      definitionId: "dextrose",
      name: "IV dextrose",
      orderedAt: 0,
      status: "active"
    }],
    results: [],
    pendingEvents: [],
    progressNotes: [],
    patientNotifications: [],
    actions: [],
    triggeredRuleIds: [],
    vitalSignsLog: [],
    markModified: () => undefined
  }) as any;

  it("holds a response until the required order is placed, then starts its delay", () => {
    const attempt = createAttempt();
    scheduleOrderClinicalResponse(attempt, attempt.orders[0], behavior);

    expect(attempt.orders[0].status).toBe("held");
    expect(attempt.pendingEvents[0].status).toBe("blocked");
    expect(attempt.pendingEvents[0].dueMinute).toBeUndefined();

    attempt.simulatedMinute = 5;
    attempt.orders.push({
      id: "placed-iv",
      definitionId: "iv-access",
      name: "IV access",
      orderedAt: 5,
      status: "active"
    });
    activateBlockedTreatmentResponses(attempt);

    expect(attempt.orders[0].status).toBe("active");
    expect(attempt.pendingEvents[0].status).toBe("pending");
    expect(attempt.pendingEvents[0].dueMinute).toBe(15);

    resolveDueEvents(attempt, 14);
    expect(attempt.currentClinicalStateId).toBe("symptomatic");
    resolveDueEvents(attempt, 15);
    expect(attempt.currentClinicalStateId).toBe("recovered");
  });

  it("cancels a blocked response when its source treatment is discontinued", () => {
    const attempt = createAttempt();
    scheduleOrderClinicalResponse(attempt, attempt.orders[0], behavior);
    attempt.orders[0].status = "discontinued";

    activateBlockedTreatmentResponses(attempt);

    expect(attempt.pendingEvents[0].status).toBe("cancelled");
  });
});

describe("timing and sequence scoring", () => {
  const caseSnapshot = {
    orders: [
      { id: "glucose", name: "Point-of-care glucose", aliases: [], category: "Laboratory" },
      { id: "iv", name: "IV access", aliases: [], category: "Procedure" },
      { id: "dextrose", name: "IV dextrose", aliases: [], category: "Medication" }
    ],
    scoreRules: [
      {
        id: "dextrose",
        label: "Give dextrose promptly after glucose and IV access",
        domain: "Timing & sequence",
        actionType: "order",
        match: "dextrose",
        points: 25,
        rationale: "Prompt treatment",
        timing: { fullCreditByMinute: 10, partialCreditByMinute: 20, partialCreditPoints: 10 },
        sequence: {
          requiredPriorActions: [
            { actionType: "order", match: "glucose" },
            { actionType: "order", match: "iv" }
          ],
          pointsIfViolated: 0
        }
      },
      {
        id: "home",
        label: "Send home only after recovery",
        domain: "Location",
        actionType: "location",
        match: "Home",
        points: 10,
        rationale: "Safe disposition",
        sequence: {
          requiredPriorActions: [{ actionType: "clinical_state", match: "recovered" }],
          pointsIfViolated: -10
        }
      }
    ],
    feedback: "Timing and sequence feedback"
  } as any;

  it("awards full credit when prerequisites occur first and treatment is early", () => {
    const report = scoreAttempt({
      caseSnapshot,
      orders: [],
      actions: [
        { type: "order", match: "glucose", simulatedMinute: 2, summary: "Ordered glucose" },
        { type: "order", match: "iv", simulatedMinute: 2, summary: "Ordered IV" },
        { type: "order", match: "dextrose", simulatedMinute: 3, summary: "Ordered dextrose" },
        { type: "system", clinicalStateId: "recovered", simulatedMinute: 13, summary: "Recovered" },
        { type: "location", match: "Home", simulatedMinute: 30, summary: "Changed location to Home" }
      ]
    } as any);

    expect(report.total).toBe(35);
    expect(report.ideal).toHaveLength(2);
    expect(report.partial).toEqual([]);
  });

  it("awards partial credit when the correct sequence is completed late", () => {
    const report = scoreAttempt({
      caseSnapshot,
      orders: [],
      actions: [
        { type: "order", match: "glucose", simulatedMinute: 12, summary: "Ordered glucose" },
        { type: "order", match: "iv", simulatedMinute: 12, summary: "Ordered IV" },
        { type: "order", match: "dextrose", simulatedMinute: 15, summary: "Ordered dextrose" }
      ]
    } as any);

    expect(report.total).toBe(10);
    expect(report.partial).toEqual(["Give dextrose promptly after glucose and IV access (10/25 points)"]);
    expect(report.missed).toContain("Send home only after recovery");
  });

  it("applies the configured penalty when disposition occurs before recovery", () => {
    const report = scoreAttempt({
      caseSnapshot,
      orders: [],
      actions: [
        { type: "location", match: "Home", simulatedMinute: 5, summary: "Changed location to Home" },
        { type: "system", clinicalStateId: "recovered", simulatedMinute: 15, summary: "Recovered" }
      ]
    } as any);

    expect(report.total).toBe(0);
    expect(report.harmful).toContain("Send home only after recovery");
  });
});

describe("repeat reassessment scoring", () => {
  it("credits a repeat order after treatment within the configured delay", () => {
    const report = scoreAttempt({
      caseSnapshot: {
        orders: [
          { id: "glucose", name: "Glucose", aliases: [], category: "Laboratory" },
          { id: "dextrose", name: "Dextrose", aliases: [], category: "Medication" }
        ],
        scoreRules: [{
          id: "repeat-glucose",
          label: "Repeat glucose after treatment",
          domain: "Monitoring",
          actionType: "order",
          match: "glucose",
          points: 10,
          rationale: "Reassess treatment",
          minimumOccurrences: 2,
          afterAction: {
            actionType: "order",
            match: "dextrose",
            minimumDelayMinutes: 10,
            maximumDelayMinutes: 30
          },
          sequence: {
            requiredPriorActions: [{ actionType: "clinical_state", match: "recovered" }],
            pointsIfViolated: 0
          }
        }],
        feedback: "Repeat testing feedback"
      },
      orders: [],
      actions: [
        { type: "order", match: "glucose", simulatedMinute: 0, summary: "Initial glucose" },
        { type: "order", match: "dextrose", simulatedMinute: 2, summary: "Dextrose" },
        { type: "order", match: "glucose", simulatedMinute: 5, summary: "Too-early repeat" },
        { type: "system", clinicalStateId: "recovered", simulatedMinute: 12, summary: "Recovered" },
        { type: "order", match: "glucose", simulatedMinute: 15, summary: "Valid repeat" }
      ]
    } as any);

    expect(report.total).toBe(10);
    expect(report.ideal).toContain("Repeat glucose after treatment");
  });
});

describe("result and order lifecycle scoring", () => {
  const orders = [
    { id: "glucose", name: "Glucose", aliases: [], category: "Laboratory" },
    { id: "dextrose", name: "Dextrose", aliases: [], category: "Medication" },
    { id: "monitor", name: "Cardiac monitor", aliases: [], category: "Monitoring" }
  ];

  it("credits a post-treatment result but not a specimen collected before treatment", () => {
    const report = scoreAttempt({
      caseSnapshot: {
        orders,
        scoreRules: [{
          id: "repeat-glucose",
          label: "Repeat glucose after treatment",
          domain: "Monitoring",
          actionType: "result",
          match: "glucose",
          qualifierConditions: { frequency: ["Every 15 minutes"] },
          points: 10,
          rationale: "Confirm treatment response",
          afterAction: {
            actionType: "order",
            match: "dextrose",
            minimumDelayMinutes: 10,
            maximumDelayMinutes: 30
          }
        }],
        feedback: "Lifecycle feedback"
      },
      orders: [],
      results: [],
      actions: [
        { type: "order", match: "glucose", simulatedMinute: 0, summary: "Ordered glucose" },
        { type: "order", match: "dextrose", simulatedMinute: 2, summary: "Ordered dextrose" },
        {
          type: "result",
          match: "glucose",
          frequency: "Every 15 minutes",
          collectedAt: 0,
          simulatedMinute: 5,
          summary: "Initial result"
        },
        {
          type: "result",
          match: "glucose",
          frequency: "Every 15 minutes",
          collectedAt: 15,
          simulatedMinute: 20,
          summary: "Repeat result"
        }
      ]
    } as any);

    expect(report.total).toBe(10);
    expect(report.ideal).toContain("Repeat glucose after treatment");
  });

  it("does not credit a pre-treatment collection that is reported afterward", () => {
    const report = scoreAttempt({
      caseSnapshot: {
        orders,
        scoreRules: [{
          id: "repeat-glucose",
          label: "Repeat glucose after treatment",
          domain: "Monitoring",
          actionType: "result",
          match: "glucose",
          points: 10,
          rationale: "Confirm treatment response",
          afterAction: {
            actionType: "order",
            match: "dextrose",
            minimumDelayMinutes: 10,
            maximumDelayMinutes: 30
          }
        }],
        feedback: "Lifecycle feedback"
      },
      orders: [],
      results: [],
      actions: [
        { type: "order", match: "glucose", simulatedMinute: 0, summary: "Ordered glucose" },
        { type: "order", match: "dextrose", simulatedMinute: 2, summary: "Ordered dextrose" },
        { type: "result", match: "glucose", collectedAt: 0, simulatedMinute: 15, summary: "Delayed report" }
      ]
    } as any);

    expect(report.total).toBe(0);
    expect(report.missed).toContain("Repeat glucose after treatment");
  });

  it("scores completion after the required duration and penalizes early discontinuation", () => {
    const report = scoreAttempt({
      caseSnapshot: {
        orders,
        scoreRules: [
          {
            id: "monitor-duration",
            label: "Continue monitoring for 30 minutes",
            domain: "Monitoring",
            actionType: "order_completed",
            match: "monitor",
            points: 10,
            rationale: "Observe through the required period",
            afterAction: {
              actionType: "order",
              match: "monitor",
              minimumDelayMinutes: 30
            }
          },
          {
            id: "early-stop",
            label: "Stopped monitoring too early",
            domain: "Monitoring",
            actionType: "order_discontinued",
            match: "monitor",
            points: -5,
            rationale: "Monitoring was stopped before reassessment",
            afterAction: {
              actionType: "order",
              match: "monitor",
              maximumDelayMinutes: 15
            }
          }
        ],
        feedback: "Lifecycle feedback"
      },
      orders: [],
      results: [],
      actions: [
        { type: "order", match: "monitor", simulatedMinute: 0, summary: "Ordered monitor" },
        { type: "order_completed", match: "monitor", simulatedMinute: 30, summary: "Completed monitor" },
        { type: "order", match: "monitor", simulatedMinute: 40, summary: "Ordered monitor again" },
        { type: "order_discontinued", match: "monitor", simulatedMinute: 50, summary: "Stopped monitor" }
      ]
    } as any);

    expect(report.total).toBe(5);
    expect(report.ideal).toContain("Continue monitoring for 30 minutes");
    expect(report.harmful).toContain("Stopped monitoring too early");
  });
});

describe("clinical event resolution", () => {
  it("releases results at their due time and applies a later patient response", () => {
    const attempt = {
      simulatedMinute: 0,
      caseSnapshot: {
        results: [{ orderId: "cmp", category: "Lab Reports", value: "Mild prerenal azotemia" }],
        clinicalStates: [{
          id: "improved",
          appearance: "More comfortable",
          vitals: {
            temperature: "37 C",
            pulse: "88/min",
            respirations: "16/min",
            bloodPressure: "116/74 mm Hg",
            oxygenSaturation: "98%"
          },
          progressNote: "Dizziness improved after fluids."
        }],
        transitionRules: []
      },
      orders: [{ id: "placed-cmp", definitionId: "cmp", name: "CMP", reportAt: 20, status: "active" }],
      results: [],
      pendingEvents: [{ id: "response", dueMinute: 30, targetStateId: "improved", status: "pending" }],
      progressNotes: [],
      patientNotifications: [],
      actions: [],
      triggeredRuleIds: [],
      vitalSignsLog: [],
      markModified: () => undefined
    } as any;

    resolveDueEvents(attempt, 30);

    expect(attempt.results[0].availableAt).toBe(20);
    expect(attempt.currentClinicalStateId).toBe("improved");
    expect(attempt.vitalSignsLog[0].simulatedMinute).toBe(30);
    expect(attempt.progressNotes[0].text).toContain("Dizziness improved");
    expect(attempt.simulatedMinute).toBe(30);
  });

  it("runs higher-priority simultaneous events first and skips events invalidated by the new state", () => {
    const attempt = {
      simulatedMinute: 0,
      currentClinicalStateId: "symptomatic",
      caseSnapshot: {
        results: [],
        transitionRules: [],
        clinicalStates: [
          { id: "severe", appearance: "Unresponsive" },
          { id: "recovered", appearance: "Alert" }
        ]
      },
      orders: [],
      results: [],
      pendingEvents: [
        {
          id: "recovery",
          eventTag: "recovery",
          priority: 50,
          dueMinute: 10,
          targetStateId: "recovered",
          allowedFromStateIds: ["symptomatic"],
          status: "pending"
        },
        {
          id: "deterioration",
          eventTag: "deterioration",
          priority: 100,
          dueMinute: 10,
          targetStateId: "severe",
          allowedFromStateIds: ["symptomatic"],
          status: "pending"
        }
      ],
      progressNotes: [],
      patientNotifications: [],
      actions: [],
      triggeredRuleIds: [],
      vitalSignsLog: [],
      markModified: () => undefined
    } as any;

    resolveDueEvents(attempt, 10);

    expect(attempt.currentClinicalStateId).toBe("severe");
    expect(attempt.pendingEvents.find((event: any) => event.id === "deterioration").status).toBe("completed");
    expect(attempt.pendingEvents.find((event: any) => event.id === "recovery").status).toBe("skipped");
    expect(attempt.actions.map((action: any) => action.eventOutcome)).toEqual(["applied", "skipped"]);
  });

  it("cancels tagged pending events after an applicable treatment response", () => {
    const attempt = {
      simulatedMinute: 0,
      currentClinicalStateId: "symptomatic",
      caseSnapshot: {
        results: [],
        transitionRules: [],
        clinicalStates: [
          { id: "recovered", appearance: "Alert" },
          { id: "severe", appearance: "Unresponsive" }
        ]
      },
      orders: [],
      results: [],
      pendingEvents: [
        {
          id: "treatment",
          eventTag: "treatment-response",
          priority: 100,
          dueMinute: 10,
          targetStateId: "recovered",
          cancelPendingEventTags: ["untreated-deterioration"],
          status: "pending"
        },
        {
          id: "untreated",
          eventTag: "untreated-deterioration",
          priority: 80,
          dueMinute: 30,
          targetStateId: "severe",
          status: "pending"
        }
      ],
      progressNotes: [],
      patientNotifications: [],
      actions: [],
      triggeredRuleIds: [],
      vitalSignsLog: [],
      markModified: () => undefined
    } as any;

    resolveDueEvents(attempt, 30);

    expect(attempt.currentClinicalStateId).toBe("recovered");
    expect(attempt.pendingEvents.find((event: any) => event.id === "untreated").status).toBe("cancelled");
    expect(attempt.actions.some((action: any) => action.eventOutcome === "cancelled")).toBe(true);
  });
});

describe("recurring order lifecycle", () => {
  const createAttempt = (overrides: Record<string, unknown> = {}) => ({
    simulatedMinute: 0,
    currentClinicalStateId: "symptomatic",
    caseSnapshot: {
      results: [],
      transitionRules: [],
      clinicalStates: []
    },
    orders: [],
    results: [],
    pendingEvents: [],
    progressNotes: [],
    patientNotifications: [],
    actions: [],
    triggeredRuleIds: [],
    vitalSignsLog: [],
    markModified: () => undefined,
    ...overrides
  }) as any;

  it("releases every scheduled result and completes after the last occurrence", () => {
    const placed = {
      id: "placed-glucose",
      definitionId: "glucose",
      name: "Point-of-care glucose",
      orderedAt: 0,
      reportAt: 5,
      status: "active",
      scheduleSnapshot: {
        intervalMinutes: 15,
        maximumOccurrences: 3,
        repeatResults: true,
        repeatClinicalResponse: false,
        cancelWhenUnavailable: false
      },
      hasResultStream: true,
      hasClinicalResponseStream: false,
      resultStreamComplete: false,
      responseStreamComplete: true,
      resultOccurrencesReleased: 0
    };
    const attempt = createAttempt({
      caseSnapshot: {
        results: [{ orderId: "glucose", category: "Lab Reports", value: "Glucose result" }],
        transitionRules: [],
        clinicalStates: []
      },
      orders: [placed]
    });

    resolveDueEvents(attempt, 40);

    expect(attempt.results.map((result: any) => result.availableAt)).toEqual([5, 20, 35]);
    expect(attempt.results.map((result: any) => result.occurrence)).toEqual([1, 2, 3]);
    expect(placed.resultOccurrencesReleased).toBe(3);
    expect(placed.reportAt).toBeUndefined();
    expect(placed.status).toBe("completed");
  });

  it("repeats configured clinical responses and completes their source order", () => {
    const placed = {
      id: "placed-treatment",
      definitionId: "treatment",
      name: "Recurring treatment",
      orderedAt: 0,
      status: "active",
      scheduleSnapshot: {
        intervalMinutes: 5,
        maximumOccurrences: 3,
        repeatResults: false,
        repeatClinicalResponse: true,
        cancelWhenUnavailable: false
      },
      hasResultStream: false,
      hasClinicalResponseStream: true,
      resultStreamComplete: true,
      responseStreamComplete: false,
      responseOccurrencesResolved: 0
    };
    const attempt = createAttempt({
      caseSnapshot: {
        results: [],
        transitionRules: [],
        clinicalStates: [{ id: "improving", appearance: "Improving" }]
      },
      orders: [placed],
      pendingEvents: [{
        id: "response-1",
        type: "clinical_response",
        sourceOrderId: placed.id,
        occurrence: 1,
        dueMinute: 5,
        targetStateId: "improving",
        notification: "Treatment occurrence applied.",
        status: "pending"
      }]
    });

    resolveDueEvents(attempt, 20);

    expect(attempt.patientNotifications).toHaveLength(3);
    expect(placed.responseOccurrencesResolved).toBe(3);
    expect(placed.status).toBe("completed");
  });

  it("keeps a combined order active until both its result and response finish", () => {
    const placed = {
      id: "placed-combined",
      definitionId: "combined",
      name: "Combined order",
      orderedAt: 0,
      reportAt: 5,
      status: "active",
      hasResultStream: true,
      hasClinicalResponseStream: true,
      resultStreamComplete: false,
      responseStreamComplete: false
    };
    const attempt = createAttempt({
      caseSnapshot: {
        results: [{ orderId: "combined", category: "Other Tests", value: "Result" }],
        transitionRules: [],
        clinicalStates: [{ id: "improved" }]
      },
      orders: [placed],
      pendingEvents: [{
        id: "combined-response",
        type: "clinical_response",
        sourceOrderId: placed.id,
        dueMinute: 10,
        occurrence: 1,
        targetStateId: "improved",
        status: "pending"
      }]
    });

    resolveDueEvents(attempt, 5);
    expect(placed.status).toBe("active");
    resolveDueEvents(attempt, 10);
    expect(placed.status).toBe("completed");
  });

  it("cancels all future results and responses when an order is discontinued", () => {
    const placed = {
      id: "placed-series",
      definitionId: "series",
      name: "Scheduled series",
      orderedAt: 0,
      reportAt: 5,
      status: "active",
      hasResultStream: true,
      hasClinicalResponseStream: true,
      resultStreamComplete: false,
      responseStreamComplete: false
    };
    const attempt = createAttempt({
      caseSnapshot: {
        results: [{ orderId: "series", category: "Lab Reports", value: "Result" }],
        transitionRules: [],
        clinicalStates: []
      },
      orders: [placed],
      pendingEvents: [{
        id: "future-response",
        type: "clinical_response",
        sourceOrderId: placed.id,
        dueMinute: 10,
        status: "pending"
      }]
    });

    discontinuePlacedOrder(attempt, placed);
    resolveDueEvents(attempt, 30);

    expect(placed.status).toBe("discontinued");
    expect(placed.reportAt).toBeUndefined();
    expect(attempt.pendingEvents[0].status).toBe("cancelled");
    expect(attempt.results).toHaveLength(0);
  });

  it("completes a finite continuous order when its configured duration ends", () => {
    const placed = {
      id: "placed-monitor",
      definitionId: "monitor",
      name: "Cardiac monitor",
      orderedAt: 0,
      status: "active",
      hasResultStream: false,
      hasClinicalResponseStream: false,
      resultStreamComplete: true,
      responseStreamComplete: true
    };
    const attempt = createAttempt({
      orders: [placed],
      pendingEvents: [{
        id: "monitor-completion",
        type: "order_completion",
        sourceOrderId: placed.id,
        dueMinute: 30,
        status: "pending"
      }]
    });

    resolveDueEvents(attempt, 29);
    expect(placed.status).toBe("active");
    resolveDueEvents(attempt, 30);
    expect(placed.status).toBe("completed");
  });
});

describe("clinical case-ending phase", () => {
  const createAttempt = (overrides: Record<string, unknown> = {}) => ({
    status: "active",
    simulatedMinute: 20,
    location: "Home",
    currentClinicalStateId: "recovered",
    finalOrdersStartsAt: new Date(60_000),
    realTimeEndsAt: new Date(180_000),
    caseSnapshot: {
      finalOrderMinutes: 2,
      orders: [],
      results: [],
      transitionRules: [],
      clinicalStates: [],
      scoreRules: [],
      feedback: "End-condition feedback",
      endConditions: [{
        id: "safe-discharge",
        conditions: { clinicalStateId: "recovered", location: "Home" },
        reason: "Patient recovered and was discharged",
        finalOrderMinutes: 2
      }]
    },
    orders: [],
    results: [],
    actions: [],
    pendingEvents: [],
    progressNotes: [],
    patientNotifications: [],
    triggeredRuleIds: [],
    vitalSignsLog: [],
    markModified: () => undefined,
    ...overrides
  }) as any;

  it("enters a fresh final-order window when a clinical condition matches", () => {
    const attempt = createAttempt();
    const matched = evaluateCaseEndConditions(attempt, 1_000_000);

    expect(matched?.id).toBe("safe-discharge");
    expect(attempt.status).toBe("final_orders");
    expect(attempt.finalOrdersStartsAt.getTime()).toBe(1_000_000);
    expect(attempt.realTimeEndsAt.getTime()).toBe(1_120_000);
    expect(attempt.endConditionId).toBe("safe-discharge");
    expect(attempt.endReason).toContain("recovered");
    expect(attempt.scoreReport).toBeUndefined();

    evaluateCaseEndConditions(attempt, 2_000_000);
    expect(attempt.realTimeEndsAt.getTime()).toBe(1_120_000);
  });

  it("preserves the original deadline when normal case time starts final orders", () => {
    const attempt = createAttempt({
      location: "Emergency Department",
      currentClinicalStateId: "symptomatic",
      finalOrdersStartsAt: new Date(1_000_000),
      realTimeEndsAt: new Date(1_120_000)
    });

    updateDeadline(attempt, 1_000_000);

    expect(attempt.status).toBe("final_orders");
    expect(attempt.realTimeEndsAt.getTime()).toBe(1_120_000);
    expect(attempt.endReason).toContain("Maximum allotted");
  });

  it("force-completes and scores when the final-order deadline expires", () => {
    const attempt = createAttempt({
      status: "final_orders",
      finalOrdersStartsAt: new Date(1_000_000),
      realTimeEndsAt: new Date(1_120_000)
    });

    updateDeadline(attempt, 1_120_000);

    expect(attempt.status).toBe("expired");
    expect(attempt.completionReason).toBe("time_expired");
    expect(attempt.scoreReport.total).toBe(0);
  });

  it("converts legacy endCase events into final orders instead of immediate scoring", () => {
    const attempt = createAttempt({
      location: "Emergency Department",
      currentClinicalStateId: "symptomatic",
      caseSnapshot: {
        finalOrderMinutes: 2,
        orders: [],
        results: [],
        transitionRules: [],
        clinicalStates: [{ id: "terminal" }],
        scoreRules: [],
        feedback: "Legacy event feedback"
      },
      pendingEvents: [{
        id: "legacy-end",
        ruleId: "legacy-end",
        type: "transition_rule",
        dueMinute: 10,
        targetStateId: "terminal",
        notification: "The clinical portion of the case has ended.",
        endCase: true,
        status: "pending"
      }]
    });

    resolveDueEvents(attempt, 30);

    expect(attempt.status).toBe("final_orders");
    expect(attempt.simulatedMinute).toBe(10);
    expect(attempt.scoreReport).toBeUndefined();
    expect(attempt.endConditionId).toBe("transition:legacy-end");
  });
});
