import type { CaseDefinitionInput } from "@ccs/validation";

export function resultMinutes(definition: CaseDefinitionInput, orderId: string) {
  return definition.orderBehaviors?.find(item => item.orderId === orderId)?.processingMinutes
    ?? definition.orders.find(item => item.id === orderId)?.resultDelayMinutes;
}

export function setResultMinutes(definition: CaseDefinitionInput, orderId: string, minutes: number | undefined) {
  return {
    orders: definition.orders.map(order => order.id === orderId ? { ...order, resultDelayMinutes: minutes } : order),
    orderBehaviors: (definition.orderBehaviors ?? []).map(behavior => {
      if (behavior.orderId !== orderId) return behavior;
      const { processingMinutes: _override, ...rest } = behavior;
      return rest;
    })
  };
}
