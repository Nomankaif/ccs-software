import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.setQueryData(["me"], { user: null });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "me"
      });
      navigate("/login", { replace: true });
    }
  });
};
