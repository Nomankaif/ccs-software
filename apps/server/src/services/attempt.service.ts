import crypto from "node:crypto";
import type { CaseDefinitionInput } from "@ccs/validation";
import { AppError } from "../errors/app-error.js";
import { AttemptModel, CaseModel } from "../models/index.js";
import type { AttemptActionInput } from "../validators/attempt.validator.js";
import { getActiveCatalogOrder, listCatalogOrders } from "./order-catalog.service.js";
import { publishAttemptUpdate } from "./realtime.service.js";

type AttemptDocument = InstanceType<typeof AttemptModel>;
type AttemptAction = AttemptActionInput["action"];
type OrderDefinition = CaseDefinitionInput["orders"][number];
type OrderQualifiers = Partial<Record<"route" | "dose" | "frequency" | "duration" | "priority", string>>;
type QualifierConditions = Partial<Record<keyof OrderQualifiers, string[]>>;

const qualifierKeys = ["route", "dose", "frequency", "duration", "priority"] as const;

export const matchesQualifierConditions = (
  selected: OrderQualifiers,
  conditions?: QualifierConditions
) => !conditions || qualifierKeys.every((qualifier) => {
  const allowed = conditions[qualifier];
  return !allowed?.length || (selected[qualifier] !== undefined && allowed.includes(selected[qualifier]));
});

const isClosed = (status: string) => ["completed", "expired"].includes(status);

type CaseEndCondition = NonNullable<CaseDefinitionInput["endConditions"]>[number];

const eventControlFields = (source: {
  priority?: number;
  eventTag?: string;
  allowedFromStateIds?: string[];
  blockedInStateIds?: string[];
  cancelPendingEventTags?: string[];
}) => ({
  priority: source.priority ?? 0,
  eventTag: source.eventTag,
  allowedFromStateIds: source.allowedFromStateIds,
  blockedInStateIds: source.blockedInStateIds,
  cancelPendingEventTags: source.cancelPendingEventTags
});

type ScoreReference = {
  actionType:
    | "order"
    | "exam"
    | "location"
    | "clinical_state"
    | "result"
    | "order_completed"
    | "order_discontinued";
  match: string;
  qualifierConditions?: QualifierConditions;
};

type ActionEvidence = {
  index: number;
  simulatedMinute: number;
};

const findActionEvidenceList = (
  attempt: AttemptDocument,
  definition: CaseDefinitionInput,
  reference: ScoreReference
): ActionEvidence[] => {
  const actions = attempt.actions as any[];
  const isOrderReference = ["order", "result", "order_completed", "order_discontinued"].includes(reference.actionType);
  const orderName = isOrderReference
    ? definition.orders.find((order) => order.id === reference.match)?.name
      ?? (attempt.orders as any[]).find((order) => order.definitionId === reference.match)?.name
    : undefined;

  const evidence = actions.flatMap((action, index) => {
    let matches = false;
    if (reference.actionType === "order") {
      matches = action.type === "order" && (
        action.match === reference.match ||
        (orderName && action.summary === `Ordered ${orderName}`)
      ) && matchesQualifierConditions(action, reference.qualifierConditions);
    } else if (["result", "order_completed", "order_discontinued"].includes(reference.actionType)) {
      matches = action.type === reference.actionType &&
        action.match === reference.match &&
        matchesQualifierConditions(action, reference.qualifierConditions);
    } else if (reference.actionType === "exam") {
      matches = action.type === "exam" && (
        action.matches?.includes(reference.match) ||
        action.summary.includes(reference.match)
      );
    } else if (reference.actionType === "location") {
      matches = action.type === "location" && (
        action.match === reference.match ||
        action.summary === `Changed location to ${reference.match}`
      );
    } else if (reference.actionType === "clinical_state") {
      matches = action.type === "system" && action.clinicalStateId === reference.match;
    }
    return matches
      ? [{
          index,
          simulatedMinute: reference.actionType === "result"
            ? action.collectedAt ?? action.simulatedMinute
            : action.simulatedMinute
        }]
      : [];
  });

  if (evidence.length) return evidence;

  // Legacy attempts may contain placed orders without structured action metadata.
  if (reference.actionType === "order") {
    return (attempt.orders as any[]).flatMap((order, index, orders) =>
      order.definitionId === reference.match
        && matchesQualifierConditions(order, reference.qualifierConditions)
        ? [{ index: Number.MAX_SAFE_INTEGER - orders.length + index, simulatedMinute: order.orderedAt }]
        : []
    );
  }
  if (reference.actionType === "result") {
    return (attempt.results as any[]).flatMap((result, index, results) => {
      const placed: any = (attempt.orders as any[]).find((order) => order.id === result.orderId);
      if (
        !placed ||
        placed.definitionId !== reference.match ||
        !matchesQualifierConditions(placed, reference.qualifierConditions)
      ) return [];
      return [{
        index: Number.MAX_SAFE_INTEGER - results.length + index,
        simulatedMinute: result.collectedAt ?? result.availableAt
      }];
    });
  }
  if (reference.actionType === "order_completed") {
    return (attempt.orders as any[]).flatMap((order, index, orders) =>
      order.definitionId === reference.match &&
        order.status === "completed" &&
        order.completedAt !== undefined &&
        matchesQualifierConditions(order, reference.qualifierConditions)
        ? [{ index: Number.MAX_SAFE_INTEGER - orders.length + index, simulatedMinute: order.completedAt }]
        : []
    );
  }
  return [];
};

const findActionEvidence = (
  attempt: AttemptDocument,
  definition: CaseDefinitionInput,
  reference: ScoreReference
) => findActionEvidenceList(attempt, definition, reference)[0] ?? null;

export const scoreAttempt = (attempt: AttemptDocument) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const met: string[] = [];
  const partial: string[] = [];
  const missed: string[] = [];
  const harmful: string[] = [];
  const domains = new Map<string, number>();
  let total = 0;

  for (const rule of definition.scoreRules) {
    const occurrences = findActionEvidenceList(attempt, definition, rule);
    const unqualifiedOccurrences = rule.qualifierConditions
      ? findActionEvidenceList(attempt, definition, { actionType: rule.actionType, match: rule.match })
      : occurrences;
    const minimumOccurrences = rule.minimumOccurrences ?? 1;
    let evidence = occurrences.length >= minimumOccurrences
      ? occurrences[minimumOccurrences - 1]
      : null;
    let qualifierMismatch = false;
    if (
      !evidence &&
      rule.qualifierConditions &&
      rule.pointsIfQualifierMismatch !== undefined &&
      unqualifiedOccurrences.length >= minimumOccurrences
    ) {
      evidence = unqualifiedOccurrences[minimumOccurrences - 1];
      qualifierMismatch = true;
    }

    if (evidence && rule.afterAction) {
      const afterAction = rule.afterAction;
      const anchors = findActionEvidenceList(attempt, definition, afterAction);
      const evidencePool = qualifierMismatch ? unqualifiedOccurrences : occurrences;
      evidence = evidencePool.find((candidate) => {
        const anchor = [...anchors].reverse().find((item) => item.index < candidate.index);
        if (!anchor) return false;
        const delay = candidate.simulatedMinute - anchor.simulatedMinute;
        if (afterAction.minimumDelayMinutes !== undefined && delay < afterAction.minimumDelayMinutes) return false;
        if (afterAction.maximumDelayMinutes !== undefined && delay > afterAction.maximumDelayMinutes) return false;
        return true;
      }) ?? null;
    }
    if (!evidence) {
      if (rule.points > 0) missed.push(rule.label);
      continue;
    }

    let awardedPoints = qualifierMismatch ? rule.pointsIfQualifierMismatch ?? 0 : rule.points;
    if (rule.points > 0 && rule.sequence) {
      const sequencePassed = rule.sequence.requiredPriorActions.every((reference) => {
        const prerequisite = findActionEvidence(attempt, definition, reference);
        return prerequisite !== null &&
          prerequisite.index < evidence.index &&
          prerequisite.simulatedMinute <= evidence.simulatedMinute;
      });
      if (!sequencePassed) awardedPoints = rule.sequence.pointsIfViolated;
    }

    if (rule.points > 0 && awardedPoints === rule.points && rule.timing) {
      if (evidence.simulatedMinute > rule.timing.fullCreditByMinute) {
        awardedPoints = rule.timing.partialCreditByMinute !== undefined &&
          evidence.simulatedMinute <= rule.timing.partialCreditByMinute
          ? rule.timing.partialCreditPoints ?? 0
          : 0;
      }
    }

    total += awardedPoints;
    domains.set(rule.domain, (domains.get(rule.domain) ?? 0) + awardedPoints);
    if (awardedPoints < 0) {
      harmful.push(rule.label);
    } else if (awardedPoints === rule.points) {
      met.push(rule.label);
    } else if (awardedPoints > 0) {
      partial.push(`${rule.label} (${awardedPoints}/${rule.points} points)`);
    } else {
      missed.push(rule.label);
    }
  }

  return {
    total: Math.max(0, Math.min(100, total)),
    domains: [...domains].map(([label, score]) => ({ label, score: Math.max(0, score), max: 100 })),
    ideal: met,
    partial,
    missed,
    harmful,
    rationale: definition.feedback
  };
};

export const enterFinalOrders = (
  attempt: AttemptDocument,
  options: {
    reason: string;
    conditionId?: string;
    finalOrderMinutes: number;
    now?: number;
    preserveRealTimeEndsAt?: boolean;
  }
) => {
  if (attempt.status !== "active") return false;
  const now = options.now ?? Date.now();
  attempt.status = "final_orders";
  attempt.finalOrdersStartsAt = new Date(now);
  if (!options.preserveRealTimeEndsAt) {
    attempt.realTimeEndsAt = new Date(now + options.finalOrderMinutes * 60_000);
  }
  attempt.finalOrdersTriggeredAt = new Date(now);
  attempt.endConditionId = options.conditionId;
  attempt.endReason = options.reason;
  attempt.activeFinalOrderMinutes = options.finalOrderMinutes;
  attempt.actions.push({
    id: crypto.randomUUID(),
    type: "system",
    simulatedMinute: attempt.simulatedMinute,
    summary: `Case-ending phase started: ${options.reason}`,
    internal: true
  });
  return true;
};

const matchesCaseEndCondition = (attempt: AttemptDocument, endCondition: CaseEndCondition) => {
  const conditions = endCondition.conditions;
  if (conditions.clinicalStateId && conditions.clinicalStateId !== attempt.currentClinicalStateId) return false;
  if (conditions.location && conditions.location !== attempt.location) return false;
  if (
    conditions.minimumSimulatedMinute !== undefined &&
    attempt.simulatedMinute < conditions.minimumSimulatedMinute
  ) return false;
  const placedOrderIds = new Set(
    (attempt.orders as any[])
      .filter((order) => order.status !== "discontinued")
      .map((order) => order.definitionId)
  );
  return (conditions.requiredOrderIds ?? []).every((orderId) => placedOrderIds.has(orderId));
};

export const evaluateCaseEndConditions = (
  attempt: AttemptDocument,
  now = Date.now()
) => {
  if (attempt.status !== "active") return null;
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const matched = (definition.endConditions ?? []).find((condition) =>
    matchesCaseEndCondition(attempt, condition)
  );
  if (!matched) return null;
  enterFinalOrders(attempt, {
    reason: matched.reason,
    conditionId: matched.id,
    finalOrderMinutes: matched.finalOrderMinutes ?? definition.finalOrderMinutes,
    now
  });
  return matched;
};

const expireAttempt = (attempt: AttemptDocument, now: number) => {
  if (isClosed(attempt.status)) return;
  attempt.status = "expired";
  attempt.completedAt = new Date(now);
  attempt.completionReason = "time_expired";
  attempt.actions.push({
    id: crypto.randomUUID(),
    type: "system",
    simulatedMinute: attempt.simulatedMinute,
    summary: "Case completed because real time expired",
    internal: true
  });
  attempt.scoreReport = scoreAttempt(attempt);
};

export const updateDeadline = (attempt: AttemptDocument, now = Date.now()) => {
  if (isClosed(attempt.status)) return;

  if (now >= attempt.realTimeEndsAt.getTime()) {
    expireAttempt(attempt, now);
  } else if (attempt.status === "active" && now >= attempt.finalOrdersStartsAt.getTime()) {
    const definition = attempt.caseSnapshot as CaseDefinitionInput;
    enterFinalOrders(attempt, {
      reason: "Maximum allotted case-management time elapsed",
      finalOrderMinutes: definition.finalOrderMinutes,
      now: attempt.finalOrdersStartsAt.getTime(),
      preserveRealTimeEndsAt: true
    });
  }
};

export const toStudentCase = (definition: CaseDefinitionInput) => ({
  slug: definition.slug,
  title: definition.title,
  specialty: definition.specialty,
  difficulty: definition.difficulty,
  durationMinutes: definition.durationMinutes,
  finalOrderMinutes: definition.finalOrderMinutes,
  opening: definition.opening,
  appearance: definition.appearance,
  startingLocation: definition.startingLocation,
  allowedLocations: definition.allowedLocations,
  history: definition.history,
  vitals: definition.vitals,
  exam: definition.exam
});

export const serializeStudentPlacedOrder = (order: any) => ({
  id: order.id,
  definitionId: order.definitionId,
  name: order.name,
  category: order.category,
  route: order.route,
  dose: order.dose,
  frequency: order.frequency,
  duration: order.duration,
  priority: order.priority,
  orderedAt: order.orderedAt,
  reportAt: order.reportAt,
  status: order.status
});

export const serializeAttempt = (attempt: AttemptDocument) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  return {
    attemptId: attempt.id,
    revision: attempt.revision,
    serverTime: new Date().toISOString(),
    realTimeEndsAt: attempt.realTimeEndsAt,
    finalOrdersStartsAt: attempt.finalOrdersStartsAt,
    finalOrdersTriggeredAt: attempt.finalOrdersTriggeredAt,
    endConditionId: attempt.endConditionId,
    endReason: attempt.endReason,
    activeFinalOrderMinutes: attempt.activeFinalOrderMinutes ?? definition.finalOrderMinutes,
    completionReason: attempt.completionReason,
    status: attempt.status,
    simulatedMinute: attempt.simulatedMinute,
    location: attempt.location,
    currentClinicalStateId: attempt.currentClinicalStateId,
    currentVitals: attempt.currentVitals ?? definition.vitals,
    vitalSignsLog: attempt.vitalSignsLog?.length
      ? attempt.vitalSignsLog
      : [{ simulatedMinute: 0, vitals: definition.vitals }],
    currentAppearance: attempt.currentAppearance ?? definition.appearance,
    case: toStudentCase(definition),
    orders: (attempt.orders as any[]).map((order) => serializeStudentPlacedOrder({
      ...order,
      category: order.category ?? definition.orders.find((item) => item.id === order.definitionId)?.category
    })),
    results: attempt.results,
    actions: isClosed(attempt.status)
      ? attempt.actions
      : (attempt.actions as any[]).filter((action) => !action.internal),
    progressNotes: attempt.progressNotes ?? [],
    scoreReport: attempt.scoreReport ?? null,
    notifications: [
      ...(attempt.status === "final_orders"
        ? [{
            type: "FINAL_ORDERS",
            message: `${attempt.activeFinalOrderMinutes ?? definition.finalOrderMinutes} minutes remain for final orders.${attempt.endReason ? ` ${attempt.endReason}` : ""}`
          }]
        : []),
      ...(attempt.patientNotifications ?? [])
    ]
  };
};

const deduplicateRuntimeHistory = (attempt: AttemptDocument) => {
  const seenSystemActions = new Set<string>();
  const actions = (attempt.actions as any[]).filter((action) => {
    if (action.type !== "system") return true;
    const key = `${action.simulatedMinute}:${action.summary}`;
    if (seenSystemActions.has(key)) return false;
    seenSystemActions.add(key);
    return true;
  });
  if (actions.length !== attempt.actions.length) {
    attempt.actions = actions as any;
    attempt.markModified("actions");
  }

  const seenNotes = new Set<string>();
  const notes = (attempt.progressNotes as any[]).filter((note) => {
    const key = `${note.simulatedMinute}:${note.text}`;
    if (seenNotes.has(key)) return false;
    seenNotes.add(key);
    return true;
  });
  if (notes.length !== attempt.progressNotes.length) {
    attempt.progressNotes = notes as any;
    attempt.markModified("progressNotes");
  }

  const seenNotifications = new Set<string>();
  const notifications = (attempt.patientNotifications as any[]).filter((notification) => {
    const key = notification.id ?? `${notification.simulatedMinute}:${notification.message}`;
    if (seenNotifications.has(key)) return false;
    seenNotifications.add(key);
    return true;
  });
  if (notifications.length !== attempt.patientNotifications.length) {
    attempt.patientNotifications = notifications as any;
    attempt.markModified("patientNotifications");
  }

  const seenVitalSigns = new Set<string>();
  const vitalSigns = (attempt.vitalSignsLog as any[]).filter((entry) => {
    const key = `${entry.simulatedMinute}:${JSON.stringify(entry.vitals)}`;
    if (seenVitalSigns.has(key)) return false;
    seenVitalSigns.add(key);
    return true;
  });
  if (vitalSigns.length !== attempt.vitalSignsLog.length) {
    attempt.vitalSignsLog = vitalSigns as any;
    attempt.markModified("vitalSignsLog");
  }
};

const captureRealtimeState = (attempt: AttemptDocument) => ({
  resultCount: attempt.results?.length ?? 0,
  notificationCount: attempt.patientNotifications?.length ?? 0,
  clinicalStateId: attempt.currentClinicalStateId,
  status: attempt.status
});

const publishRealtimeChanges = (
  attempt: AttemptDocument,
  previous: ReturnType<typeof captureRealtimeState>
) => {
  const state = serializeAttempt(attempt);
  publishAttemptUpdate(attempt.id, state, {
    resultAdded: (attempt.results?.length ?? 0) > previous.resultCount,
    patientUpdated: (attempt.patientNotifications?.length ?? 0) > previous.notificationCount,
    vitalsUpdated: attempt.currentClinicalStateId !== previous.clinicalStateId,
    enteredFinalOrders: previous.status !== "final_orders" && attempt.status === "final_orders",
    completed: !isClosed(previous.status) && isClosed(attempt.status)
  });
  return state;
};

export const startAttempt = async (caseId: string, userId: string) => {
  const caseEntry = await CaseModel.findOne({ _id: caseId, status: "published", deletedAt: null }).lean();
  if (!caseEntry) throw new AppError(404, "Published case not found");

  const existing = await AttemptModel.findOne({
    userId,
    caseVersionId: caseEntry._id,
    status: { $in: ["active", "final_orders"] }
  });
  if (existing) {
    ensureAttemptClinicalRuntime(existing);
    resolveDueEvents(existing, existing.simulatedMinute);
    updateDeadline(existing);
    await existing.save();
    return { attempt: serializeAttempt(existing), created: false };
  }

  const definition = caseEntry.definition as CaseDefinitionInput;
  const initialState = definition.clinicalStates?.find(
    (state) => state.id === definition.initialClinicalStateId
  );
  const totalMs = (definition.durationMinutes + definition.finalOrderMinutes) * 60_000;
  const initialPendingEvents = (definition.transitionRules ?? [])
    .filter((rule) => rule.trigger.type === "time_reached")
    .map((rule) => ({
      id: crypto.randomUUID(),
      ruleId: rule.id,
      type: "transition_rule",
      dueMinute: (rule.trigger.atMinute ?? 0) + (rule.delayMinutes ?? 0),
      targetStateId: rule.targetStateId,
      progressNote: rule.progressNote,
      notification: rule.notification,
      endCase: rule.endCase,
      conditions: rule.conditions,
      ...eventControlFields(rule),
      status: "pending"
    }));
  const attempt = await AttemptModel.create({
    userId,
    caseVersionId: caseEntry._id,
    caseSnapshot: definition,
    realTimeEndsAt: new Date(Date.now() + totalMs),
    finalOrdersStartsAt: new Date(Date.now() + definition.durationMinutes * 60_000),
    location: definition.startingLocation,
    currentClinicalStateId: initialState?.id,
    currentVitals: initialState?.vitals ?? definition.vitals,
    vitalSignsLog: [{ simulatedMinute: 0, vitals: initialState?.vitals ?? definition.vitals }],
    currentAppearance: initialState?.appearance ?? definition.appearance,
    progressNotes: initialState?.progressNote
      ? [{ id: crypto.randomUUID(), simulatedMinute: 0, text: initialState.progressNote }]
      : [],
    pendingEvents: initialPendingEvents,
    triggeredRuleIds: initialPendingEvents.map((event) => event.ruleId)
  });

  return { attempt: serializeAttempt(attempt), created: true };
};

export const listAttempts = async (userId: string) => {
  const attempts = await AttemptModel.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .select("status caseVersionId caseSnapshot.title caseSnapshot.specialty caseSnapshot.version createdAt completedAt simulatedMinute scoreReport.total scoreReport.domains")
    .lean();
  return attempts.map(attempt => ({
    _id: String(attempt._id), status: attempt.status, caseVersionId: String(attempt.caseVersionId),
    caseSnapshot: { title: attempt.caseSnapshot?.title, specialty: attempt.caseSnapshot?.specialty, version: attempt.caseSnapshot?.version },
    createdAt: attempt.createdAt, completedAt: attempt.completedAt, simulatedMinute: attempt.simulatedMinute,
    scoreReport: ["completed", "expired"].includes(attempt.status) ? attempt.scoreReport ?? null : null
  }));
};

const requireAttempt = async (id: string, userId: string) => {
  const attempt = await AttemptModel.findOne({ _id: id, userId });
  if (!attempt) throw new AppError(404, "Attempt not found");
  return attempt;
};

const matchesOrderSearch = (order: OrderDefinition, search: string) =>
  `${order.id} ${order.name} ${order.aliases.join(" ")}`
    .toLowerCase()
    .includes(search.trim().toLowerCase());

const normalizeOrderDefinition = (order: OrderDefinition): OrderDefinition => ({
  id: order.id,
  name: order.name,
  aliases: order.aliases ?? [],
  category: order.category,
  route: order.route,
  dose: order.dose,
  frequency: order.frequency,
  duration: order.duration,
  priority: order.priority,
  resultDelayMinutes: order.resultDelayMinutes
});

type ResultDefinition = CaseDefinitionInput["results"][number];

export const resolveCaseResultValue = (
  result: ResultDefinition,
  clinicalStateId?: string | null
) => result.variants?.find((variant) => variant.clinicalStateId === clinicalStateId)?.value
  ?? result.value;

export const mergeSearchableOrders = (
  caseOrders: OrderDefinition[],
  catalogOrders: OrderDefinition[],
  search: string,
  limit = 12
) => {
  const matches = new Map<string, OrderDefinition>();
  for (const order of catalogOrders) {
    if (matchesOrderSearch(order, search)) matches.set(order.id, normalizeOrderDefinition(order));
  }
  // A configured order uses the frozen case-version definition even if the live catalog changes.
  for (const order of caseOrders) {
    if (matchesOrderSearch(order, search)) matches.set(order.id, normalizeOrderDefinition(order));
  }
  return [...matches.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, limit);
};

export const selectAttemptOrder = (
  caseOrders: OrderDefinition[],
  catalogOrder: OrderDefinition | null,
  orderId: string
) => caseOrders.find((order) => order.id === orderId) ??
  (catalogOrder?.id === orderId ? normalizeOrderDefinition(catalogOrder) : null);

export const searchAttemptOrders = async (id: string, userId: string, search: string) => {
  const attempt = await requireAttempt(id, userId);
  if (isClosed(attempt.status)) throw new AppError(409, "Attempt is closed");
  const normalizedSearch = search.trim();
  if (normalizedSearch.length < 2) return [];

  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const catalogOrders = await listCatalogOrders(normalizedSearch, false, 20);
  return mergeSearchableOrders(definition.orders, catalogOrders, normalizedSearch);
};

type OrderBehavior = NonNullable<CaseDefinitionInput["orderBehaviors"]>[number];
type OrderSchedule = NonNullable<OrderBehavior["schedule"]>;

export const selectOrderBehavior = (
  behaviors: OrderBehavior[] | undefined,
  orderId: string,
  selected: OrderQualifiers
) => (behaviors ?? [])
  .map((behavior, index) => ({ behavior, index }))
  .filter(({ behavior }) =>
    behavior.orderId === orderId && matchesQualifierConditions(selected, behavior.qualifierConditions)
  )
  .sort((left, right) => {
    const leftSpecificity = qualifierKeys.filter((key) => left.behavior.qualifierConditions?.[key]?.length).length;
    const rightSpecificity = qualifierKeys.filter((key) => right.behavior.qualifierConditions?.[key]?.length).length;
    return rightSpecificity - leftSpecificity || left.index - right.index;
  })[0]?.behavior;

const behaviorHasClinicalResponse = (behavior?: OrderBehavior) => Boolean(
  behavior?.targetStateId || behavior?.progressNote || behavior?.notification
);

const nextScheduledMinute = (
  schedule: OrderSchedule | undefined,
  orderedAt: number,
  currentDueMinute: number,
  nextOccurrence: number,
  enabled: boolean
) => {
  if (!schedule || !enabled) return null;
  if (schedule.maximumOccurrences !== undefined && nextOccurrence > schedule.maximumOccurrences) return null;
  const nextDueMinute = currentDueMinute + schedule.intervalMinutes;
  if (schedule.durationMinutes !== undefined && nextDueMinute > orderedAt + schedule.durationMinutes) return null;
  return nextDueMinute;
};

const findAvailablePrerequisites = (attempt: AttemptDocument, requiredOrderIds: string[]) =>
  requiredOrderIds.map((requiredOrderId) =>
    [...(attempt.orders as any[])]
      .reverse()
      .find((order) => order.definitionId === requiredOrderId && order.status !== "discontinued")
  );

export const scheduleOrderClinicalResponse = (
  attempt: AttemptDocument,
  placedOrder: any,
  behavior: OrderBehavior
) => {
  if (!behaviorHasClinicalResponse(behavior)) return false;
  const alreadyHandled = (attempt.pendingEvents as any[]).some(
    (event) => event.sourceOrderId === placedOrder.id
  ) || (behavior.targetStateId && attempt.currentClinicalStateId === behavior.targetStateId);
  if (alreadyHandled || placedOrder.status === "discontinued") return false;

  const requiredOrderIds = behavior.treatmentPrerequisites?.requiredOrderIds ?? [];
  const prerequisites = findAvailablePrerequisites(attempt, requiredOrderIds);
  const blocked = prerequisites.some((order) => !order);
  const activationMinute = Math.max(
    placedOrder.orderedAt,
    ...prerequisites.filter(Boolean).map((order) => order.orderedAt)
  );
  const dueMinute = activationMinute + (behavior.responseDelayMinutes ?? 0);
  if (
    !blocked &&
    behavior.schedule?.durationMinutes !== undefined &&
    dueMinute > placedOrder.orderedAt + behavior.schedule.durationMinutes
  ) return false;
  if (blocked) placedOrder.status = "held";
  attempt.pendingEvents.push({
    id: crypto.randomUUID(),
    type: "clinical_response",
    dueMinute: blocked
      ? undefined
      : dueMinute,
    responseDelayMinutes: behavior.responseDelayMinutes ?? 0,
    occurrence: 1,
    requiredOrderIds,
    sourceOrderId: placedOrder.id,
    targetStateId: behavior.targetStateId,
    progressNote: behavior.progressNote,
    notification: behavior.notification,
    ...eventControlFields(behavior),
    status: blocked ? "blocked" : "pending"
  });
  attempt.markModified?.("orders");
  attempt.markModified?.("pendingEvents");
  return true;
};

export const activateBlockedTreatmentResponses = (attempt: AttemptDocument) => {
  let changed = false;
  for (const event of attempt.pendingEvents as any[]) {
    if (event.status !== "blocked") continue;
    const sourceOrder: any = attempt.orders.find((order: any) => order.id === event.sourceOrderId);
    if (!sourceOrder || sourceOrder.status === "discontinued") {
      event.status = "cancelled";
      changed = true;
      continue;
    }
    const prerequisites = findAvailablePrerequisites(attempt, event.requiredOrderIds ?? []);
    if (prerequisites.some((order) => !order)) continue;

    const activationMinute = Math.max(
      sourceOrder.orderedAt,
      ...prerequisites.filter(Boolean).map((order) => order.orderedAt)
    );
    event.dueMinute = activationMinute + (event.responseDelayMinutes ?? 0);
    if (
      sourceOrder.scheduleSnapshot?.durationMinutes !== undefined &&
      event.dueMinute > sourceOrder.orderedAt + sourceOrder.scheduleSnapshot.durationMinutes
    ) {
      event.status = "cancelled";
      sourceOrder.responseStreamComplete = true;
      maybeCompletePlacedOrder(attempt, sourceOrder, attempt.simulatedMinute);
      changed = true;
      continue;
    }
    event.status = "pending";
    sourceOrder.status = "active";
    changed = true;
  }
  if (changed) {
    attempt.markModified?.("orders");
    attempt.markModified?.("pendingEvents");
  }
};

export const ensureAttemptClinicalRuntime = (attempt: AttemptDocument) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const initialState = definition.clinicalStates?.find(
    (state) => state.id === definition.initialClinicalStateId
  );

  attempt.pendingEvents ??= [] as any;
  attempt.progressNotes ??= [] as any;
  attempt.patientNotifications ??= [] as any;
  attempt.triggeredRuleIds ??= [] as any;
  attempt.vitalSignsLog ??= [] as any;
  attempt.currentClinicalStateId ??= initialState?.id;
  attempt.currentVitals ??= initialState?.vitals ?? definition.vitals;
  attempt.currentAppearance ??= initialState?.appearance ?? definition.appearance;
  if (!attempt.vitalSignsLog.length) {
    attempt.vitalSignsLog.push({ simulatedMinute: 0, vitals: attempt.currentVitals });
  }
  deduplicateRuntimeHistory(attempt);

  for (const placed of attempt.orders as any[]) {
    const behavior = selectOrderBehavior(definition.orderBehaviors, placed.definitionId, placed);
    if (behavior) scheduleOrderClinicalResponse(attempt, placed, behavior);
  }
  activateBlockedTreatmentResponses(attempt);

  for (const rule of definition.transitionRules ?? []) {
    if (rule.trigger.type !== "time_reached" || attempt.triggeredRuleIds.includes(rule.id)) continue;
    attempt.pendingEvents.push({
      id: crypto.randomUUID(),
      ruleId: rule.id,
      type: "transition_rule",
      dueMinute: (rule.trigger.atMinute ?? 0) + (rule.delayMinutes ?? 0),
      targetStateId: rule.targetStateId,
      progressNote: rule.progressNote,
      notification: rule.notification,
      endCase: rule.endCase,
      conditions: rule.conditions,
      ...eventControlFields(rule),
      status: "pending"
    });
    attempt.triggeredRuleIds.push(rule.id);
  }
};

export const getAttemptState = async (id: string, userId: string) => {
  const attempt = await requireAttempt(id, userId);
  const previous = captureRealtimeState(attempt);
  ensureAttemptClinicalRuntime(attempt);
  if (!isClosed(attempt.status)) resolveDueEvents(attempt, attempt.simulatedMinute);
  updateDeadline(attempt);
  await attempt.save();
  return publishRealtimeChanges(attempt, previous);
};

export const applyClinicalAction = (
  attempt: AttemptDocument,
  action: AttemptAction,
  resolvedOrder?: OrderDefinition | null
) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  let summary = "";
  let lifecycleOrder: any = null;

  if (action.type === "PERFORM_EXAM") {
    attempt.simulatedMinute += action.sections.length * 2;
    summary = `Examined: ${action.sections.join(", ")}`;
  }
  if (action.type === "PLACE_ORDER") {
    const order = resolvedOrder ?? definition.orders.find((item) => item.id === action.orderId);
    if (!order) throw new AppError(400, "Order is unavailable");
    for (const qualifier of qualifierKeys) {
      const allowed = order[qualifier];
      const selected = action[qualifier];
      if (allowed?.length && !selected) throw new AppError(400, `${qualifier} is required for ${order.name}`);
      if (selected && !allowed?.includes(selected)) {
        throw new AppError(400, `Invalid ${qualifier} for ${order.name}`);
      }
    }
    const behavior = selectOrderBehavior(definition.orderBehaviors, order.id, action);
    const caseConfigured = definition.orders.some((item) => item.id === order.id);
    if (behavior?.allowedLocations && !behavior.allowedLocations.includes(attempt.location as any)) {
      throw new AppError(400, `${order.name} is unavailable at the current location`);
    }
    const processingMinutes = caseConfigured
      ? behavior?.processingMinutes ?? order.resultDelayMinutes
      : undefined;
    const resultDefinition = definition.results.find((result) => result.orderId === order.id);
    const hasResultStream = Boolean(resultDefinition && processingMinutes !== undefined);
    const hasClinicalResponseStream = behaviorHasClinicalResponse(behavior);
    const placedOrderId = crypto.randomUUID();
    const scheduledReportAt = processingMinutes === undefined
      ? undefined
      : attempt.simulatedMinute + processingMinutes;
    const firstResultWithinDuration = behavior?.schedule?.durationMinutes === undefined ||
      scheduledReportAt === undefined ||
      scheduledReportAt <= attempt.simulatedMinute + behavior.schedule.durationMinutes;
    const placedOrder = {
      id: placedOrderId,
      definitionId: order.id,
      name: order.name,
      category: order.category,
      definitionSnapshot: normalizeOrderDefinition(order),
      caseConfigured,
      resultValueSnapshot: resultDefinition
        ? resolveCaseResultValue(resultDefinition, attempt.currentClinicalStateId)
        : undefined,
      resultCategorySnapshot: resultDefinition?.category,
      route: action.route,
      dose: action.dose,
      frequency: action.frequency,
      duration: action.duration,
      priority: action.priority,
      orderedAt: attempt.simulatedMinute,
      scheduleSnapshot: behavior?.schedule,
      hasResultStream,
      hasClinicalResponseStream,
      processingMinutesSnapshot: processingMinutes,
      resultOccurrencesReleased: 0,
      responseOccurrencesResolved: 0,
      resultStreamComplete: !hasResultStream || !firstResultWithinDuration,
      responseStreamComplete: !hasClinicalResponseStream,
      reportAt: hasResultStream && firstResultWithinDuration ? scheduledReportAt : undefined,
      status: "active"
    };
    attempt.orders.push(placedOrder);
    if (behavior && hasClinicalResponseStream) {
      const scheduled = scheduleOrderClinicalResponse(attempt, placedOrder, behavior);
      if (!scheduled) placedOrder.responseStreamComplete = true;
    }
    if (
      behavior?.schedule?.durationMinutes !== undefined &&
      !hasResultStream &&
      !hasClinicalResponseStream
    ) {
      attempt.pendingEvents.push({
        id: crypto.randomUUID(),
        type: "order_completion",
        sourceOrderId: placedOrder.id,
        dueMinute: placedOrder.orderedAt + behavior.schedule.durationMinutes,
        status: "pending"
      });
    }
    maybeCompletePlacedOrder(attempt, placedOrder, attempt.simulatedMinute);
    activateBlockedTreatmentResponses(attempt);
    scheduleTransitionRules(attempt, "order_placed", order.id);
    summary = `Ordered ${order.name}`;
  }
  if (action.type === "DISCONTINUE_ORDER") {
    const order: any = attempt.orders.find((item: any) => item.id === action.placedOrderId);
    lifecycleOrder = order;
    discontinuePlacedOrder(attempt, order);
    summary = order ? `Discontinued ${order.name}` : "Order discontinued";
  }
  if (action.type === "ADVANCE_TIME") summary = `Advanced simulated time by ${action.minutes} minutes`;
  if (action.type === "ADVANCE_TO_NEXT_RESULT") summary = "Advanced simulated time to the next available result";
  if (action.type === "ADVANCE_TO_NEXT_EVENT") summary = "Advanced simulated time until called or needed";
  if (action.type === "ADVANCE_TO_SIMULATED_MINUTE") summary = "Advanced simulated time to a scheduled appointment";
  if (action.type === "CHANGE_LOCATION") {
    if (!definition.allowedLocations.includes(action.location as any)) {
      throw new AppError(400, "Location is unavailable");
    }
    const previousLocation = attempt.location;
    const transfer = definition.locationTransfers?.find(
      (item) => item.from === previousLocation && item.to === action.location
    );
    attempt.location = action.location;
    attempt.simulatedMinute += transfer?.minutes ?? 0;
    for (const placed of attempt.orders as any[]) {
      if (!["active", "held"].includes(placed.status)) continue;
      const behavior = selectOrderBehavior(definition.orderBehaviors, placed.definitionId, placed);
      if (
        behavior?.schedule?.cancelWhenUnavailable &&
        behavior.allowedLocations?.length &&
        !behavior.allowedLocations.includes(action.location as any)
      ) {
        if (discontinuePlacedOrder(attempt, placed)) {
          attempt.actions.push({
            id: crypto.randomUUID(),
            type: "order_discontinued",
            simulatedMinute: attempt.simulatedMinute,
            summary: `Discontinued ${placed.name} after transfer to ${action.location}`,
            match: placed.definitionId,
            placedOrderId: placed.id,
            route: placed.route,
            dose: placed.dose,
            frequency: placed.frequency,
            duration: placed.duration,
            priority: placed.priority,
            internal: true
          });
        }
      }
    }
    scheduleTransitionRules(attempt, "location_changed", action.location);
    summary = `Changed location to ${action.location}`;
  }
  if (action.type === "FINISH_CASE") {
    attempt.status = "completed";
    attempt.completedAt = new Date();
    attempt.completionReason = "student_finished";
    attempt.scoreReport = scoreAttempt(attempt);
    summary = "Case completed";
  }

  const actionOrderDetails = action.type === "PLACE_ORDER" ? action : lifecycleOrder;
  attempt.actions.push({
    id: crypto.randomUUID(),
    type: action.type === "PLACE_ORDER"
      ? "order"
      : action.type === "DISCONTINUE_ORDER"
        ? "order_discontinued"
      : action.type === "PERFORM_EXAM"
        ? "exam"
          : action.type === "CHANGE_LOCATION"
            ? "location"
          : ["ADVANCE_TIME", "ADVANCE_TO_NEXT_RESULT", "ADVANCE_TO_NEXT_EVENT", "ADVANCE_TO_SIMULATED_MINUTE"].includes(action.type)
            ? "advance"
            : "system",
    simulatedMinute: attempt.simulatedMinute,
    summary,
    match: action.type === "PLACE_ORDER"
      ? action.orderId
      : action.type === "DISCONTINUE_ORDER"
        ? lifecycleOrder?.definitionId
      : action.type === "CHANGE_LOCATION"
        ? action.location
        : undefined,
    matches: action.type === "PERFORM_EXAM" ? action.sections : undefined,
    route: actionOrderDetails?.route,
    dose: actionOrderDetails?.dose,
    frequency: actionOrderDetails?.frequency,
    duration: actionOrderDetails?.duration,
    priority: actionOrderDetails?.priority,
    placedOrderId: lifecycleOrder?.id
  });
};

const scheduleTransitionRules = (
  attempt: AttemptDocument,
  triggerType: "order_placed" | "order_completed" | "location_changed",
  match: string
) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const placedOrderIds = new Set((attempt.orders as any[]).map((order) => order.definitionId));
  for (const rule of definition.transitionRules ?? []) {
    const isDirectMatch = rule.trigger.type === triggerType && (!rule.trigger.match || rule.trigger.match === match);
    const isCombination = triggerType === "order_placed" &&
      rule.trigger.type === "action_combination" &&
      rule.trigger.requiredOrderIds?.every((orderId) => placedOrderIds.has(orderId));
    if (!isDirectMatch && !isCombination) continue;
    if ((rule.once ?? true) && (attempt.triggeredRuleIds ?? []).includes(rule.id)) continue;
    if (rule.conditions?.location && rule.conditions.location !== attempt.location) continue;
    if (rule.conditions?.clinicalStateId && rule.conditions.clinicalStateId !== attempt.currentClinicalStateId) continue;

    attempt.pendingEvents.push({
      id: crypto.randomUUID(),
      ruleId: rule.id,
      type: "transition_rule",
      dueMinute: attempt.simulatedMinute + (rule.delayMinutes ?? 0),
      targetStateId: rule.targetStateId,
      progressNote: rule.progressNote,
      notification: rule.notification,
      endCase: rule.endCase,
      conditions: rule.conditions,
      ...eventControlFields(rule),
      status: "pending"
    });
    attempt.triggeredRuleIds.push(rule.id);
  }
};

const maybeCompletePlacedOrder = (
  attempt: AttemptDocument,
  placed: any,
  completedMinute: number,
  force = false
) => {
  if (!placed || placed.status === "discontinued" || placed.status === "completed") return;
  const hasManagedStream = placed.hasResultStream || placed.hasClinicalResponseStream;
  if (!force && !hasManagedStream) return;
  if (!force && !(placed.resultStreamComplete && placed.responseStreamComplete)) return;
  placed.status = "completed";
  placed.completedAt = completedMinute;
  placed.reportAt = undefined;
  if (!placed.completionActionRecorded) {
    attempt.actions.push({
      id: crypto.randomUUID(),
      type: "order_completed",
      simulatedMinute: completedMinute,
      summary: `Completed ${placed.name}`,
      match: placed.definitionId,
      placedOrderId: placed.id,
      route: placed.route,
      dose: placed.dose,
      frequency: placed.frequency,
      duration: placed.duration,
      priority: placed.priority,
      internal: true
    });
    placed.completionActionRecorded = true;
  }
  if (!placed.completionRuleTriggered) {
    scheduleTransitionRules(attempt, "order_completed", placed.definitionId);
    placed.completionRuleTriggered = true;
  }
  attempt.markModified?.("orders");
};

export const discontinuePlacedOrder = (attempt: AttemptDocument, placed: any) => {
  if (!placed || !["active", "held"].includes(placed.status)) return false;
  placed.status = "discontinued";
  placed.reportAt = undefined;
  placed.resultStreamComplete = true;
  placed.responseStreamComplete = true;
  for (const event of attempt.pendingEvents as any[]) {
    if (event.sourceOrderId === placed.id && ["pending", "blocked"].includes(event.status)) {
      event.status = "cancelled";
    }
  }
  attempt.markModified?.("orders");
  attempt.markModified?.("pendingEvents");
  return true;
};

const finishClinicalResponseOccurrence = (
  attempt: AttemptDocument,
  event: any,
  completedMinute: number
) => {
  const source: any = attempt.orders.find((order: any) => order.id === event.sourceOrderId);
  if (!source || source.status === "discontinued") return;
  const occurrence = event.occurrence ?? 1;
  source.responseOccurrencesResolved = Math.max(source.responseOccurrencesResolved ?? 0, occurrence);
  const schedule = source.scheduleSnapshot as OrderSchedule | undefined;
  const nextOccurrence = occurrence + 1;
  const nextDueMinute = nextScheduledMinute(
    schedule,
    source.orderedAt,
    completedMinute,
    nextOccurrence,
    schedule?.repeatClinicalResponse ?? false
  );
  if (nextDueMinute !== null) {
    attempt.pendingEvents.push({
      id: crypto.randomUUID(),
      type: "clinical_response",
      dueMinute: nextDueMinute,
      responseDelayMinutes: event.responseDelayMinutes,
      occurrence: nextOccurrence,
      requiredOrderIds: event.requiredOrderIds,
      sourceOrderId: source.id,
      targetStateId: event.targetStateId,
      progressNote: event.progressNote,
      notification: event.notification,
      conditions: event.conditions,
      priority: event.priority,
      eventTag: event.eventTag,
      allowedFromStateIds: event.allowedFromStateIds,
      blockedInStateIds: event.blockedInStateIds,
      cancelPendingEventTags: event.cancelPendingEventTags,
      status: "pending"
    });
  } else {
    source.responseStreamComplete = true;
    maybeCompletePlacedOrder(attempt, source, completedMinute);
  }
  attempt.markModified?.("orders");
  attempt.markModified?.("pendingEvents");
};

export const resolveDueEvents = (attempt: AttemptDocument, targetMinute: number) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  while (true) {
    const dueItems: Array<{ dueMinute: number; kind: "result" | "response" | "completion"; item: any }> = [];
    for (const placed of attempt.orders as any[]) {
      if (placed.status === "active" && placed.reportAt !== undefined && placed.reportAt <= targetMinute) {
        dueItems.push({ dueMinute: placed.reportAt, kind: "result", item: placed });
      }
    }
    for (const event of attempt.pendingEvents as any[]) {
      if (event.status === "pending" && event.dueMinute <= targetMinute) {
        dueItems.push({
          dueMinute: event.dueMinute,
          kind: event.type === "order_completion" ? "completion" : "response",
          item: event
        });
      }
    }
    dueItems.sort((left, right) =>
      left.dueMinute - right.dueMinute ||
      (right.item.priority ?? 0) - (left.item.priority ?? 0) ||
      (left.kind === "result" ? 0 : 1) - (right.kind === "result" ? 0 : 1) ||
      String(left.item.id).localeCompare(String(right.item.id))
    );
    const due = dueItems[0];
    if (!due) break;
    attempt.simulatedMinute = due.dueMinute;
    if (due.kind === "result") {
      const placed = due.item;
      const result = definition.results.find((item) => item.orderId === placed.definitionId);
      const occurrence = (placed.resultOccurrencesReleased ?? 0) + 1;
      const collectedAt = Math.max(
        placed.orderedAt,
        due.dueMinute - (placed.processingMinutesSnapshot ?? 0)
      );
      const resultValue = (occurrence === 1 ? placed.resultValueSnapshot : undefined) ?? (
        result ? resolveCaseResultValue(result, attempt.currentClinicalStateId) : undefined
      );
      if (result && resultValue) {
        attempt.results.push({
          id: crypto.randomUUID(),
          orderId: placed.id,
          name: placed.name,
          category: placed.resultCategorySnapshot ?? result.category,
          value: resultValue,
          availableAt: due.dueMinute,
          collectedAt,
          occurrence
        });
        attempt.actions.push({
          id: crypto.randomUUID(),
          type: "result",
          simulatedMinute: due.dueMinute,
          collectedAt,
          summary: `Result available: ${placed.name} (occurrence ${occurrence})`,
          match: placed.definitionId,
          placedOrderId: placed.id,
          occurrence,
          route: placed.route,
          dose: placed.dose,
          frequency: placed.frequency,
          duration: placed.duration,
          priority: placed.priority,
          internal: true
        });
      }
      placed.resultOccurrencesReleased = occurrence;
      scheduleTransitionRules(attempt, "order_completed", placed.definitionId);
      placed.completionRuleTriggered = true;
      const schedule = placed.scheduleSnapshot as OrderSchedule | undefined;
      const nextDueMinute = nextScheduledMinute(
        schedule,
        placed.orderedAt,
        due.dueMinute,
        occurrence + 1,
        schedule?.repeatResults ?? false
      );
      if (nextDueMinute !== null) {
        placed.reportAt = nextDueMinute;
      } else {
        placed.reportAt = undefined;
        placed.resultStreamComplete = true;
        maybeCompletePlacedOrder(attempt, placed, due.dueMinute);
      }
      attempt.markModified("orders");
      continue;
    }

    if (due.kind === "completion") {
      const event = due.item;
      event.status = "completed";
      const placed: any = attempt.orders.find((order: any) => order.id === event.sourceOrderId);
      if (placed && placed.status !== "discontinued") {
        placed.resultStreamComplete = true;
        placed.responseStreamComplete = true;
        maybeCompletePlacedOrder(attempt, placed, due.dueMinute, true);
      }
      attempt.markModified("pendingEvents");
      continue;
    }

    const event = due.item;
    const currentClinicalStateId = attempt.currentClinicalStateId ?? undefined;
    const skipReason = event.conditions?.location && event.conditions.location !== attempt.location
      ? `location is ${attempt.location}`
      : event.conditions?.clinicalStateId && event.conditions.clinicalStateId !== attempt.currentClinicalStateId
        ? `clinical state is ${attempt.currentClinicalStateId ?? "unknown"}`
        : event.allowedFromStateIds?.length && (!currentClinicalStateId || !event.allowedFromStateIds.includes(currentClinicalStateId))
          ? `clinical state ${attempt.currentClinicalStateId ?? "unknown"} is not allowed`
          : currentClinicalStateId && event.blockedInStateIds?.includes(currentClinicalStateId)
            ? `clinical state ${attempt.currentClinicalStateId} is blocked`
            : null;
    if (skipReason) {
      event.status = "skipped";
      attempt.actions.push({
        id: crypto.randomUUID(),
        type: "system",
        simulatedMinute: due.dueMinute,
        summary: `Skipped event ${event.eventTag ?? event.ruleId ?? event.id}: ${skipReason}`,
        eventTag: event.eventTag,
        eventOutcome: "skipped",
        internal: true
      });
      attempt.markModified("pendingEvents");
      finishClinicalResponseOccurrence(attempt, event, due.dueMinute);
      continue;
    }
    const state = definition.clinicalStates?.find((item) => item.id === event.targetStateId);
    if (state) {
      attempt.currentClinicalStateId = state.id;
      if (state.vitals) {
        attempt.currentVitals = state.vitals;
        attempt.vitalSignsLog.push({ simulatedMinute: due.dueMinute, vitals: state.vitals });
      }
      if (state.appearance) attempt.currentAppearance = state.appearance;
    }
    const note = event.progressNote ?? state?.progressNote;
    if (note) {
      attempt.progressNotes.push({ id: crypto.randomUUID(), simulatedMinute: due.dueMinute, text: note });
    }
    if (event.notification) {
      attempt.patientNotifications.push({
        id: event.id,
        type: "PATIENT_UPDATE",
        message: event.notification,
        simulatedMinute: due.dueMinute
      });
    }
    attempt.actions.push({
      id: crypto.randomUUID(),
      type: "system",
      simulatedMinute: due.dueMinute,
      summary: event.notification ?? note ?? `Patient state changed to ${state?.id ?? "updated"}`,
      clinicalStateId: state?.id,
      eventTag: event.eventTag,
      eventOutcome: "applied"
    });
    event.status = "completed";
    const tagsToCancel = new Set(event.cancelPendingEventTags ?? []);
    if (tagsToCancel.size) {
      for (const pending of attempt.pendingEvents as any[]) {
        if (
          pending.id === event.id ||
          !["pending", "blocked"].includes(pending.status) ||
          !pending.eventTag ||
          !tagsToCancel.has(pending.eventTag)
        ) continue;
        pending.status = "cancelled";
        if (pending.type === "clinical_response" && pending.sourceOrderId) {
          const source: any = attempt.orders.find((order: any) => order.id === pending.sourceOrderId);
          if (source && source.status !== "discontinued") {
            source.responseStreamComplete = true;
            maybeCompletePlacedOrder(attempt, source, due.dueMinute);
          }
        }
        attempt.actions.push({
          id: crypto.randomUUID(),
          type: "system",
          simulatedMinute: due.dueMinute,
          summary: `Cancelled pending event ${pending.eventTag}`,
          eventTag: pending.eventTag,
          eventOutcome: "cancelled",
          internal: true
        });
      }
    }
    finishClinicalResponseOccurrence(attempt, event, due.dueMinute);
    attempt.markModified("pendingEvents");
    if (event.endCase) {
      enterFinalOrders(attempt, {
        reason: event.notification ?? event.progressNote ?? "A clinical case-ending event occurred",
        conditionId: event.ruleId ? `transition:${event.ruleId}` : undefined,
        finalOrderMinutes: definition.finalOrderMinutes
      });
    }
    evaluateCaseEndConditions(attempt);
    if (attempt.status === "final_orders") break;
  }
  if (attempt.status === "active") {
    attempt.simulatedMinute = targetMinute;
    evaluateCaseEndConditions(attempt);
  }
};

export const submitAttemptAction = async (
  id: string,
  userId: string,
  input: AttemptActionInput
) => {
  const attempt = await requireAttempt(id, userId);
  const previousRealtimeState = captureRealtimeState(attempt);
  ensureAttemptClinicalRuntime(attempt);
  updateDeadline(attempt);

  if (isClosed(attempt.status)) {
    await attempt.save();
    throw new AppError(409, "Attempt is closed", { attempt: serializeAttempt(attempt) });
  }
  resolveDueEvents(attempt, attempt.simulatedMinute);
  if (
    attempt.status === "final_orders" &&
    !["PLACE_ORDER", "DISCONTINUE_ORDER", "FINISH_CASE"].includes(input.action.type)
  ) {
    throw new AppError(409, "Only final orders may be entered during the case-end period");
  }
  if (attempt.idempotencyKeys.includes(input.idempotencyKey)) {
    return serializeAttempt(attempt);
  }
  if (attempt.revision !== input.expectedRevision) {
    throw new AppError(409, "Attempt revision is stale", { attempt: serializeAttempt(attempt) });
  }

  let resolvedOrder: OrderDefinition | null = null;
  if (input.action.type === "PLACE_ORDER") {
    const orderId = input.action.orderId;
    const definition = attempt.caseSnapshot as CaseDefinitionInput;
    const configuredOrder = definition.orders.find((order) => order.id === orderId);
    const catalogOrder = configuredOrder
      ? null
      : await getActiveCatalogOrder(orderId);
    resolvedOrder = selectAttemptOrder(definition.orders, catalogOrder, orderId);
    if (!resolvedOrder) throw new AppError(400, "Order is unavailable");
  }

  const startMinute = attempt.simulatedMinute;
  const nextResultMinute = Math.min(
    ...(attempt.orders as any[])
      .filter((order) => order.status === "active" && order.reportAt > startMinute)
      .map((order) => order.reportAt)
  );
  const nextClinicalEventMinute = Math.min(
    nextResultMinute,
    ...(attempt.pendingEvents as any[])
      .filter((event) => event.status === "pending" && event.dueMinute > startMinute)
      .map((event) => event.dueMinute)
  );
  if (input.action.type === "ADVANCE_TO_NEXT_RESULT" && !Number.isFinite(nextResultMinute)) {
    throw new AppError(409, "No results are currently pending");
  }
  if (input.action.type === "ADVANCE_TO_NEXT_EVENT" && !Number.isFinite(nextClinicalEventMinute)) {
    throw new AppError(409, "No result or patient event is currently pending");
  }
  if (input.action.type === "ADVANCE_TO_SIMULATED_MINUTE" && input.action.targetMinute <= startMinute) {
    throw new AppError(400, "Appointment time must be later than the current simulated time");
  }
  applyClinicalAction(attempt, input.action, resolvedOrder);
  const targetMinute = input.action.type === "ADVANCE_TIME"
    ? startMinute + input.action.minutes
    : input.action.type === "ADVANCE_TO_NEXT_RESULT"
      ? nextResultMinute
      : input.action.type === "ADVANCE_TO_NEXT_EVENT"
        ? nextClinicalEventMinute
        : input.action.type === "ADVANCE_TO_SIMULATED_MINUTE"
          ? input.action.targetMinute
        : attempt.simulatedMinute;
  resolveDueEvents(attempt, targetMinute);
  attempt.idempotencyKeys.push(input.idempotencyKey);
  attempt.revision += 1;
  await attempt.save();
  return publishRealtimeChanges(attempt, previousRealtimeState);
};

export const getScoreReport = async (id: string, userId: string) => {
  const attempt = await AttemptModel.findOne({ _id: id, userId }).lean();
  if (!attempt || !attempt.scoreReport) {
    throw new AppError(404, "Score report not found");
  }
  return attempt.scoreReport;
};

export const previewCaseDefinition = (
  definition: CaseDefinitionInput,
  actions: AttemptAction[]
) => {
  const initialState = definition.clinicalStates?.find(
    (state) => state.id === definition.initialClinicalStateId
  );
  const attempt = {
    id: "admin-preview",
    caseSnapshot: definition,
    status: "active",
    realTimeEndsAt: new Date(Date.now() + 86_400_000),
    finalOrdersStartsAt: new Date(Date.now() + 86_400_000),
    simulatedMinute: 0,
    location: definition.startingLocation,
    currentClinicalStateId: initialState?.id,
    currentVitals: initialState?.vitals ?? definition.vitals,
    vitalSignsLog: [{ simulatedMinute: 0, vitals: initialState?.vitals ?? definition.vitals }],
    currentAppearance: initialState?.appearance ?? definition.appearance,
    revision: 0,
    orders: [],
    results: [],
    actions: [],
    progressNotes: initialState?.progressNote
      ? [{ id: crypto.randomUUID(), simulatedMinute: 0, text: initialState.progressNote }]
      : [],
    pendingEvents: [],
    patientNotifications: [],
    triggeredRuleIds: [],
    idempotencyKeys: [],
    scoreReport: null,
    markModified: () => undefined
  } as unknown as AttemptDocument;

  ensureAttemptClinicalRuntime(attempt);
  for (const action of actions) {
    if (isClosed(attempt.status)) break;
    if (
      attempt.status === "final_orders" &&
      !["PLACE_ORDER", "DISCONTINUE_ORDER", "FINISH_CASE"].includes(action.type)
    ) break;
    resolveDueEvents(attempt, attempt.simulatedMinute);
    const startMinute = attempt.simulatedMinute;
    const nextResultMinute = Math.min(
      ...(attempt.orders as any[])
        .filter((order) => order.status === "active" && order.reportAt > startMinute)
        .map((order) => order.reportAt)
    );
    const nextClinicalEventMinute = Math.min(
      nextResultMinute,
      ...(attempt.pendingEvents as any[])
        .filter((event) => event.status === "pending" && event.dueMinute > startMinute)
        .map((event) => event.dueMinute)
    );
    if (action.type === "ADVANCE_TO_NEXT_RESULT" && !Number.isFinite(nextResultMinute)) {
      throw new AppError(409, "No results are currently pending");
    }
    if (action.type === "ADVANCE_TO_NEXT_EVENT" && !Number.isFinite(nextClinicalEventMinute)) {
      throw new AppError(409, "No result or patient event is currently pending");
    }
    if (action.type === "ADVANCE_TO_SIMULATED_MINUTE" && action.targetMinute <= startMinute) {
      throw new AppError(400, "Appointment time must be later than the current simulated time");
    }
    applyClinicalAction(attempt, action);
    const targetMinute = action.type === "ADVANCE_TIME"
      ? startMinute + action.minutes
      : action.type === "ADVANCE_TO_NEXT_RESULT" && Number.isFinite(nextResultMinute)
        ? nextResultMinute
        : action.type === "ADVANCE_TO_NEXT_EVENT" && Number.isFinite(nextClinicalEventMinute)
          ? nextClinicalEventMinute
          : action.type === "ADVANCE_TO_SIMULATED_MINUTE"
            ? action.targetMinute
            : attempt.simulatedMinute;
    resolveDueEvents(attempt, targetMinute);
    attempt.revision += 1;
  }

  const publicState = serializeAttempt(attempt);
  return {
    ...publicState,
    actions: attempt.actions,
    pendingEvents: attempt.pendingEvents,
    triggeredRuleIds: attempt.triggeredRuleIds,
    scoreReport: scoreAttempt(attempt)
  };
};
