import { test, expect } from "@playwright/test";

import { apiURL, fetchCsrf, loginInBrowser, registerAndLogin, uniqueUsername } from "./helpers/auth";

test.describe("playlist backup export UI", () => {
  test("downloads JSON backup from playlists tab", async ({ page, request }) => {
    const username = uniqueUsername("pl_backup");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);

    const csrf = await fetchCsrf(request);
    const plRes = await request.post(`${apiURL}/api/playlists/`, {
      data: { name: `Backup ${Date.now()}` },
      headers: { "X-CSRFToken": csrf },
    });
    expect(plRes.ok()).toBeTruthy();

    await loginInBrowser(page, username, password);
    await page.goto("/dashboard?tab=playlists");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("playlist-backup-export").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/stream-music-playlists-.+\.json$/);

    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
