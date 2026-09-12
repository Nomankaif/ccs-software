import type { CaseDefinitionInput } from "@ccs/validation";

export type ReferenceOption = { value: string; label: string };
export function useCaseReferences(definition: Pick<CaseDefinitionInput, "orders" | "clinicalStates" | "allowedLocations" | "exam" | "results">) {
  const orders = definition.orders.map(({ id, name }) => ({ value: id, label: `${name} (${id})` }));
  const states = (definition.clinicalStates ?? []).map(({ id }) => ({ value: id, label: id }));
  const locations = definition.allowedLocations.map((value) => ({ value, label: value }));
  const exams = Object.keys(definition.exam).map((value) => ({ value, label: value }));
  const results = orders.filter((order) => definition.results.some((result) => result.orderId === order.value));
  const scoreOptions = (action: CaseDefinitionInput["scoreRules"][number]["actionType"]) => {
    if (action === "clinical_state") return states;
    if (action === "exam") return exams;
    if (action === "location") return locations;
    if (action === "result") return results;
    return orders;
  };
  return { orders, states, locations, exams, results, scoreOptions };
}
