import { AbilityBuilder, createMongoAbility, subject, type MongoAbility, type ForcedSubject } from "@casl/ability";
export type UserRole = "student" | "admin" | "subadmin" | "writer";
export type PermissionAction = "manage" | "read" | "create" | "update" | "delete" | "publish" | "retire";
export type PermissionSubject = "AdminPortal" | "Case" | "Order" | "Student" | "Employee" | "Analytics" | "Audit" | "all";
type CaseSubject = { status: string } & ForcedSubject<"Case">;
export type AppAbility = MongoAbility<[PermissionAction, PermissionSubject | CaseSubject]>;
export function defineAbility(role?: string): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (role === "admin" || role === "subadmin") can("manage", "all");
  if (role === "writer") {
    can("read", "AdminPortal");
    can(["read", "create"], "Case");
    can("update", "Case", { status: "draft" });
    can("manage", "Order");
  }
  return build();
}
export const caseSubject = (status: string) => subject("Case", { status });
