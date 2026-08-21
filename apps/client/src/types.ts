import type { CaseDefinitionInput } from "@ccs/validation";
import type { AttemptAction, CaseResult, PlacedOrder, ScoreReport } from "@ccs/domain";

export interface User { id: string; email: string; role: "student" | "admin" }
export interface LibraryCase extends CaseDefinitionInput { id: string; version: number; status?: string; updatedAt?: string }
export interface AttemptState {
  attemptId: string; revision: number; serverTime: string; realTimeEndsAt: string; finalOrdersStartsAt: string;
  status: "active" | "final_orders" | "completed" | "expired"; simulatedMinute: number; location: string;
  case: CaseDefinitionInput; orders: PlacedOrder[]; results: CaseResult[]; actions: AttemptAction[]; scoreReport: ScoreReport | null;
  notifications: Array<{ type: string; message: string }>;
}
