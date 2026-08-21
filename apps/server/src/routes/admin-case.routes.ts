import { Router } from "express";
import { caseDefinitionSchema, caseImportSchema } from "@ccs/validation";
import * as caseController from "../controllers/case.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";

export const adminCasesRouter = Router();

adminCasesRouter.use(requireAdmin);
adminCasesRouter.get("/", caseController.listForAdmin);
adminCasesRouter.post("/", validateBody(caseDefinitionSchema), caseController.create);
adminCasesRouter.post("/import", validateBody(caseImportSchema), caseController.importCases);
adminCasesRouter.post("/:id/validate", caseController.validate);
adminCasesRouter.post("/:id/publish", caseController.publish);
adminCasesRouter.post("/:id/retire", caseController.retire);
