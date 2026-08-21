import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { User } from "../types";

export const useSession = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User | null }>("/auth/me"),
    retry: false
  });
