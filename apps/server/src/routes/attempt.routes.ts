import { Router } from "express";
import * as attemptController from "../controllers/attempt.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { attemptActionSchema, startAttemptSchema } from "../validators/attempt.validator.js";

export const attemptsRouter = Router();

attemptsRouter.use(requireAuth);
attemptsRouter.post("/", validateBody(startAttemptSchema), attemptController.start);
attemptsRouter.get("/", attemptController.list);
attemptsRouter.get("/:id/state", attemptController.getState);
attemptsRouter.get("/:id/orders", attemptController.searchOrders);
attemptsRouter.post("/:id/actions", validateBody(attemptActionSchema), attemptController.submitAction);
attemptsRouter.get("/:id/report", attemptController.getReport);
