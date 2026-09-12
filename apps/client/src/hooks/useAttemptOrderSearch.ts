import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrderDefinition } from "@ccs/domain";
import { api } from "../api";

export const useAttemptOrderSearch = (attemptId: string, search: string) => {
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const queryResult = useQuery({
    queryKey: ["attempt-orders", attemptId, debouncedSearch],
    queryFn: () => api<{ orders: OrderDefinition[] }>(
      `/attempts/${attemptId}/orders?search=${encodeURIComponent(debouncedSearch)}`
    ),
    enabled: Boolean(attemptId) && debouncedSearch.length >= 2,
    staleTime: 30_000
  });

  return {
    ...queryResult,
    isDebouncing: search.trim() !== debouncedSearch
  };
};
