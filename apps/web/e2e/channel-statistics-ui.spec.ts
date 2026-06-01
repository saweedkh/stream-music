import { test, expect } from "@playwright/test";

import { loginInBrowser, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { createChannel } from "./helpers/social";
import { dismissRoomOnboarding } from "./helpers/room";
import { openChannelInsightsTab } from "./helpers/dashboard";

test.describe("channel statistics UI", () => {
  test("owner sees statistics panel in insights tab", async ({ page, request }) => {
    const username = uniqueUsername("stats_ui");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);
    const channel = await createChannel(request, { name: `Stats UI ${Date.now()}`, privacy: "public" });

    await loginInBrowser(page, username, password);
    await openChannelInsightsTab(page, channel.id);
    await dismissRoomOnboarding(page);

    const panel = page.getByTestId("channel-statistics-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText(/listen|گوش|hours|ساعت/i).first()).toBeVisible();
  });
});
