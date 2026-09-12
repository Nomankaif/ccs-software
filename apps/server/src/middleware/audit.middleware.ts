import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../types/http.js";
import { AuditEventModel } from "../models/audit-event.model.js";
import { defineAbility } from "@ccs/domain";

export function auditAdminChanges(request: AuthedRequest, response: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    response.once("finish", () => {
      if (!request.user || !defineAbility(request.user.role).can("read", "AdminPortal") || response.statusCode >= 400) return;
      // Store route metadata only; request bodies can contain credentials or case answers.
      void AuditEventModel.create({ actorId: request.user.id, action: request.method,
        resource: request.originalUrl.split("?")[0], status: response.statusCode })
        .catch((error: unknown) => request.log.error({ err: error }, "Administrative audit write failed"));
    });
  }
  next();
}
