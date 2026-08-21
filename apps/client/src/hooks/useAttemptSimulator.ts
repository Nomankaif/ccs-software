import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { AttemptState } from "../types";

export const useAttemptSimulator = () => {
  const { attemptId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [secondsLeft, setSecondsLeft] = useState(0);

  const attemptQuery = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api<{ attempt: AttemptState }>(`/attempts/${attemptId}/state`),
    enabled: Boolean(attemptId),
    refetchInterval: 5000,
    refetchIntervalInBackground: true
  });
  const attempt = attemptQuery.data?.attempt;

  useEffect(() => {
    if (!attempt) return;
    const synchronizeCountdown = () =>
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil((new Date(attempt.realTimeEndsAt).getTime() - Date.now()) / 1000)
        )
      );
    synchronizeCountdown();
    const timer = window.setInterval(synchronizeCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.realTimeEndsAt]);

  const submitAction = useMutation({
    mutationFn: (action: Record<string, unknown>) =>
      api<{ attempt: AttemptState }>(`/attempts/${attemptId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          expectedRevision: attempt!.revision,
          idempotencyKey: crypto.randomUUID(),
          action
        })
      }),
    onSuccess: (data) => queryClient.setQueryData(["attempt", attemptId], data),
    onError: () => attemptQuery.refetch()
  });

  return {
    attempt,
    attemptQuery,
    secondsLeft,
    submitAction,
    leaveSimulator: () => navigate("/cases")
  };
};
