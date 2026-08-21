import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CaseDefinitionInput } from "@ccs/validation";
import { api } from "../api";
import type { LibraryCase } from "../types";

export const useAdminCases = () => {
  const queryClient = useQueryClient();
  const refreshCases = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-cases"] });
    queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  const casesQuery = useQuery({
    queryKey: ["admin-cases"],
    queryFn: () => api<{ cases: LibraryCase[] }>("/admin/cases")
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
  const retireCase = useMutation({
    mutationFn: (id: string) => api(`/admin/cases/${id}/retire`, { method: "POST" }),
    onSuccess: refreshCases
  });

  return { casesQuery, createCase, publishCase, retireCase };
};
