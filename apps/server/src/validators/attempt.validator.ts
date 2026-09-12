import { clinicalActionSchema } from "@ccs/validation";
import { z } from "zod";

export const startAttemptSchema = z.object({ caseId: z.string().min(1) });

export { clinicalActionSchema };

export const attemptActionSchema = z.object({
  expectedRevision: z.number().int().min(0),
  idempotencyKey: z.string().min(8),
  action: clinicalActionSchema
});

export type AttemptActionInput = z.infer<typeof attemptActionSchema>;
