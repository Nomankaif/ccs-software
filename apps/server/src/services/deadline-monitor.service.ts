import { AttemptModel } from "../models/index.js";
import {
  ensureAttemptClinicalRuntime,
  resolveDueEvents,
  serializeAttempt,
  updateDeadline
} from "./attempt.service.js";
import { publishAttemptUpdate, publishTimerSynchronization } from "./realtime.service.js";

let tick = 0;
let monitorRunning = false;

const synchronizeDeadlines = async () => {
  const now = new Date();
  const dueAttempts = await AttemptModel.find({
    status: { $in: ["active", "final_orders"] },
    $or: [
      { finalOrdersStartsAt: { $lte: now }, status: "active" },
      { realTimeEndsAt: { $lte: now } }
    ]
  });

  for (const attempt of dueAttempts) {
    const previousStatus = attempt.status;
    ensureAttemptClinicalRuntime(attempt);
    resolveDueEvents(attempt, attempt.simulatedMinute);
    updateDeadline(attempt, now.getTime());
    if (attempt.status === previousStatus) continue;
    attempt.revision += 1;
    await attempt.save();
    const state = serializeAttempt(attempt);
    publishAttemptUpdate(attempt.id, state, {
      enteredFinalOrders: attempt.status === "final_orders",
      completed: attempt.status === "expired"
    });
  }
};

const synchronizeTimers = async () => {
  const attempts = await AttemptModel.find({ status: { $in: ["active", "final_orders"] } })
    .select("realTimeEndsAt finalOrdersStartsAt status")
    .lean();
  const serverTime = new Date().toISOString();
  for (const attempt of attempts) {
    publishTimerSynchronization(String(attempt._id), {
      serverTime,
      realTimeEndsAt: attempt.realTimeEndsAt,
      finalOrdersStartsAt: attempt.finalOrdersStartsAt,
      status: attempt.status
    });
  }
};

export const startDeadlineMonitor = () => {
  const timer = setInterval(() => {
    if (monitorRunning) return;
    monitorRunning = true;
    tick += 1;
    void (async () => {
      await synchronizeDeadlines();
      if (tick % 5 === 0) await synchronizeTimers();
    })()
      .catch((error) => console.error("Attempt deadline monitor failed", error))
      .finally(() => {
        monitorRunning = false;
      });
  }, 1000);
  timer.unref();
  return timer;
};
