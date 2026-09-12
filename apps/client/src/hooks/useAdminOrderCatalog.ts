import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { CatalogOrder } from "../types";

export const useAdminOrderCatalog = () =>
  useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api<{ orders: CatalogOrder[] }>("/admin/orders?includeInactive=true")
  });
