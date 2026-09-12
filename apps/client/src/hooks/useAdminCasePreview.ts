import { useMutation } from "@tanstack/react-query";
import type { CaseDefinitionInput } from "@ccs/validation";
import type { AttemptAction, CaseResult, PlacedOrder, ScoreReport } from "@ccs/domain";
import { useState } from "react";
import { api } from "../api";

export type PreviewAction =
  | { type: "PERFORM_EXAM"; sections: string[] }
  | { type: "PLACE_ORDER"; orderId: string; route?: string; dose?: string; frequency?: string; duration?: string; priority?: string }
  | { type: "DISCONTINUE_ORDER"; placedOrderId: string }
  | { type: "ADVANCE_TIME"; minutes: number }
  | { type: "ADVANCE_TO_NEXT_RESULT" }
  | { type: "ADVANCE_TO_NEXT_EVENT" }
  | { type: "ADVANCE_TO_SIMULATED_MINUTE"; targetMinute: number }
  | { type: "CHANGE_LOCATION"; location: string }
  | { type: "FINISH_CASE" };

export interface AdminCasePreview {
  status: "active" | "final_orders" | "completed" | "expired";
  simulatedMinute: number;
  location: string;
  currentClinicalStateId?: string;
  currentAppearance: string;
  currentVitals: CaseDefinitionInput["vitals"];
  orders: PlacedOrder[];
  results: CaseResult[];
  actions: AttemptAction[];
  pendingEvents: Array<{ id: string; type: string; dueMinute?: number; status: string; eventTag?: string; ruleId?: string }>;
  notifications: Array<{ id?: string; type: string; message: string; simulatedMinute?: number }>;
  scoreReport: ScoreReport;
}

export const useAdminCasePreview = (definition: CaseDefinitionInput) => {
  const [actions, setActions] = useState<PreviewAction[]>([]);
  const preview = useMutation({
    mutationFn: (nextActions: PreviewAction[]) => api<{ preview: AdminCasePreview }>("/admin/cases/preview", {
      method: "POST",
      body: JSON.stringify({ definition, actions: nextActions })
    })
  });

  const run = (action: PreviewAction) => {
    const next = [...actions, action];
    setActions(next);
    preview.mutate(next, { onError: () => setActions(actions) });
  };
  const reset = () => {
    setActions([]);
    preview.reset();
  };

  return { actions, state: preview.data?.preview, run, reset, isPending: preview.isPending, error: preview.error };
};
