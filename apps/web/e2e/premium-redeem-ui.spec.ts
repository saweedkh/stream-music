import { test, expect } from "@playwright/test";

import { loginInBrowser, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { openDashboardSettingsOverview, seedE2EPremiumCode } from "./helpers/dashboard";

test.describe("premium redeem UI", () => {
  test("redeems invite code from dashboard overview", async ({ page, request }) => {
    const username = uniqueUsername("premium_ui");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);
    const code = await seedE2EPremiumCode(request);

    await loginInBrowser(page, username, password);
    await openDashboardSettingsOverview(page);

    await page.getByTestId("premium-redeem-input").fill(code);
    await page.getByTestId("premium-redeem-submit").click();

    await expect(page.getByText(/premium activated|پریمیوم فعال شد/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("premium-redeem-input")).toHaveValue("");
  });
});
