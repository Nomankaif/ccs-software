import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import type { CatalogOrder } from "../types";
import { useAdminOrderCatalog } from "./useAdminOrderCatalog";

export interface CatalogOrderDraft {
  id: string;
  name: string;
  aliases: string;
  category: CatalogOrder["category"];
  route: string;
  dose: string;
  frequency: string;
  duration: string;
  priority: string;
  resultDelayMinutes: string;
  active: boolean;
}

const emptyDraft: CatalogOrderDraft = {
  id: "",
  name: "",
  aliases: "",
  category: "Laboratory",
  route: "",
  dose: "",
  frequency: "",
  duration: "",
  priority: "",
  resultDelayMinutes: "",
  active: true
};

const toPayload = (draft: CatalogOrderDraft) => ({
  id: draft.id.trim(),
  name: draft.name.trim(),
  aliases: draft.aliases.split(",").map((item) => item.trim()).filter(Boolean),
  category: draft.category,
  route: draft.route ? draft.route.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
  dose: draft.dose ? draft.dose.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
  frequency: draft.frequency
    ? draft.frequency.split(",").map((item) => item.trim()).filter(Boolean)
    : undefined,
  duration: draft.duration ? draft.duration.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
  priority: draft.priority ? draft.priority.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
  resultDelayMinutes: draft.resultDelayMinutes === "" ? undefined : Number(draft.resultDelayMinutes),
  active: draft.active
});

export const useAdminOrders = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CatalogOrderDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] });

  const ordersQuery = useAdminOrderCatalog();
  const saveOrder = useMutation({
    mutationFn: () =>
      api(editingId ? `/admin/orders/${encodeURIComponent(editingId)}` : "/admin/orders", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(toPayload(draft))
      }),
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setDraft(emptyDraft);
    }
  });
  const toggleOrder = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/admin/orders/${encodeURIComponent(id)}/${active ? "restore" : "archive"}`, {
        method: "POST"
      }),
    onSuccess: refresh
  });

  const editOrder = (order: CatalogOrder) => {
    setEditingId(order.id);
    setDraft({
      id: order.id,
      name: order.name,
      aliases: order.aliases.join(", "),
      category: order.category,
      route: order.route?.join(", ") ?? "",
      dose: order.dose?.join(", ") ?? "",
      frequency: order.frequency?.join(", ") ?? "",
      duration: order.duration?.join(", ") ?? "",
      priority: order.priority?.join(", ") ?? "",
      resultDelayMinutes: order.resultDelayMinutes?.toString() ?? "",
      active: order.active
    });
  };

  return {
    ordersQuery,
    draft,
    editingId,
    saveOrder,
    toggleOrder,
    updateDraft: <K extends keyof CatalogOrderDraft>(key: K, value: CatalogOrderDraft[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    editOrder,
    resetEditor: () => {
      setEditingId(null);
      setDraft(emptyDraft);
    }
  };
};
