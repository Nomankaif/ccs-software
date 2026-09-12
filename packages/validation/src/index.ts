import { z } from "zod";

export const locationSchema = z.enum(["Office", "Emergency Department", "Inpatient Unit", "ICU", "Home"]);
export const orderCategorySchema = z.enum(["Medication", "Laboratory", "Imaging", "Other Tests", "Procedure", "Monitoring", "Consultation", "Counseling"]);

export const clinicalActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PERFORM_EXAM"), sections: z.array(z.string()).min(1) }),
  z.object({
    type: z.literal("PLACE_ORDER"),
    orderId: z.string().min(1),
    route: z.string().optional(),
    dose: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional(),
    priority: z.string().optional()
  }),
  z.object({ type: z.literal("DISCONTINUE_ORDER"), placedOrderId: z.string().min(1) }),
  z.object({ type: z.literal("ADVANCE_TIME"), minutes: z.number().int().min(1).max(525600) }),
  z.object({ type: z.literal("ADVANCE_TO_NEXT_RESULT") }),
  z.object({ type: z.literal("ADVANCE_TO_NEXT_EVENT") }),
  z.object({ type: z.literal("ADVANCE_TO_SIMULATED_MINUTE"), targetMinute: z.number().int().min(1).max(525600) }),
  z.object({ type: z.literal("CHANGE_LOCATION"), location: locationSchema }),
  z.object({ type: z.literal("FINISH_CASE") })
]);

export const caseTestScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(3),
  kind: z.enum(["ideal", "delayed", "harmful", "no_treatment", "custom"]).default("custom"),
  actions: z.array(clinicalActionSchema).min(1).max(100),
  expected: z.object({
    minimumScore: z.number().int().min(0).max(100),
    maximumScore: z.number().int().min(0).max(100),
    status: z.enum(["active", "final_orders", "completed", "expired"]).optional(),
    clinicalStateId: z.string().min(1).optional(),
    resultOrderIds: z.array(z.string().min(1)).optional()
  }).refine((expected) => expected.maximumScore >= expected.minimumScore, {
    message: "Maximum expected score cannot be lower than minimum expected score"
  })
});

export const orderDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  aliases: z.array(z.string()).default([]),
  category: orderCategorySchema,
  route: z.array(z.string()).optional(),
  dose: z.array(z.string()).optional(),
  frequency: z.array(z.string()).optional(),
  duration: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  resultDelayMinutes: z.number().int().min(0).optional()
});

export const orderCatalogEntrySchema = orderDefinitionSchema.extend({
  active: z.boolean().default(true)
});

export const orderQualifierConditionsSchema = z.object({
  route: z.array(z.string().min(1)).min(1).optional(),
  dose: z.array(z.string().min(1)).min(1).optional(),
  frequency: z.array(z.string().min(1)).min(1).optional(),
  duration: z.array(z.string().min(1)).min(1).optional(),
  priority: z.array(z.string().min(1)).min(1).optional()
}).refine((value) => Object.values(value).some(Boolean), {
  message: "At least one qualifier condition is required"
});

export const resultDefinitionSchema = z.object({
  orderId: z.string().min(1),
  category: z.enum(["Lab Reports", "Imaging", "Other Tests", "Treatment Record"]),
  value: z.string().min(1),
  variants: z.array(z.object({
    clinicalStateId: z.string().min(1),
    value: z.string().min(1)
  })).min(1).optional()
});

export const scoreActionReferenceSchema = z.object({
  actionType: z.enum([
    "order",
    "exam",
    "location",
    "clinical_state",
    "result",
    "order_completed",
    "order_discontinued"
  ]),
  match: z.string().min(1)
});

export const scoreTimingSchema = z.object({
  fullCreditByMinute: z.number().int().min(0),
  partialCreditByMinute: z.number().int().min(0).optional(),
  partialCreditPoints: z.number().int().min(0).optional()
}).superRefine((value, context) => {
  if ((value.partialCreditByMinute === undefined) !== (value.partialCreditPoints === undefined)) {
    context.addIssue({
      code: "custom",
      message: "partialCreditByMinute and partialCreditPoints must be provided together"
    });
  }
  if (
    value.partialCreditByMinute !== undefined &&
    value.partialCreditByMinute <= value.fullCreditByMinute
  ) {
    context.addIssue({
      code: "custom",
      path: ["partialCreditByMinute"],
      message: "Partial-credit deadline must be after the full-credit deadline"
    });
  }
});

export const scoreSequenceSchema = z.object({
  requiredPriorActions: z.array(scoreActionReferenceSchema).min(1),
  pointsIfViolated: z.number().int().max(0).default(0)
});

export const scoreAfterActionSchema = scoreActionReferenceSchema.extend({
  minimumDelayMinutes: z.number().int().min(0).optional(),
  maximumDelayMinutes: z.number().int().min(0).optional()
}).superRefine((value, context) => {
  if (
    value.minimumDelayMinutes !== undefined &&
    value.maximumDelayMinutes !== undefined &&
    value.maximumDelayMinutes < value.minimumDelayMinutes
  ) {
    context.addIssue({
      code: "custom",
      path: ["maximumDelayMinutes"],
      message: "Maximum reassessment delay cannot be less than the minimum delay"
    });
  }
});

export const scoreRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  domain: z.enum(["Diagnosis", "Therapy", "Monitoring", "Timing & sequence", "Location"]),
  actionType: z.enum([
    "order",
    "exam",
    "location",
    "clinical_state",
    "result",
    "order_completed",
    "order_discontinued"
  ]),
  match: z.string().min(1),
  points: z.number().int(),
  qualifierConditions: orderQualifierConditionsSchema.optional(),
  pointsIfQualifierMismatch: z.number().int().optional(),
  rationale: z.string().min(1),
  timing: scoreTimingSchema.optional(),
  sequence: scoreSequenceSchema.optional(),
  minimumOccurrences: z.number().int().min(1).optional(),
  afterAction: scoreAfterActionSchema.optional()
});

export const clinicalStateSchema = z.object({
  id: z.string().min(1),
  appearance: z.string().min(1).optional(),
  vitals: z.object({
    temperature: z.string(), pulse: z.string(), respirations: z.string(), bloodPressure: z.string(), oxygenSaturation: z.string()
  }).optional(),
  progressNote: z.string().min(1).optional()
});

const eventControlShape = {
  priority: z.number().int().min(-1000).max(1000).optional(),
  eventTag: z.string().min(1).optional(),
  allowedFromStateIds: z.array(z.string().min(1)).min(1).optional(),
  blockedInStateIds: z.array(z.string().min(1)).min(1).optional(),
  cancelPendingEventTags: z.array(z.string().min(1)).min(1).optional()
};

export const recurringOrderScheduleSchema = z.object({
  intervalMinutes: z.number().int().min(1).max(525600),
  maximumOccurrences: z.number().int().min(2).max(1000).optional(),
  durationMinutes: z.number().int().min(1).max(525600).optional(),
  repeatResults: z.boolean().default(true),
  repeatClinicalResponse: z.boolean().default(false),
  cancelWhenUnavailable: z.boolean().default(false)
}).refine(
  (value) => value.maximumOccurrences !== undefined || value.durationMinutes !== undefined,
  { message: "A recurring schedule requires maximumOccurrences or durationMinutes" }
);

export const caseOrderBehaviorSchema = z.object({
  orderId: z.string().min(1),
  qualifierConditions: orderQualifierConditionsSchema.optional(),
  classification: z.enum(["beneficial", "harmful", "unnecessary", "neutral"]),
  processingMinutes: z.number().int().min(0).optional(),
  schedule: recurringOrderScheduleSchema.optional(),
  allowedLocations: z.array(locationSchema).min(1).optional(),
  responseDelayMinutes: z.number().int().min(0).optional(),
  targetStateId: z.string().min(1).optional(),
  progressNote: z.string().min(1).optional(),
  notification: z.string().min(1).optional(),
  treatmentPrerequisites: z.object({
    requiredOrderIds: z.array(z.string().min(1)).min(1)
  }).optional(),
  ...eventControlShape
});

export const transitionRuleSchema = z.object({
  id: z.string().min(1),
  trigger: z.object({
    type: z.enum(["order_placed", "order_completed", "location_changed", "time_reached", "action_combination"]),
    match: z.string().min(1).optional(),
    atMinute: z.number().int().min(0).optional(),
    requiredOrderIds: z.array(z.string().min(1)).min(1).optional()
  }),
  conditions: z.object({
    location: locationSchema.optional(),
    clinicalStateId: z.string().min(1).optional()
  }).optional(),
  delayMinutes: z.number().int().min(0).optional(),
  targetStateId: z.string().min(1).optional(),
  progressNote: z.string().min(1).optional(),
  notification: z.string().min(1).optional(),
  endCase: z.boolean().optional(),
  once: z.boolean().optional(),
  ...eventControlShape
});

export const locationTransferSchema = z.object({
  from: locationSchema,
  to: locationSchema,
  minutes: z.number().int().min(0).max(1440)
});

export const caseEndConditionSchema = z.object({
  id: z.string().min(1),
  conditions: z.object({
    clinicalStateId: z.string().min(1).optional(),
    location: locationSchema.optional(),
    requiredOrderIds: z.array(z.string().min(1)).min(1).optional(),
    minimumSimulatedMinute: z.number().int().min(0).optional()
  }).refine((conditions) => Object.values(conditions).some((value) => value !== undefined), {
    message: "At least one case-end condition is required"
  }),
  reason: z.string().min(3),
  finalOrderMinutes: z.number().int().min(1).max(5).optional()
});

export const caseDefinitionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  specialty: z.string().min(2),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  durationMinutes: z.number().int().min(5).max(60),
  finalOrderMinutes: z.number().int().min(1).max(5).default(2),
  opening: z.string().min(20),
  appearance: z.string().min(3),
  startingLocation: locationSchema,
  allowedLocations: z.array(locationSchema).min(1),
  locationTransfers: z.array(locationTransferSchema).optional(),
  history: z.record(z.string().min(1)),
  vitals: z.object({
    temperature: z.string(), pulse: z.string(), respirations: z.string(), bloodPressure: z.string(), oxygenSaturation: z.string()
  }),
  exam: z.record(z.string().min(1)),
  orders: z.array(orderDefinitionSchema).min(1),
  initialClinicalStateId: z.string().min(1).optional(),
  clinicalStates: z.array(clinicalStateSchema).optional(),
  orderBehaviors: z.array(caseOrderBehaviorSchema).optional(),
  transitionRules: z.array(transitionRuleSchema).optional(),
  endConditions: z.array(caseEndConditionSchema).optional(),
  testScenarios: z.array(caseTestScenarioSchema).max(20).optional(),
  results: z.array(resultDefinitionSchema),
  scoreRules: z.array(scoreRuleSchema).min(1),
  feedback: z.string().min(10)
}).superRefine((value, context) => {
  const orderIds = new Set(value.orders.map((order) => order.id));
  const ordersById = new Map(value.orders.map((order) => [order.id, order]));
  const stateIds = new Set(value.clinicalStates?.map((state) => state.id) ?? []);
  const eventTags = new Set([
    ...(value.orderBehaviors ?? []).flatMap((behavior) => behavior.eventTag ? [behavior.eventTag] : []),
    ...(value.transitionRules ?? []).flatMap((rule) => rule.eventTag ? [rule.eventTag] : [])
  ]);
  const validateEventControls = (
    control: {
      allowedFromStateIds?: string[];
      blockedInStateIds?: string[];
      cancelPendingEventTags?: string[];
    },
    path: Array<string | number>
  ) => {
    for (const stateId of [...(control.allowedFromStateIds ?? []), ...(control.blockedInStateIds ?? [])]) {
      if (!stateIds.has(stateId)) context.addIssue({
        code: "custom",
        path,
        message: `Unknown event-control clinical state: ${stateId}`
      });
    }
    const blocked = new Set(control.blockedInStateIds ?? []);
    for (const stateId of control.allowedFromStateIds ?? []) {
      if (blocked.has(stateId)) context.addIssue({
        code: "custom",
        path,
        message: `Clinical state '${stateId}' cannot be both allowed and blocked`
      });
    }
    for (const tag of control.cancelPendingEventTags ?? []) {
      if (!eventTags.has(tag)) context.addIssue({
        code: "custom",
        path,
        message: `Unknown cancellable event tag: ${tag}`
      });
    }
  };
  const validateQualifierConditions = (
    orderId: string,
    conditions: Partial<Record<"route" | "dose" | "frequency" | "duration" | "priority", string[]>> | undefined,
    path: Array<string | number>
  ) => {
    if (!conditions) return;
    const order = ordersById.get(orderId);
    if (!order) return;
    for (const qualifier of ["route", "dose", "frequency", "duration", "priority"] as const) {
      for (const value of conditions[qualifier] ?? []) {
        if (!order[qualifier]?.includes(value)) context.addIssue({
          code: "custom",
          path: [...path, qualifier],
          message: `Unknown ${qualifier} qualifier '${value}' for order '${orderId}'`
        });
      }
    }
  };
  for (const [resultIndex, result] of value.results.entries()) {
    if (!orderIds.has(result.orderId)) context.addIssue({ code: "custom", path: ["results"], message: `Unknown result orderId: ${result.orderId}` });
    const variantStateIds = new Set<string>();
    for (const [variantIndex, variant] of (result.variants ?? []).entries()) {
      if (!stateIds.has(variant.clinicalStateId)) context.addIssue({
        code: "custom",
        path: ["results", resultIndex, "variants", variantIndex, "clinicalStateId"],
        message: `Unknown result variant clinical state: ${variant.clinicalStateId}`
      });
      if (variantStateIds.has(variant.clinicalStateId)) context.addIssue({
        code: "custom",
        path: ["results", resultIndex, "variants", variantIndex, "clinicalStateId"],
        message: `Duplicate result variant clinical state: ${variant.clinicalStateId}`
      });
      variantStateIds.add(variant.clinicalStateId);
    }
  }
  const behaviorSignatures = new Set<string>();
  const resultOrderIds = new Set(value.results.map((result) => result.orderId));
  for (const [behaviorIndex, behavior] of (value.orderBehaviors ?? []).entries()) {
    if (!orderIds.has(behavior.orderId)) context.addIssue({ code: "custom", path: ["orderBehaviors"], message: `Unknown behavior orderId: ${behavior.orderId}` });
    const signature = `${behavior.orderId}:${JSON.stringify(behavior.qualifierConditions ?? {})}`;
    if (behaviorSignatures.has(signature)) context.addIssue({
      code: "custom",
      path: ["orderBehaviors", behaviorIndex],
      message: `Duplicate qualifier behavior for order '${behavior.orderId}'`
    });
    behaviorSignatures.add(signature);
    validateQualifierConditions(behavior.orderId, behavior.qualifierConditions, ["orderBehaviors", behaviorIndex, "qualifierConditions"]);
    if (behavior.schedule?.repeatResults && !resultOrderIds.has(behavior.orderId)) context.addIssue({
      code: "custom",
      path: ["orderBehaviors", behaviorIndex, "schedule", "repeatResults"],
      message: `Recurring results require a result definition for order '${behavior.orderId}'`
    });
    if (
      behavior.schedule?.repeatResults &&
      behavior.processingMinutes === undefined &&
      ordersById.get(behavior.orderId)?.resultDelayMinutes === undefined
    ) context.addIssue({
      code: "custom",
      path: ["orderBehaviors", behaviorIndex, "schedule"],
      message: `Recurring results require processingMinutes or an order resultDelayMinutes for '${behavior.orderId}'`
    });
    if (
      behavior.schedule?.repeatClinicalResponse &&
      !(behavior.targetStateId || behavior.progressNote || behavior.notification)
    ) context.addIssue({
      code: "custom",
      path: ["orderBehaviors", behaviorIndex, "schedule", "repeatClinicalResponse"],
      message: `Recurring clinical responses require a state, note, or notification for '${behavior.orderId}'`
    });
    if (
      behavior.schedule &&
      !behavior.schedule.repeatResults &&
      !behavior.schedule.repeatClinicalResponse &&
      behavior.schedule.durationMinutes === undefined
    ) context.addIssue({
      code: "custom",
      path: ["orderBehaviors", behaviorIndex, "schedule"],
      message: "A schedule without recurring results or responses requires durationMinutes"
    });
    if (behavior.targetStateId && !stateIds.has(behavior.targetStateId)) context.addIssue({ code: "custom", path: ["orderBehaviors"], message: `Unknown targetStateId: ${behavior.targetStateId}` });
    for (const requiredOrderId of behavior.treatmentPrerequisites?.requiredOrderIds ?? []) {
      if (!orderIds.has(requiredOrderId)) context.addIssue({
        code: "custom",
        path: ["orderBehaviors"],
        message: `Unknown treatment prerequisite order ID: ${requiredOrderId}`
      });
      if (requiredOrderId === behavior.orderId) context.addIssue({
        code: "custom",
        path: ["orderBehaviors"],
        message: `Order '${behavior.orderId}' cannot require itself`
      });
    }
    validateEventControls(behavior, ["orderBehaviors", behaviorIndex]);
  }
  const ruleIds = new Set<string>();
  for (const [ruleIndex, rule] of (value.transitionRules ?? []).entries()) {
    if (ruleIds.has(rule.id)) context.addIssue({ code: "custom", path: ["transitionRules"], message: `Duplicate transition rule ID: ${rule.id}` });
    ruleIds.add(rule.id);
    if (rule.trigger.match && ["order_placed", "order_completed"].includes(rule.trigger.type) && !orderIds.has(rule.trigger.match)) {
      context.addIssue({ code: "custom", path: ["transitionRules"], message: `Unknown transition order ID: ${rule.trigger.match}` });
    }
    for (const orderId of rule.trigger.requiredOrderIds ?? []) if (!orderIds.has(orderId)) {
      context.addIssue({ code: "custom", path: ["transitionRules"], message: `Unknown combination order ID: ${orderId}` });
    }
    if (rule.targetStateId && !stateIds.has(rule.targetStateId)) context.addIssue({ code: "custom", path: ["transitionRules"], message: `Unknown transition target state: ${rule.targetStateId}` });
    if (rule.trigger.type === "time_reached" && rule.trigger.atMinute === undefined) context.addIssue({ code: "custom", path: ["transitionRules"], message: `Time rule '${rule.id}' requires atMinute` });
    validateEventControls(rule, ["transitionRules", ruleIndex]);
  }
  const endConditionIds = new Set<string>();
  for (const [conditionIndex, endCondition] of (value.endConditions ?? []).entries()) {
    if (endConditionIds.has(endCondition.id)) context.addIssue({
      code: "custom",
      path: ["endConditions", conditionIndex, "id"],
      message: `Duplicate case-end condition ID: ${endCondition.id}`
    });
    endConditionIds.add(endCondition.id);
    if (
      endCondition.conditions.clinicalStateId &&
      !stateIds.has(endCondition.conditions.clinicalStateId)
    ) context.addIssue({
      code: "custom",
      path: ["endConditions", conditionIndex, "conditions", "clinicalStateId"],
      message: `Unknown case-end clinical state: ${endCondition.conditions.clinicalStateId}`
    });
    for (const orderId of endCondition.conditions.requiredOrderIds ?? []) {
      if (!orderIds.has(orderId)) context.addIssue({
        code: "custom",
        path: ["endConditions", conditionIndex, "conditions", "requiredOrderIds"],
        message: `Unknown case-end order ID: ${orderId}`
      });
    }
  }
  const examSections = new Set(Object.keys(value.exam));
  const validateScoreReference = (
    reference: {
      actionType: "order" | "exam" | "location" | "clinical_state" | "result" | "order_completed" | "order_discontinued";
      match: string;
    },
    path: Array<string | number>
  ) => {
    const valid = ["order", "result", "order_completed", "order_discontinued"].includes(reference.actionType)
      ? orderIds.has(reference.match)
      : reference.actionType === "exam"
        ? examSections.has(reference.match)
        : reference.actionType === "location"
          ? value.allowedLocations.includes(reference.match as z.infer<typeof locationSchema>)
          : stateIds.has(reference.match);
    if (!valid) context.addIssue({
      code: "custom",
      path,
      message: `Unknown ${reference.actionType} score reference: ${reference.match}`
    });
  };
  for (const [ruleIndex, rule] of value.scoreRules.entries()) {
    validateScoreReference(rule, ["scoreRules", ruleIndex, "match"]);
    if (
      rule.qualifierConditions &&
      !["order", "result", "order_completed", "order_discontinued"].includes(rule.actionType)
    ) context.addIssue({
      code: "custom",
      path: ["scoreRules", ruleIndex, "qualifierConditions"],
      message: "Qualifier scoring is only available for order and order-lifecycle actions"
    });
    if (rule.pointsIfQualifierMismatch !== undefined && !rule.qualifierConditions) context.addIssue({
      code: "custom",
      path: ["scoreRules", ruleIndex, "pointsIfQualifierMismatch"],
      message: "Qualifier mismatch points require qualifierConditions"
    });
    if (rule.points > 0 && rule.pointsIfQualifierMismatch !== undefined && rule.pointsIfQualifierMismatch > rule.points) context.addIssue({
      code: "custom",
      path: ["scoreRules", ruleIndex, "pointsIfQualifierMismatch"],
      message: "Qualifier mismatch points cannot exceed the rule's full points"
    });
    if (["order", "result", "order_completed", "order_discontinued"].includes(rule.actionType)) {
      validateQualifierConditions(rule.match, rule.qualifierConditions, ["scoreRules", ruleIndex, "qualifierConditions"]);
    }
    for (const [referenceIndex, reference] of (rule.sequence?.requiredPriorActions ?? []).entries()) {
      validateScoreReference(reference, ["scoreRules", ruleIndex, "sequence", "requiredPriorActions", referenceIndex]);
    }
    if (rule.afterAction) {
      validateScoreReference(rule.afterAction, ["scoreRules", ruleIndex, "afterAction", "match"]);
    }
    if (rule.timing?.partialCreditPoints !== undefined && rule.timing.partialCreditPoints > Math.max(0, rule.points)) {
      context.addIssue({
        code: "custom",
        path: ["scoreRules", ruleIndex, "timing", "partialCreditPoints"],
        message: "Partial-credit points cannot exceed the rule's positive points"
      });
    }
  }
  if (value.initialClinicalStateId && !stateIds.has(value.initialClinicalStateId)) context.addIssue({ code: "custom", path: ["initialClinicalStateId"], message: "Initial clinical state does not exist" });
  if (!value.allowedLocations.includes(value.startingLocation)) context.addIssue({ code: "custom", path: ["allowedLocations"], message: "Starting location must be allowed" });
  const scenarioIds = new Set<string>();
  for (const [scenarioIndex, scenario] of (value.testScenarios ?? []).entries()) {
    if (scenarioIds.has(scenario.id)) context.addIssue({ code: "custom", path: ["testScenarios", scenarioIndex, "id"], message: `Duplicate scenario ID: ${scenario.id}` });
    scenarioIds.add(scenario.id);
    if (scenario.expected.clinicalStateId && !stateIds.has(scenario.expected.clinicalStateId)) context.addIssue({ code: "custom", path: ["testScenarios", scenarioIndex, "expected", "clinicalStateId"], message: `Unknown expected clinical state: ${scenario.expected.clinicalStateId}` });
    for (const orderId of scenario.expected.resultOrderIds ?? []) if (!orderIds.has(orderId)) context.addIssue({ code: "custom", path: ["testScenarios", scenarioIndex, "expected", "resultOrderIds"], message: `Unknown expected result order: ${orderId}` });
    for (const [actionIndex, action] of scenario.actions.entries()) {
      if (action.type === "PLACE_ORDER" && !orderIds.has(action.orderId)) context.addIssue({ code: "custom", path: ["testScenarios", scenarioIndex, "actions", actionIndex, "orderId"], message: `Unknown scenario order: ${action.orderId}` });
      if (action.type === "PERFORM_EXAM") for (const section of action.sections) if (!Object.hasOwn(value.exam, section)) context.addIssue({ code: "custom", path: ["testScenarios", scenarioIndex, "actions", actionIndex, "sections"], message: `Unknown scenario examination section: ${section}` });
      if (action.type === "CHANGE_LOCATION" && !value.allowedLocations.includes(action.location)) context.addIssue({ code: "custom", path: ["testScenarios", scenarioIndex, "actions", actionIndex, "location"], message: `Scenario location is not allowed: ${action.location}` });
    }
  }
});

export const caseImportSchema = z.union([caseDefinitionSchema, z.array(caseDefinitionSchema).min(1).max(50)]);
export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128)
});
export const registrationSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  confirmPassword: z.string().min(1, "Confirm your password").max(128)
}).strict().refine(value => value.password === value.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"]
});

export type CaseDefinitionInput = z.infer<typeof caseDefinitionSchema>;
export type ClinicalActionInput = z.infer<typeof clinicalActionSchema>;
