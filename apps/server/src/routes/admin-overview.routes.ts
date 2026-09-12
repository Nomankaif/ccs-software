import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import * as controller from "../controllers/admin-overview.controller.js";

export const adminOverviewRouter = Router();
adminOverviewRouter.get("/users", requireAdmin, controller.users);
adminOverviewRouter.post("/users", requireAdmin, validateBody(z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128), role: z.literal("student").default("student")
}).strict()), controller.createUser);
adminOverviewRouter.get("/employees", requireAdmin, controller.employees);
adminOverviewRouter.patch("/employees/:id/status", requireAdmin, validateBody(z.object({ paused: z.boolean() }).strict()), controller.employeeStatus);
adminOverviewRouter.delete("/employees/:id", requireAdmin, controller.deleteEmployee);
adminOverviewRouter.post("/employees", requireAdmin, validateBody(z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128), role: z.enum(["subadmin", "writer"])
}).strict()), controller.createUser);
adminOverviewRouter.get("/analytics", requireAdmin, controller.analytics);
adminOverviewRouter.get("/audit", requireAdmin, controller.audit);
