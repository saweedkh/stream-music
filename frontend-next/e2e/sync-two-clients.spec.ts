import { test, expect } from "@playwright/test";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("sync smoke", () => {
  test("health and login pages load", async ({ page, request }) => {
    const health = await request.get(`${apiURL}/api/health`);
    expect(health.ok()).toBeTruthy();
    await page.goto(`${baseURL}/login`);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});
