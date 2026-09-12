import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { attemptSocket } from "../realtime";
import type { AttemptState } from "../types";

export const useAttemptSimulator = () => {
  const { attemptId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);

  const attemptQuery = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api<{ attempt: AttemptState }>(`/attempts/${attemptId}/state`),
    enabled: Boolean(attemptId),
    refetchInterval: realtimeConnected ? false : 5000,
    refetchIntervalInBackground: true
  });
  const attempt = attemptQuery.data?.attempt;

  useEffect(() => {
    if (!attempt) return;
    const synchronizeCountdown = () =>
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil((new Date(attempt.realTimeEndsAt).getTime() - (Date.now() + serverClockOffsetMs)) / 1000)
        )
      );
    synchronizeCountdown();
    const timer = window.setInterval(synchronizeCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.realTimeEndsAt, serverClockOffsetMs]);

  useEffect(() => {
    if (!attemptId) return;
    const applyAttempt = ({ attempt }: { attempt: AttemptState }) => {
      setServerClockOffsetMs(new Date(attempt.serverTime).getTime() - Date.now());
      queryClient.setQueryData(["attempt", attemptId], { attempt });
    };
    const synchronizeTimer = (payload: {
      serverTime: string;
      realTimeEndsAt: string;
      finalOrdersStartsAt: string;
      status: AttemptState["status"];
    }) => {
      setServerClockOffsetMs(new Date(payload.serverTime).getTime() - Date.now());
      queryClient.setQueryData<{ attempt: AttemptState }>(["attempt", attemptId], (current) =>
        current
          ? {
              attempt: {
                ...current.attempt,
                serverTime: payload.serverTime,
                realTimeEndsAt: payload.realTimeEndsAt,
                finalOrdersStartsAt: payload.finalOrdersStartsAt,
                status: payload.status
              }
            }
          : current
      );
    };
    const joinAttempt = () => {
      attemptSocket.emit("attempt:join", { attemptId }, (result: { ok: boolean }) => {
        setRealtimeConnected(result.ok);
      });
    };
    const disconnect = () => setRealtimeConnected(false);

    attemptSocket.on("connect", joinAttempt);
    attemptSocket.on("disconnect", disconnect);
    attemptSocket.on("attempt:updated", applyAttempt);
    attemptSocket.on("result:available", applyAttempt);
    attemptSocket.on("patient:updated", applyAttempt);
    attemptSocket.on("vitals:updated", applyAttempt);
    attemptSocket.on("case:final-orders", applyAttempt);
    attemptSocket.on("case:completed", applyAttempt);
    attemptSocket.on("timer:synchronized", synchronizeTimer);
    attemptSocket.connect();
    if (attemptSocket.connected) joinAttempt();

    return () => {
      attemptSocket.emit("attempt:leave", { attemptId });
      attemptSocket.off("connect", joinAttempt);
      attemptSocket.off("disconnect", disconnect);
      attemptSocket.off("attempt:updated", applyAttempt);
      attemptSocket.off("result:available", applyAttempt);
      attemptSocket.off("patient:updated", applyAttempt);
      attemptSocket.off("vitals:updated", applyAttempt);
      attemptSocket.off("case:final-orders", applyAttempt);
      attemptSocket.off("case:completed", applyAttempt);
      attemptSocket.off("timer:synchronized", synchronizeTimer);
      attemptSocket.disconnect();
      setRealtimeConnected(false);
    };
  }, [attemptId, queryClient]);

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
    realtimeConnected,
    submitAction,
    leaveSimulator: () => navigate("/cases")
  };
};
