import type { AttemptAction, PlacedOrder, ScoreReport } from "./index";

export const calculateScore = (orders: PlacedOrder[], actions: AttemptAction[]): ScoreReport => {
  const names = new Set(orders.map((order) => order.name.toLowerCase()));
  const examined = actions.some((action) => action.type === "exam");
  const criteria = [
    ["Targeted physical examination", examined, 15],
    ["Electrocardiogram", names.has("electrocardiogram, 12-lead"), 15],
    ["Cardiac monitoring", names.has("cardiac monitor"), 10],
    ["Aspirin", names.has("aspirin"), 15],
    ["Troponin", names.has("troponin i"), 15],
    ["Chest radiograph", names.has("chest x-ray"), 10],
    ["Cardiology consultation", names.has("consult, cardiology"), 10],
    [
      "Appropriate disposition",
      actions.some((action) => action.type === "location" && action.summary.includes("Inpatient")),
      10
    ]
  ] as const;
  const total = criteria.reduce((sum, [, met, points]) => sum + (met ? points : 0), 0);

  return {
    total,
    domains: [
      { label: "Diagnosis", score: Math.min(30, total), max: 30 },
      { label: "Therapy", score: names.has("aspirin") ? 20 : 5, max: 20 },
      { label: "Monitoring", score: names.has("cardiac monitor") ? 15 : 5, max: 15 },
      { label: "Timing & sequence", score: total >= 60 ? 15 : 7, max: 15 },
      {
        label: "Location",
        score: actions.some((action) => action.summary.includes("Inpatient")) ? 20 : 8,
        max: 20
      }
    ],
    ideal: criteria.filter(([, met]) => met).map(([label]) => label),
    missed: criteria.filter(([, met]) => !met).map(([label]) => label),
    harmful: names.has("exercise stress test")
      ? ["Exercise testing before acute coronary syndrome was excluded"]
      : [],
    rationale:
      "Early evaluation, monitoring, antiplatelet therapy, cardiac biomarkers, and an appropriate level of care are central to this presentation."
  };
};
