import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseModel } from "../models/case.model.js";
import { AttemptModel } from "../models/attempt.model.js";
import { deleteCase, updateCaseVersion, publishCaseVersion } from "./case.service.js";
import type { CaseDefinitionInput } from "@ccs/validation";

vi.mock("./order-catalog.service.js", () => ({ ensureCatalogOrders: vi.fn(), resolveCatalogOrders: vi.fn().mockResolvedValue([]) }));
afterEach(() => vi.restoreAllMocks());

describe("Simple case management", () => {
  it("lets writers save drafts but not change published cases", async () => {
    const entry = { _id: "case-1", slug: "example", status: "published", save: vi.fn() };
    vi.spyOn(CaseModel, "findById").mockResolvedValue(entry as never);
    vi.spyOn(CaseModel, "updateMany").mockResolvedValue({} as never);
    const definition = { slug: "example", orders: [] } as unknown as CaseDefinitionInput;
    await expect(updateCaseVersion("case-1", definition, "writer-1", "writer")).rejects.toMatchObject({ statusCode: 403 });
    expect(entry.save).not.toHaveBeenCalled();
    entry.status = "draft";
    await updateCaseVersion("case-1", definition, "writer-1", "writer");
    expect(entry.status).toBe("draft");
    expect(entry.save).toHaveBeenCalledOnce();
  });
  it("updates a published case in place as a draft without creating another version", async () => {
    const entry = { _id: "case-1", slug: "example", status: "published", version: 3, definition: {}, save: vi.fn() };
    vi.spyOn(CaseModel, "findById").mockResolvedValue(entry as never);
    vi.spyOn(CaseModel, "updateMany").mockResolvedValue({} as never);
    const create = vi.spyOn(CaseModel, "create");
    const definition = { slug: "example", orders: [], title: "Edited" } as unknown as CaseDefinitionInput;
    const result = await updateCaseVersion("case-1", definition, "admin-1", "admin");
    expect(result).toBe(entry);
    expect(entry.status).toBe("draft");
    expect(entry.version).toBe(3);
    expect(entry.definition).toMatchObject({ title: "Edited" });
    expect(create).not.toHaveBeenCalled();
    expect(entry.save).toHaveBeenCalledOnce();
  });
  it("deletes all legacy records for the case without touching attempts", async () => {
    vi.spyOn(CaseModel, "findById").mockResolvedValue({ slug: "example" } as never);
    const update = vi.spyOn(CaseModel, "updateMany").mockResolvedValue({} as never);
    const removeAttempts = vi.spyOn(AttemptModel, "deleteMany");
    await deleteCase("case-1");
    expect(update).toHaveBeenCalledWith({ slug: "example", deletedAt: null }, { $set: { deletedAt: expect.any(Date), status: "retired", retiredAt: expect.any(Date) } });
    expect(removeAttempts).not.toHaveBeenCalled();
  });
  it("does not permit publishing a deleted case", async () => {
    vi.spyOn(CaseModel, "findById").mockResolvedValue({ deletedAt: new Date() } as never);
    await expect(publishCaseVersion("deleted")).rejects.toMatchObject({ statusCode: 404 });
  });
  it("still validates a draft before publication without requiring approval", async () => {
    vi.spyOn(CaseModel, "findById").mockResolvedValue({ status: "draft", definition: {} } as never);
    await expect(publishCaseVersion("case-1")).rejects.toMatchObject({ statusCode: 422 });
  });
});
