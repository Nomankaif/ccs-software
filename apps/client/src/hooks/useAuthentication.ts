import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { User } from "../types";

export type AuthenticationMode = "login" | "register";

export const useAuthentication = (mode: AuthenticationMode) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: User }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["me"], { user });
      navigate(user.role === "admin" ? "/admin" : "/cases", { replace: true });
    }
  });
};
