import { describe, expect, it } from "vitest";
import { useCaseReferences } from "./useCaseReferences";

const definition = {
  orders: [
    { id: "iv", name: "IV access", aliases: [], category: "Procedure" },
    { id: "cbc", name: "CBC", aliases: [], category: "Laboratory" }
  ],
  clinicalStates: [{ id: "better" }, { id: "worse" }],
  allowedLocations: ["Emergency Department", "Home"],
  exam: { "General Appearance": "Tired" },
  results: [{ orderId: "cbc", category: "Lab Reports", value: "Report" }]
} satisfies Parameters<typeof useCaseReferences>[0];

describe("case reference choices", () => {
  it("uses case-specific IDs and only offers relevant references for each score action", () => {
    const refs = useCaseReferences(definition);
    expect(refs.scoreOptions("clinical_state").map((option) => option.value)).toEqual(["better", "worse"]);
    expect(refs.scoreOptions("result").map((option) => option.value)).toEqual(["cbc"]);
    expect(refs.scoreOptions("exam").map((option) => option.value)).toEqual(["General Appearance"]);
    expect(refs.scoreOptions("location").map((option) => option.value)).toEqual(["Emergency Department", "Home"]);
    for (const action of ["order", "order_completed", "order_discontinued"] as const) {
      expect(refs.scoreOptions(action)[0]).toEqual({ value: "iv", label: "IV access (iv)" });
    }
  });

  it("updates choices when an upstream item is removed", () => {
    const refs = useCaseReferences({ ...definition, orders: [], clinicalStates: [] });
    expect(refs.scoreOptions("result")).toEqual([]);
    expect(refs.scoreOptions("clinical_state")).toEqual([]);
  });
});
