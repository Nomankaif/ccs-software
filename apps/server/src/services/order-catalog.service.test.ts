import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderCatalogModel } from "../models/index.js";
import { resolveCatalogOrders } from "./order-catalog.service.js";

afterEach(() => vi.restoreAllMocks());

describe("Case-specific result timing", () => {
  it.each([0, 3, 15])("preserves a case delay of %i minutes", async (minutes) => {
    vi.spyOn(OrderCatalogModel, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue([{
        orderId: "cxr", name: "Chest x-ray", category: "Imaging", aliases: [],
        defaultResultDelayMinutes: 30
      }])
    } as never);
    const [order] = await resolveCatalogOrders([{
      id: "cxr", name: "Chest x-ray", category: "Imaging", aliases: [],
      resultDelayMinutes: minutes
    }]);
    expect(order.resultDelayMinutes).toBe(minutes);
  });

  it("retains a configured delay when the catalog has no delay", async () => {
    vi.spyOn(OrderCatalogModel, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue([{
        orderId: "saline", name: "Saline", category: "Medication", aliases: []
      }])
    } as never);
    const [order] = await resolveCatalogOrders([{
      id: "saline", name: "Saline", category: "Medication", aliases: [], resultDelayMinutes: 3
    }]);
    expect(order.resultDelayMinutes).toBe(3);
  });

  it("uses the catalog default when no case delay is supplied", async () => {
    vi.spyOn(OrderCatalogModel, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue([{
        orderId: "cxr", name: "Chest x-ray", category: "Imaging", aliases: [],
        defaultResultDelayMinutes: 30
      }])
    } as never);
    const [order] = await resolveCatalogOrders([{
      id: "cxr", name: "Chest x-ray", category: "Imaging", aliases: []
    }]);
    expect(order.resultDelayMinutes).toBe(30);
  });
});
