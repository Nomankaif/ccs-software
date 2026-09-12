import { describe, expect, it } from "vitest";
import { filterLibrary, summarizePerformance, type AttemptSummary } from "./student-progress";
import type { StudentCaseSummary } from "../types";

describe("Student progress", () => {
  it("combines title search with specialty and difficulty filters", () => {
    const cases = [{ title: "Fluid practice", opening: "Vomiting", specialty: "Medicine", difficulty: "Beginner" },
      { title: "Heart practice", opening: "Pain", specialty: "Cardiology", difficulty: "Intermediate" }] as StudentCaseSummary[];
    expect(filterLibrary(cases, "FLUID", "Medicine", "Beginner")).toEqual([cases[0]]);
    expect(filterLibrary(cases, "", "Cardiology", "Beginner")).toEqual([]);
    expect(filterLibrary(cases, "vomiting", "", "")).toEqual([cases[0]]);
  });
  it("excludes active scores, includes zero scores, and aggregates domain denominators", () => {
    const attempts = [
      { status: "active", scoreReport: { total: 100, domains: [] } },
      { status: "completed", scoreReport: { total: 0, domains: [{ label: "Therapy", score: 0, max: 50 }] } },
      { status: "expired", scoreReport: { total: 80, domains: [{ label: "Therapy", score: 40, max: 50 }] } },
      { status: "completed", scoreReport: null }
    ] as AttemptSummary[];
    const result = summarizePerformance(attempts);
    expect(result.average).toBe(40);
    expect(result.best).toBe(80);
    expect(result.finished).toBe(3);
    expect(result.domains).toEqual([{ label: "Therapy", score: 40, max: 100, attempts: 2 }]);
  });
  it("does not invent a zero average for an empty history", () => {
    expect(summarizePerformance([]).average).toBeNull();
  });
});
