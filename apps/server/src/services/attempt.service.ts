import crypto from "node:crypto";
import type { CaseDefinitionInput } from "@ccs/validation";
import { AppError } from "../errors/app-error.js";
import { AttemptModel, CaseModel } from "../models/index.js";
import type { AttemptActionInput } from "../validators/attempt.validator.js";

type AttemptDocument = InstanceType<typeof AttemptModel>;
type AttemptAction = AttemptActionInput["action"];

const isClosed = (status: string) => ["completed", "expired"].includes(status);

export const scoreAttempt = (attempt: AttemptDocument) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const met: string[] = [];
  const missed: string[] = [];
  const harmful: string[] = [];
  const domains = new Map<string, number>();
  let total = 0;

  for (const rule of definition.scoreRules) {
    const hit = rule.actionType === "order"
      ? attempt.orders.some((order: any) => order.definitionId === rule.match)
      : rule.actionType === "location"
        ? attempt.actions.some((action: any) => action.type === "location" && action.summary.includes(rule.match))
        : attempt.actions.some((action: any) => action.type === "exam" && action.summary.includes(rule.match));

    if (hit) {
      total += rule.points;
      domains.set(rule.domain, (domains.get(rule.domain) ?? 0) + rule.points);
      (rule.points < 0 ? harmful : met).push(rule.label);
    } else if (rule.points > 0) {
      missed.push(rule.label);
    }
  }

  return {
    total: Math.max(0, Math.min(100, total)),
    domains: [...domains].map(([label, score]) => ({ label, score: Math.max(0, score), max: 100 })),
    ideal: met,
    missed,
    harmful,
    rationale: definition.feedback
  };
};

const updateDeadline = (attempt: AttemptDocument) => {
  if (isClosed(attempt.status)) return;

  const now = Date.now();
  if (now >= attempt.realTimeEndsAt.getTime()) {
    attempt.status = "expired";
    attempt.completedAt = new Date();
    attempt.scoreReport = scoreAttempt(attempt);
  } else if (now >= attempt.finalOrdersStartsAt.getTime()) {
    attempt.status = "final_orders";
  }
};

export const serializeAttempt = (attempt: AttemptDocument) => ({
  attemptId: attempt.id,
  revision: attempt.revision,
  serverTime: new Date().toISOString(),
  realTimeEndsAt: attempt.realTimeEndsAt,
  finalOrdersStartsAt: attempt.finalOrdersStartsAt,
  status: attempt.status,
  simulatedMinute: attempt.simulatedMinute,
  location: attempt.location,
  case: attempt.caseSnapshot,
  orders: attempt.orders,
  results: attempt.results,
  actions: attempt.actions,
  scoreReport: attempt.scoreReport ?? null,
  notifications: attempt.status === "final_orders"
    ? [{ type: "FINAL_ORDERS", message: "Two minutes remain for final orders." }]
    : []
});

export const startAttempt = async (caseId: string, userId: string) => {
  const caseEntry = await CaseModel.findOne({ _id: caseId, status: "published" }).lean();
  if (!caseEntry) throw new AppError(404, "Published case not found");

  const existing = await AttemptModel.findOne({
    userId,
    caseVersionId: caseEntry._id,
    status: { $in: ["active", "final_orders"] }
  });
  if (existing) {
    updateDeadline(existing);
    await existing.save();
    return { attempt: serializeAttempt(existing), created: false };
  }

  const definition = caseEntry.definition as CaseDefinitionInput;
  const totalMs = (definition.durationMinutes + definition.finalOrderMinutes) * 60_000;
  const attempt = await AttemptModel.create({
    userId,
    caseVersionId: caseEntry._id,
    caseSnapshot: definition,
    realTimeEndsAt: new Date(Date.now() + totalMs),
    finalOrdersStartsAt: new Date(Date.now() + definition.durationMinutes * 60_000),
    location: definition.startingLocation
  });

  return { attempt: serializeAttempt(attempt), created: true };
};

export const listAttempts = (userId: string) =>
  AttemptModel.find({ userId })
    .sort({ createdAt: -1 })
    .select("status caseSnapshot.title createdAt scoreReport.total")
    .lean();

const requireAttempt = async (id: string, userId: string) => {
  const attempt = await AttemptModel.findOne({ _id: id, userId });
  if (!attempt) throw new AppError(404, "Attempt not found");
  return attempt;
};

export const getAttemptState = async (id: string, userId: string) => {
  const attempt = await requireAttempt(id, userId);
  updateDeadline(attempt);
  await attempt.save();
  return serializeAttempt(attempt);
};

const applyClinicalAction = (attempt: AttemptDocument, action: AttemptAction) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  let summary = "";

  if (action.type === "PERFORM_EXAM") {
    attempt.simulatedMinute += action.sections.length * 2;
    summary = `Examined: ${action.sections.join(", ")}`;
  }
  if (action.type === "PLACE_ORDER") {
    const order = definition.orders.find((item) => item.id === action.orderId);
    if (!order) throw new AppError(400, "Order is unavailable");
    attempt.orders.push({
      id: crypto.randomUUID(),
      definitionId: order.id,
      name: order.name,
      route: action.route,
      frequency: action.frequency,
      orderedAt: attempt.simulatedMinute,
      reportAt: order.resultDelayMinutes === undefined
        ? undefined
        : attempt.simulatedMinute + order.resultDelayMinutes,
      status: "active"
    });
    summary = `Ordered ${order.name}`;
  }
  if (action.type === "DISCONTINUE_ORDER") {
    const order: any = attempt.orders.find((item: any) => item.id === action.placedOrderId);
    if (order) order.status = "discontinued";
    summary = "Order discontinued";
  }
  if (action.type === "ADVANCE_TIME") {
    attempt.simulatedMinute += action.minutes;
    summary = `Advanced simulated time by ${action.minutes} minutes`;
  }
  if (action.type === "CHANGE_LOCATION") {
    if (!definition.allowedLocations.includes(action.location as any)) {
      throw new AppError(400, "Location is unavailable");
    }
    attempt.location = action.location;
    summary = `Changed location to ${action.location}`;
  }
  if (action.type === "FINISH_CASE") {
    attempt.status = "completed";
    attempt.completedAt = new Date();
    attempt.scoreReport = scoreAttempt(attempt);
    summary = "Case completed";
  }

  attempt.actions.push({
    id: crypto.randomUUID(),
    type: action.type === "PLACE_ORDER"
      ? "order"
      : action.type === "PERFORM_EXAM"
        ? "exam"
        : action.type === "CHANGE_LOCATION"
          ? "location"
          : action.type === "ADVANCE_TIME"
            ? "advance"
            : "system",
    simulatedMinute: attempt.simulatedMinute,
    summary
  });
};

const releaseDueResults = (attempt: AttemptDocument) => {
  const definition = attempt.caseSnapshot as CaseDefinitionInput;
  const currentResults = new Set(attempt.results.map((result: any) => result.orderId));

  for (const placed of attempt.orders as any[]) {
    if (
      placed.reportAt !== undefined &&
      placed.reportAt <= attempt.simulatedMinute &&
      !currentResults.has(placed.id)
    ) {
      const result = definition.results.find((item) => item.orderId === placed.definitionId);
      if (result) {
        attempt.results.push({
          id: crypto.randomUUID(),
          orderId: placed.id,
          name: placed.name,
          category: result.category,
          value: result.value,
          availableAt: attempt.simulatedMinute
        });
      }
      placed.status = "completed";
    }
  }
};

export const submitAttemptAction = async (
  id: string,
  userId: string,
  input: AttemptActionInput
) => {
  const attempt = await requireAttempt(id, userId);
  updateDeadline(attempt);

  if (isClosed(attempt.status)) {
    await attempt.save();
    throw new AppError(409, "Attempt is closed", { attempt: serializeAttempt(attempt) });
  }
  if (attempt.idempotencyKeys.includes(input.idempotencyKey)) {
    return serializeAttempt(attempt);
  }
  if (attempt.revision !== input.expectedRevision) {
    throw new AppError(409, "Attempt revision is stale", { attempt: serializeAttempt(attempt) });
  }

  applyClinicalAction(attempt, input.action);
  releaseDueResults(attempt);
  attempt.idempotencyKeys.push(input.idempotencyKey);
  attempt.revision += 1;
  await attempt.save();
  return serializeAttempt(attempt);
};

export const getScoreReport = async (id: string, userId: string) => {
  const attempt = await AttemptModel.findOne({ _id: id, userId }).lean();
  if (!attempt || !attempt.scoreReport) {
    throw new AppError(404, "Score report not found");
  }
  return attempt.scoreReport;
};
