import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CaseDefinitionInput } from "@ccs/validation";
import { api } from "../api";
import type { AdminCase, CaseVersionHistory } from "../types";

export const useAdminCases = () => {
  const queryClient = useQueryClient();
  const refreshCases = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-cases"] });
    queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  const casesQuery = useQuery({
    queryKey: ["admin-cases"],
    queryFn: () => api<{ cases: AdminCase[] }>("/admin/cases")
  });
  const createCase = useMutation({
    mutationFn: (body: CaseDefinitionInput | CaseDefinitionInput[]) =>
      api("/admin/cases/import", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    onSuccess: refreshCases
  });
  const publishCase = useMutation({
    mutationFn: (id: string) => api(`/admin/cases/${id}/publish`, { method: "POST" }),
    onSuccess: refreshCases
  });
  const updateCase = useMutation({
    mutationFn: ({ id, definition }: { id: string; definition: CaseDefinitionInput }) =>
      api(`/admin/cases/${id}`, { method: "PUT", body: JSON.stringify(definition) }),
    onSuccess: refreshCases
  });
  const submitForReview = useMutation({
    mutationFn: ({ id, comment = "" }: { id: string; comment?: string }) =>
      api(`/admin/cases/${id}/submit-review`, { method: "POST", body: JSON.stringify({ comment }) }),
    onSuccess: refreshCases
  });
  const reviewCase = useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: "approved" | "changes_requested"; comment: string }) =>
      api(`/admin/cases/${id}/review`, { method: "POST", body: JSON.stringify({ decision, comment }) }),
    onSuccess: refreshCases
  });
  const loadHistory = useMutation({
    mutationFn: (id: string) => api<CaseVersionHistory>(`/admin/cases/${id}/history`)
  });
  const retireCase = useMutation({
    mutationFn: (id: string) => api(`/admin/cases/${id}/retire`, { method: "POST" }),
    onSuccess: refreshCases
  });
  const deleteCase = useMutation({
    mutationFn: (id: string) => api(`/admin/cases/${id}`, { method: "DELETE" }),
    onSuccess: refreshCases
  });

  return { casesQuery, createCase, updateCase, submitForReview, reviewCase, loadHistory, publishCase, retireCase, deleteCase };
};
