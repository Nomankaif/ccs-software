import { useMutation } from "@tanstack/react-query";
import type { CaseDefinitionInput } from "@ccs/validation";
import { api } from "../api";

export interface CaseQualityReport {
  ready: boolean;
  errors: number;
  warnings: number;
  issues: Array<{ severity: "error" | "warning"; code: string; path: string; message: string }>;
  metrics: { states: number; reachableStates: number; orders: number; configuredBehaviors: number; positivePoints: number; negativePoints: number; scenarios: number };
  scenarios: Array<{ id: string; name: string; kind: string; passed: boolean; score?: number; status?: string; clinicalStateId?: string; failures: string[] }>;
}

export const useAdminCaseQuality = () => useMutation({
  mutationFn: (definition: CaseDefinitionInput) => api<{ quality: CaseQualityReport }>("/admin/cases/quality", {
    method: "POST",
    body: JSON.stringify(definition)
  })
});
