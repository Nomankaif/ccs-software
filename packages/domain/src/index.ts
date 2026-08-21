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
  frequency?: string[];
  resultDelayMinutes?: number;
}

export interface PlacedOrder {
  id: string;
  definitionId: string;
  name: string;
  route?: string;
  frequency?: string;
  orderedAt: number;
  reportAt?: number;
  status: "active" | "completed" | "discontinued";
}

export interface CaseResult {
  id: string;
  orderId: string;
  category: ChartTab;
  name: string;
  value: string;
  availableAt: number;
}

export interface AttemptAction {
  id: string;
  type: "order" | "exam" | "advance" | "location" | "system";
  simulatedMinute: number;
  summary: string;
}

export interface ScoreReport {
  total: number;
  domains: Array<{ label: string; score: number; max: number }>;
  ideal: string[];
  missed: string[];
  harmful: string[];
  rationale: string;
}

export { calculateScore } from "./engine";
