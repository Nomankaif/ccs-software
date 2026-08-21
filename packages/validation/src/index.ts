import { z } from "zod";

export const locationSchema = z.enum(["Office", "Emergency Department", "Inpatient Unit", "ICU", "Home"]);
export const orderCategorySchema = z.enum(["Medication", "Laboratory", "Imaging", "Other Tests", "Procedure", "Monitoring", "Consultation", "Counseling"]);

export const orderDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  aliases: z.array(z.string()).default([]),
  category: orderCategorySchema,
  route: z.array(z.string()).optional(),
  frequency: z.array(z.string()).optional(),
  resultDelayMinutes: z.number().int().min(0).optional()
});

export const resultDefinitionSchema = z.object({
  orderId: z.string().min(1),
  category: z.enum(["Lab Reports", "Imaging", "Other Tests", "Treatment Record"]),
  value: z.string().min(1)
});

export const scoreRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  domain: z.enum(["Diagnosis", "Therapy", "Monitoring", "Timing & sequence", "Location"]),
  actionType: z.enum(["order", "exam", "location"]),
  match: z.string().min(1),
  points: z.number().int(),
  rationale: z.string().min(1)
});

export const caseDefinitionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  specialty: z.string().min(2),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  durationMinutes: z.number().int().min(5).max(60),
  finalOrderMinutes: z.number().int().min(1).max(5).default(2),
  opening: z.string().min(20),
  appearance: z.string().min(3),
  startingLocation: locationSchema,
  allowedLocations: z.array(locationSchema).min(1),
  history: z.record(z.string().min(1)),
  vitals: z.object({
    temperature: z.string(), pulse: z.string(), respirations: z.string(), bloodPressure: z.string(), oxygenSaturation: z.string()
  }),
  exam: z.record(z.string().min(1)),
  orders: z.array(orderDefinitionSchema).min(1),
  results: z.array(resultDefinitionSchema),
  scoreRules: z.array(scoreRuleSchema).min(1),
  feedback: z.string().min(10)
}).superRefine((value, context) => {
  const orderIds = new Set(value.orders.map((order) => order.id));
  for (const result of value.results) if (!orderIds.has(result.orderId)) context.addIssue({ code: "custom", path: ["results"], message: `Unknown result orderId: ${result.orderId}` });
  if (!value.allowedLocations.includes(value.startingLocation)) context.addIssue({ code: "custom", path: ["allowedLocations"], message: "Starting location must be allowed" });
});

export const caseImportSchema = z.union([caseDefinitionSchema, z.array(caseDefinitionSchema).min(1).max(50)]);
export const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export type CaseDefinitionInput = z.infer<typeof caseDefinitionSchema>;
