import type { CaseDefinitionInput } from "@ccs/validation";
import { previewCaseDefinition } from "./attempt.service.js";

export type QualitySeverity = "error" | "warning";
export interface CaseQualityIssue {
  severity: QualitySeverity;
  code: string;
  path: string;
  message: string;
}

const issue = (severity: QualitySeverity, code: string, path: string, message: string): CaseQualityIssue => ({ severity, code, path, message });

const findReachableStates = (definition: CaseDefinitionInput) => {
  const reachable = new Set<string>();
  if (definition.initialClinicalStateId) reachable.add(definition.initialClinicalStateId);
  let changed = true;
  while (changed) {
    changed = false;
    const candidates = [
      ...(definition.orderBehaviors ?? []).map((behavior) => ({
        target: behavior.targetStateId,
        from: behavior.allowedFromStateIds
      })),
      ...(definition.transitionRules ?? []).map((rule) => ({
        target: rule.targetStateId,
        from: [rule.conditions?.clinicalStateId, ...(rule.allowedFromStateIds ?? [])].filter(Boolean) as string[]
      }))
    ];
    for (const candidate of candidates) {
      if (!candidate.target || reachable.has(candidate.target)) continue;
      if (candidate.from?.length && !candidate.from.some((stateId) => reachable.has(stateId))) continue;
      reachable.add(candidate.target);
      changed = true;
    }
  }
  return reachable;
};

const prerequisiteCycles = (definition: CaseDefinitionInput) => {
  const graph = new Map<string, Set<string>>();
  const grouped = new Map<string, Array<Set<string>>>();
  for (const behavior of definition.orderBehaviors ?? []) {
    const variants = grouped.get(behavior.orderId) ?? [];
    variants.push(new Set(behavior.treatmentPrerequisites?.requiredOrderIds ?? []));
    grouped.set(behavior.orderId, variants);
  }
  for (const [orderId, variants] of grouped) {
    const requiredInEveryVariant = new Set(
      [...(variants[0] ?? [])].filter((required) => variants.every((variant) => variant.has(required)))
    );
    graph.set(orderId, requiredInEveryVariant);
  }
  const cycles = new Set<string>();
  const visit = (node: string, path: string[]) => {
    const index = path.indexOf(node);
    if (index >= 0) {
      cycles.add([...path.slice(index), node].join(" -> "));
      return;
    }
    for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
  };
  for (const node of graph.keys()) visit(node, []);
  return [...cycles];
};

const stateTransitionCycles = (definition: CaseDefinitionInput) => {
  const initial = definition.initialClinicalStateId;
  const graph = new Map<string, Set<string>>();
  const addEdges = (fromIds: string[] | undefined, target: string | undefined) => {
    if (!target) return;
    for (const from of fromIds?.length ? fromIds : initial ? [initial] : []) {
      const targets = graph.get(from) ?? new Set<string>();
      targets.add(target);
      graph.set(from, targets);
    }
  };
  for (const behavior of definition.orderBehaviors ?? []) addEdges(behavior.allowedFromStateIds, behavior.targetStateId);
  for (const rule of definition.transitionRules ?? []) addEdges(
    [rule.conditions?.clinicalStateId, ...(rule.allowedFromStateIds ?? [])].filter(Boolean) as string[],
    rule.targetStateId
  );
  const cycles = new Set<string>();
  const walk = (node: string, path: string[]) => {
    const index = path.indexOf(node);
    if (index >= 0) {
      cycles.add([...path.slice(index), node].join(" -> "));
      return;
    }
    for (const next of graph.get(node) ?? []) walk(next, [...path, node]);
  };
  for (const node of graph.keys()) walk(node, []);
  return [...cycles];
};

export const analyzeCaseDefinition = (definition: CaseDefinitionInput) => {
  const issues: CaseQualityIssue[] = [];
  const orderIds = new Set(definition.orders.map((order) => order.id));
  const resultIds = new Set(definition.results.map((result) => result.orderId));
  const reachableStates = findReachableStates(definition);
  const configuredBehaviorIds = new Set((definition.orderBehaviors ?? []).map((behavior) => behavior.orderId));

  for (const [index, state] of (definition.clinicalStates ?? []).entries()) {
    if (!reachableStates.has(state.id)) issues.push(issue("warning", "UNREACHABLE_STATE", `clinicalStates.${index}`, `Clinical state '${state.id}' cannot be reached from the initial state.`));
  }
  for (const [index, order] of definition.orders.entries()) {
    if (!configuredBehaviorIds.has(order.id)) issues.push(issue("warning", "ORDER_BEHAVIOR_MISSING", `orders.${index}`, `'${order.name}' has no patient-specific behavior and will remain neutral.`));
    if (["Laboratory", "Imaging", "Other Tests"].includes(order.category) && !resultIds.has(order.id)) issues.push(issue("warning", "DIAGNOSTIC_RESULT_MISSING", `orders.${index}`, `Diagnostic order '${order.name}' has no case result definition.`));
  }
  for (const [index, result] of definition.results.entries()) {
    const order = definition.orders.find((item) => item.id === result.orderId);
    const hasTiming = order?.resultDelayMinutes !== undefined || (definition.orderBehaviors ?? []).some((behavior) => behavior.orderId === result.orderId && behavior.processingMinutes !== undefined);
    if (!hasTiming) issues.push(issue("error", "RESULT_TIMING_MISSING", `results.${index}`, `Result '${result.orderId}' has no processing time and can never be released.`));
  }
  for (const [index, behavior] of (definition.orderBehaviors ?? []).entries()) {
    if (behavior.allowedLocations?.length && !behavior.allowedLocations.some((location) => definition.allowedLocations.includes(location))) {
      issues.push(issue("error", "BEHAVIOR_LOCATION_UNAVAILABLE", `orderBehaviors.${index}.allowedLocations`, `Behavior for '${behavior.orderId}' is unavailable in every permitted case location.`));
    }
    if (behavior.allowedFromStateIds?.length && !behavior.allowedFromStateIds.some((stateId) => reachableStates.has(stateId))) {
      issues.push(issue("error", "RESPONSE_SOURCE_STATE_UNREACHABLE", `orderBehaviors.${index}.allowedFromStateIds`, `Response for '${behavior.orderId}' is restricted to clinical states that cannot occur.`));
    }
    const responseMinute = behavior.responseDelayMinutes ?? 0;
    if (responseMinute > definition.durationMinutes * 10) issues.push(issue("warning", "RESPONSE_AFTER_CASE_WINDOW", `orderBehaviors.${index}.responseDelayMinutes`, `Response for '${behavior.orderId}' is scheduled far beyond the real-time case window.`));
  }
  for (const cycle of prerequisiteCycles(definition)) issues.push(issue("error", "PREREQUISITE_CYCLE", "orderBehaviors", `Treatment prerequisite cycle detected: ${cycle}.`));
  for (const cycle of stateTransitionCycles(definition)) issues.push(issue("warning", "STATE_TRANSITION_CYCLE", "clinicalStates", `Clinical state loop detected: ${cycle}. Confirm that it is intentional and bounded.`));

  for (const [index, rule] of (definition.transitionRules ?? []).entries()) {
    if (rule.trigger.type === "time_reached" && (rule.trigger.atMinute ?? 0) > definition.durationMinutes * 10) {
      issues.push(issue("warning", "LATE_TRANSITION", `transitionRules.${index}.trigger.atMinute`, `Transition '${rule.id}' occurs far beyond the real-time case window.`));
    }
  }

  if (!(definition.endConditions?.length)) {
    issues.push(issue("error", "END_CONDITION_MISSING", "endConditions", "At least one achievable clinical end condition is required."));
  } else {
    const achievable = definition.endConditions.some((condition) => {
      const statePossible = !condition.conditions.clinicalStateId || reachableStates.has(condition.conditions.clinicalStateId);
      const locationPossible = !condition.conditions.location || definition.allowedLocations.includes(condition.conditions.location);
      const ordersPossible = (condition.conditions.requiredOrderIds ?? []).every((orderId) => orderIds.has(orderId));
      return statePossible && locationPossible && ordersPossible;
    });
    if (!achievable) issues.push(issue("error", "END_CONDITION_UNREACHABLE", "endConditions", "No configured end condition is reachable through the case graph."));
  }

  const positivePoints = definition.scoreRules.filter((rule) => rule.points > 0).reduce((total, rule) => total + rule.points, 0);
  const negativePoints = definition.scoreRules.filter((rule) => rule.points < 0).reduce((total, rule) => total + Math.abs(rule.points), 0);
  if (!positivePoints) issues.push(issue("error", "POSITIVE_SCORE_MISSING", "scoreRules", "The case has no positive scoring pathway."));
  if (positivePoints !== 100) issues.push(issue("warning", "SCORE_TOTAL_NOT_100", "scoreRules", `Positive score weights total ${positivePoints}; a complete ideal pathway normally totals 100.`));
  for (const [index, rule] of definition.scoreRules.entries()) {
    if (rule.actionType === "clinical_state" && !reachableStates.has(rule.match)) issues.push(issue("error", "SCORE_STATE_UNREACHABLE", `scoreRules.${index}`, `Score rule '${rule.label}' depends on unreachable state '${rule.match}'.`));
    if (rule.actionType === "result" && !resultIds.has(rule.match)) issues.push(issue("error", "SCORE_RESULT_UNAVAILABLE", `scoreRules.${index}`, `Score rule '${rule.label}' depends on a result that is not configured.`));
  }

  const scenarios = definition.testScenarios ?? [];
  if (!scenarios.some((scenario) => scenario.kind === "ideal")) issues.push(issue("error", "IDEAL_SCENARIO_MISSING", "testScenarios", "An executable ideal-management scenario is required."));
  for (const kind of ["delayed", "harmful", "no_treatment"] as const) if (!scenarios.some((scenario) => scenario.kind === kind)) issues.push(issue("warning", "SCENARIO_COVERAGE_MISSING", "testScenarios", `Add a ${kind.replace("_", " ")} scenario for regression coverage.`));

  return {
    issues,
    metrics: {
      states: definition.clinicalStates?.length ?? 0,
      reachableStates: reachableStates.size,
      orders: definition.orders.length,
      configuredBehaviors: configuredBehaviorIds.size,
      positivePoints,
      negativePoints,
      scenarios: scenarios.length
    }
  };
};

export const evaluateCaseQuality = (definition: CaseDefinitionInput) => {
  const analysis = analyzeCaseDefinition(definition);
  const scenarioResults = (definition.testScenarios ?? []).map((scenario) => {
    try {
      const preview = previewCaseDefinition(definition, scenario.actions);
      const resultOrderIds = new Set((preview.actions as any[]).filter((action) => action.type === "result").map((action) => action.match));
      const failures: string[] = [];
      if (preview.scoreReport.total < scenario.expected.minimumScore || preview.scoreReport.total > scenario.expected.maximumScore) failures.push(`score ${preview.scoreReport.total} is outside ${scenario.expected.minimumScore}-${scenario.expected.maximumScore}`);
      if (scenario.expected.status && preview.status !== scenario.expected.status) failures.push(`status is ${preview.status}, expected ${scenario.expected.status}`);
      if (scenario.expected.clinicalStateId && preview.currentClinicalStateId !== scenario.expected.clinicalStateId) failures.push(`clinical state is ${preview.currentClinicalStateId ?? "unset"}, expected ${scenario.expected.clinicalStateId}`);
      for (const orderId of scenario.expected.resultOrderIds ?? []) if (!resultOrderIds.has(orderId)) failures.push(`result '${orderId}' was not released`);
      return { id: scenario.id, name: scenario.name, kind: scenario.kind, passed: failures.length === 0, score: preview.scoreReport.total, status: preview.status, clinicalStateId: preview.currentClinicalStateId, failures };
    } catch (error) {
      return { id: scenario.id, name: scenario.name, kind: scenario.kind, passed: false, failures: [error instanceof Error ? error.message : "Scenario execution failed"] };
    }
  });
  const scenarioIssues = scenarioResults.filter((scenario) => !scenario.passed).map((scenario) => issue("error", "SCENARIO_FAILED", `testScenarios.${scenario.id}`, `${scenario.name}: ${scenario.failures.join("; ")}`));
  const issues = [...analysis.issues, ...scenarioIssues];
  return {
    ready: !issues.some((item) => item.severity === "error"),
    errors: issues.filter((item) => item.severity === "error").length,
    warnings: issues.filter((item) => item.severity === "warning").length,
    issues,
    metrics: analysis.metrics,
    scenarios: scenarioResults
  };
};
