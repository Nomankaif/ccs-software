import { describe, it, expect } from "vitest";
import { defineAbility, caseSubject } from "./permissions";

describe("staff permissions", () => {
  it.each(["admin", "subadmin"])("grants %s full administration", role => {
    const ability = defineAbility(role);
    expect(ability.can("manage", "all")).toBe(true);
    expect(ability.can("publish", "Case")).toBe(true);
    expect(ability.can("update", caseSubject("published"))).toBe(true);
  });
  it("limits writers to catalog and draft authoring", () => {
    const ability = defineAbility("writer");
    expect(ability.can("read", "AdminPortal")).toBe(true);
    expect(ability.can("manage", "Order")).toBe(true);
    expect(ability.can("create", "Case")).toBe(true);
    expect(ability.can("update", caseSubject("draft"))).toBe(true);
    for (const status of ["published", "retired"]) expect(ability.can("update", caseSubject(status))).toBe(false);
    for (const action of ["publish", "retire", "delete"] as const) expect(ability.can(action, "Case")).toBe(false);
    for (const resource of ["Student", "Employee", "Analytics", "Audit"] as const) expect(ability.can("read", resource)).toBe(false);
  });
  it.each(["student", "reviewer", "invalid", undefined])("denies staff access for %s", role => {
    expect(defineAbility(role).can("read", "AdminPortal")).toBe(false);
  });
});
