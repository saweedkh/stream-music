/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("API utilities", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DEV_REMOTE_ORIGIN;
    delete process.env.INTERNAL_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getApiBase uses INTERNAL_API_BASE_URL in Node", async () => {
    vi.stubEnv("INTERNAL_API_BASE_URL", "http://localhost:8000");
    const { getApiBase } = await import("@/lib/api");
    expect(getApiBase()).toBe("http://localhost:8000");
  });

  it("getApiBase falls back to default when unset", async () => {
    const { getApiBase } = await import("@/lib/api");
    expect(getApiBase()).toBe("http://localhost:8000");
  });
});
