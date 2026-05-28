import { describe, it, expect } from "vitest";

describe("API utilities", () => {
  it("getApiBase returns localhost in Node environment", async () => {
    const { getApiBase } = await import("@/lib/api");
    expect(getApiBase()).toBe("http://localhost:8000");
  });
});
