import { Router } from "express";
import { caseDefinitionSchema, caseImportSchema } from "@ccs/validation";
import { z } from "zod";
import * as caseController from "../controllers/case.controller.js";
import { requirePermission } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { clinicalActionSchema } from "../validators/attempt.validator.js";

export const adminCasesRouter = Router();

adminCasesRouter.use(requirePermission("read", "Case"));
adminCasesRouter.get("/", caseController.listForAdmin);
adminCasesRouter.post("/", validateBody(caseDefinitionSchema), caseController.create);
adminCasesRouter.post("/import", validateBody(caseImportSchema), caseController.importCases);
adminCasesRouter.post("/quality", validateBody(caseDefinitionSchema), caseController.quality);
adminCasesRouter.post(
  "/preview",
  validateBody(z.object({ definition: caseDefinitionSchema, actions: z.array(clinicalActionSchema).max(100) })),
  caseController.preview
);
adminCasesRouter.put("/:id", validateBody(caseDefinitionSchema), caseController.update);
adminCasesRouter.delete("/:id", requirePermission("delete", "Case"), caseController.remove);
adminCasesRouter.get("/:id/history", caseController.history);
adminCasesRouter.post("/:id/validate", caseController.validate);
adminCasesRouter.post("/:id/publish", requirePermission("publish", "Case"), caseController.publish);
adminCasesRouter.post("/:id/retire", requirePermission("retire", "Case"), caseController.retire);
