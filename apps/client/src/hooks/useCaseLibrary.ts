import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { AttemptState, LibraryCase } from "../types";

export const useCaseLibrary = () => {
  const navigate = useNavigate();
  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => api<{ cases: LibraryCase[] }>("/cases")
  });
  const startAttempt = useMutation({
    mutationFn: (caseId: string) =>
      api<{ attempt: AttemptState }>("/attempts", {
        method: "POST",
        body: JSON.stringify({ caseId })
      }),
    onSuccess: ({ attempt }) => navigate(`/attempts/${attempt.attemptId}`)
  });

  return { casesQuery, startAttempt };
};
