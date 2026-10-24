import { describe, expect, it } from "vitest";
import type { CaseDefinitionInput } from "@ccs/validation";
import { resultMinutes, setResultMinutes } from "./order-timing";

const definition = {
  orders: [{ id: "cbc", resultDelayMinutes: 5 }, { id: "cxr", resultDelayMinutes: 3 }],
  orderBehaviors: [{ orderId: "cbc", classification: "neutral", processingMinutes: 0, responseDelayMinutes: 2, targetStateId: "improved" }]
} as CaseDefinitionInput;

describe("Single result-time field", () => {
  it("displays existing overrides, including immediate results", () => {
    expect(resultMinutes(definition, "cbc")).toBe(0);
    expect(resultMinutes(definition, "cxr")).toBe(3);
  });
  it("replaces the override without changing patient effects or other orders", () => {
    const next = { ...definition, ...setResultMinutes(definition, "cbc", 8) };
    expect(resultMinutes(next, "cbc")).toBe(8);
    expect(next.orderBehaviors![0]).not.toHaveProperty("processingMinutes");
    expect(next.orderBehaviors![0]).toMatchObject({ responseDelayMinutes: 2, targetStateId: "improved" });
    expect(next.orders[1]).toEqual(definition.orders[1]);
    expect(definition.orderBehaviors![0].processingMinutes).toBe(0);
  });
  it("allows clearing or explicitly setting zero", () => {
    expect(resultMinutes({ ...definition, ...setResultMinutes(definition, "cbc", undefined) }, "cbc")).toBeUndefined();
    expect(resultMinutes({ ...definition, ...setResultMinutes(definition, "cbc", 0) }, "cbc")).toBe(0);
  });
});
