import { test, expect } from "@playwright/test";

import { apiURL, fetchCsrf, loginInBrowser, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { createChannel } from "./helpers/social";
import { dismissRoomOnboarding } from "./helpers/room";
import { minimalWavBytes } from "./helpers/minimal-wav";

test("blind guess panel visible when blind mode enabled", async ({ page, request }) => {
  const username = uniqueUsername("blind_ui");
  const password = "pw12345678";
  await registerAndLogin(request, username, password);
  const channel = await createChannel(request, { name: `Blind UI ${Date.now()}`, privacy: "public" });
  const csrf = await fetchCsrf(request);

  const trackRes = await request.post(`${apiURL}/api/tracks/`, {
    multipart: {
      title: "Blind UI Track",
      file: { name: "b.wav", mimeType: "audio/wav", buffer: minimalWavBytes() },
    },
    headers: { "X-CSRFToken": csrf },
  });
  const track = (await trackRes.json()) as { id: number };

  const plRes = await request.post(`${apiURL}/api/playlists/`, {
    data: { name: "Blind PL" },
    headers: { "X-CSRFToken": csrf },
  });
  const playlist = (await plRes.json()) as { id: number };

  await request.patch(`${apiURL}/api/channels/${channel.id}/settings`, {
    data: { experience: { blind_playlist_id: playlist.id } },
    headers: { "X-CSRFToken": csrf },
  });

  await request.post(`${apiURL}/api/channels/${channel.id}/tracks/${track.id}/play`, {
    headers: { "X-CSRFToken": csrf },
  });

  await loginInBrowser(page, username, password);
  await page.goto(`/channel/${channel.id}?tab=info`);
  await dismissRoomOnboarding(page);

  await expect(page.getByTestId("channel-blind-guess-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("blind-guess-input").fill("Blind UI Track");
  await page.getByTestId("blind-guess-submit").click();
  await expect(page.getByText(/Blind UI Track/i)).toBeVisible({ timeout: 15_000 });
});
