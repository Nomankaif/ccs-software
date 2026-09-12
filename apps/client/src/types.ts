import type { CaseDefinitionInput } from "@ccs/validation";
import type { AttemptAction, CaseResult, OrderDefinition, PlacedOrder, ScoreReport } from "@ccs/domain";

export interface User { id: string; email: string; firstName?: string; lastName?: string; role: import("@ccs/domain").UserRole }
export type CaseStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published" | "retired";
export interface AdminCase extends CaseDefinitionInput {
  id: string;
  version: number;
  status: CaseStatus;
  updatedAt?: string;
  createdBy?: string;
  lastEditedBy?: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  publishedAt?: string;
  retiredAt?: string;
}
export interface CaseReview {
  id: string;
  caseVersionId: string;
  version: number;
  action: "submitted" | "approved" | "changes_requested";
  comment: string;
  reviewerId: string;
  reviewerEmail?: string;
  createdAt: string;
}
export interface CaseVersionHistory { slug: string; versions: AdminCase[]; reviews: CaseReview[] }
export interface StudentCaseSummary extends Pick<
  CaseDefinitionInput,
  "slug" | "title" | "specialty" | "difficulty" | "durationMinutes" | "finalOrderMinutes" | "opening"
> { id: string; version: number }
export interface CatalogOrder extends OrderDefinition { active: boolean; updatedAt?: string }
export type StudentCaseDefinition = Pick<
  CaseDefinitionInput,
  | "slug"
  | "title"
  | "specialty"
  | "difficulty"
  | "durationMinutes"
  | "finalOrderMinutes"
  | "opening"
  | "appearance"
  | "startingLocation"
  | "allowedLocations"
  | "history"
  | "vitals"
  | "exam"
>;
export interface AttemptState {
  attemptId: string; revision: number; serverTime: string; realTimeEndsAt: string; finalOrdersStartsAt: string;
  finalOrdersTriggeredAt?: string; endConditionId?: string; endReason?: string; activeFinalOrderMinutes?: number; completionReason?: string;
  status: "active" | "final_orders" | "completed" | "expired"; simulatedMinute: number; location: string;
  currentClinicalStateId?: string; currentVitals: CaseDefinitionInput["vitals"]; currentAppearance: string;
  vitalSignsLog?: Array<{ simulatedMinute: number; vitals: CaseDefinitionInput["vitals"] }>;
  case: StudentCaseDefinition; orders: PlacedOrder[]; results: CaseResult[]; actions: AttemptAction[]; scoreReport: ScoreReport | null;
  progressNotes?: Array<{ id: string; simulatedMinute: number; text: string }>;
  notifications: Array<{ id?: string; type: string; message: string; simulatedMinute?: number }>;
}
