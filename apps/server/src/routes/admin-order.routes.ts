import { Router } from "express";
import { orderCatalogEntrySchema } from "@ccs/validation";
import * as orderCatalogController from "../controllers/order-catalog.controller.js";
import { requirePermission } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";

export const adminOrdersRouter = Router();

adminOrdersRouter.use(requirePermission("manage", "Order"));
adminOrdersRouter.get("/", orderCatalogController.list);
adminOrdersRouter.post("/", validateBody(orderCatalogEntrySchema), orderCatalogController.create);
adminOrdersRouter.put("/:orderId", validateBody(orderCatalogEntrySchema), orderCatalogController.update);
adminOrdersRouter.post("/:orderId/archive", orderCatalogController.archive);
adminOrdersRouter.post("/:orderId/restore", orderCatalogController.restore);
