import { z } from "zod";

export const startAttemptSchema = z.object({ caseId: z.string().min(1) });

export const attemptActionSchema = z.object({
  expectedRevision: z.number().int().min(0),
  idempotencyKey: z.string().min(8),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("PERFORM_EXAM"), sections: z.array(z.string()).min(1) }),
    z.object({
      type: z.literal("PLACE_ORDER"),
      orderId: z.string(),
      route: z.string().optional(),
      frequency: z.string().optional()
    }),
    z.object({ type: z.literal("DISCONTINUE_ORDER"), placedOrderId: z.string() }),
    z.object({ type: z.literal("ADVANCE_TIME"), minutes: z.number().int().min(1).max(525600) }),
    z.object({ type: z.literal("CHANGE_LOCATION"), location: z.string() }),
    z.object({ type: z.literal("FINISH_CASE") })
  ])
});

export type AttemptActionInput = z.infer<typeof attemptActionSchema>;
