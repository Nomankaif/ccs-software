export type Location = "Office" | "Emergency Department" | "Inpatient Unit" | "ICU" | "Home";

export type ChartTab =
  | "Order Sheet"
  | "Progress Notes"
  | "Vital Signs"
  | "Lab Reports"
  | "Imaging"
  | "Other Tests"
  | "Treatment Record";

export interface VitalSigns {
  temperature: string;
  pulse: string;
  respirations: string;
  bloodPressure: string;
  oxygenSaturation: string;
}

export interface OrderDefinition {
  id: string;
  name: string;
  aliases: string[];
  category:
    | "Medication"
    | "Laboratory"
    | "Imaging"
    | "Other Tests"
    | "Procedure"
    | "Monitoring"
    | "Consultation"
    | "Counseling";
  route?: string[];
  dose?: string[];
  frequency?: string[];
  duration?: string[];
  priority?: string[];
  resultDelayMinutes?: number;
}

export interface PlacedOrder {
  id: string;
  definitionId: string;
  name: string;
  category?: OrderDefinition["category"];
  definitionSnapshot?: OrderDefinition;
  caseConfigured?: boolean;
  resultValueSnapshot?: string;
  resultCategorySnapshot?: ChartTab;
  route?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  priority?: string;
  orderedAt: number;
  reportAt?: number;
  status: "active" | "held" | "completed" | "discontinued";
}

export interface CaseResult {
  imageDataUrl?: string;
  id: string;
  orderId: string;
  category: ChartTab;
  name: string;
  value: string;
  availableAt: number;
  collectedAt?: number;
  occurrence?: number;
}

export interface AttemptAction {
  id: string;
  type:
    | "order"
    | "exam"
    | "advance"
    | "location"
    | "system"
    | "result"
    | "order_completed"
    | "order_discontinued";
  simulatedMinute: number;
  summary: string;
  match?: string;
  matches?: string[];
  clinicalStateId?: string;
  eventTag?: string;
  eventOutcome?: "applied" | "skipped" | "cancelled";
  route?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  priority?: string;
  placedOrderId?: string;
  occurrence?: number;
  collectedAt?: number;
}

export interface ScoreReport {
  details?: Array<{
    ruleId: string;
    label: string;
    action: string;
    domain: string;
    status: "met" | "partial" | "missed" | "penalty" | "avoided";
    awardedPoints: number;
    possiblePoints: number;
    simulatedMinute?: number;
    explanation: string;
    rationale?: string;
    expected: string;
  }>;
  rawTotal?: number;
  total: number;
  domains: Array<{ label: string; score: number; max: number }>;
  ideal: string[];
  partial?: string[];
  missed: string[];
  harmful: string[];
  rationale: string;
}

export { calculateScore } from "./engine.js";
export * from "./permissions.js";
