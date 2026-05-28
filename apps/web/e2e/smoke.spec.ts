import { test, expect } from "@playwright/test";

import { apiURL } from "./helpers/auth";

test.describe("smoke", () => {
  test("backend health responds", async ({ request }) => {
    const res = await request.get(`${apiURL}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });
});
