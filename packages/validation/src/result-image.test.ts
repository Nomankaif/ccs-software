import { describe, expect, it } from "vitest";
import { resultDefinitionSchema } from "./index";

const report = { orderId: "cxr", category: "Imaging", value: "Report" };
describe("Optional report images", () => {
  it("keeps text-only reports valid", () => {
    expect(resultDefinitionSchema.safeParse(report).success).toBe(true);
  });
  it("preserves an uploaded image", () => {
    const imageDataUrl = "data:image/png;base64,aGVsbG8=";
    expect(resultDefinitionSchema.parse({ ...report, imageDataUrl }).imageDataUrl).toBe(imageDataUrl);
  });
  it.each(["https://example.com/image.png", "data:image/svg+xml;base64,aGVsbG8=", "javascript:alert(1)", `data:image/png;base64,${"a".repeat(700000)}`])("rejects unsafe or oversized attachments", imageDataUrl => {
    expect(resultDefinitionSchema.safeParse({ ...report, imageDataUrl }).success).toBe(false);
  });
});
