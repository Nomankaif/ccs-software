import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { defineAbility } from "@ccs/domain";
import type { User } from "../types";

export type AuthenticationMode = "login" | "register";

export const useAuthentication = (mode: AuthenticationMode) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { email: string; password: string; firstName?: string; lastName?: string; confirmPassword?: string }) =>
      api<{ user: User }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["me"], { user });
      navigate(defineAbility(user.role).can("read", "AdminPortal") ? "/admin" : "/cases", { replace: true });
    }
  });
};
