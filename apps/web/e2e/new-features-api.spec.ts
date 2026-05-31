import { test, expect } from "@playwright/test";

import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { createChannel } from "./helpers/social";
import { minimalWavBytes } from "./helpers/minimal-wav";

test.describe("new features API", () => {
  test("channel statistics and gamification endpoints", async ({ request }) => {
    const username = uniqueUsername("stats");
    await registerAndLogin(request, username);
    const channel = await createChannel(request, { name: `Stats ${Date.now()}`, privacy: "public" });

    const statsRes = await request.get(`${apiURL}/api/channels/${channel.id}/statistics`);
    expect(statsRes.ok()).toBeTruthy();
    const stats = (await statsRes.json()) as { total_listen_seconds?: number };
    expect(typeof stats.total_listen_seconds).toBe("number");

    const gamRes = await request.get(`${apiURL}/api/auth/me/gamification`);
    expect(gamRes.ok()).toBeTruthy();
    const gam = (await gamRes.json()) as { level?: number; points?: number };
    expect(typeof gam.level).toBe("number");
    expect(typeof gam.points).toBe("number");
  });

  test("blind guess round-trip when blind mode enabled", async ({ request }) => {
    const username = uniqueUsername("blind");
    await registerAndLogin(request, username);
    const channel = await createChannel(request, { name: `Blind ${Date.now()}`, privacy: "public" });
    const csrf = await fetchCsrf(request);

    const wav = minimalWavBytes();
    const trackRes = await request.post(`${apiURL}/api/tracks/`, {
      multipart: {
        title: "Blind Beep",
        file: { name: "blind.wav", mimeType: "audio/wav", buffer: wav },
      },
      headers: { "X-CSRFToken": csrf },
    });
    expect(trackRes.ok()).toBeTruthy();
    const track = (await trackRes.json()) as { id: number };

    const plRes = await request.post(`${apiURL}/api/playlists/`, {
      data: { name: "Blind PL", channel: channel.id },
      headers: { "X-CSRFToken": csrf },
    });
    expect(plRes.ok()).toBeTruthy();
    const playlist = (await plRes.json()) as { id: number };

    const settingsRes = await request.patch(`${apiURL}/api/channels/${channel.id}/settings`, {
      data: { experience: { blind_playlist_id: playlist.id } },
      headers: { "X-CSRFToken": csrf },
    });
    expect(settingsRes.ok()).toBeTruthy();

    const guessRes = await request.post(`${apiURL}/api/channels/${channel.id}/blind-guess`, {
      data: { track_id: track.id, guess: "Blind Beep" },
      headers: { "X-CSRFToken": csrf },
    });
    expect(guessRes.ok()).toBeTruthy();

    const listRes = await request.get(
      `${apiURL}/api/channels/${channel.id}/blind-guess?track_id=${track.id}`,
    );
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as { results: Array<{ guess_text: string }> };
    expect(list.results.some((r) => r.guess_text === "Blind Beep")).toBeTruthy();
  });
});
