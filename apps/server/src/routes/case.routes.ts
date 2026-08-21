import { Router } from "express";
import * as caseController from "../controllers/case.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const casesRouter = Router();

casesRouter.use(requireAuth);
casesRouter.get("/", caseController.listPublished);
casesRouter.get("/:id", caseController.getPublished);
