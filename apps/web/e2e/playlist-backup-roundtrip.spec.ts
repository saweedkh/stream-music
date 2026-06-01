import { test, expect } from "@playwright/test";

import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { minimalWavBytes } from "./helpers/minimal-wav";

test("backup export then import restores playlist", async ({ request }) => {
  const username = uniqueUsername("pl_round");
  await registerAndLogin(request, username);
  let csrf = await fetchCsrf(request);

  const trackRes = await request.post(`${apiURL}/api/tracks/`, {
    multipart: {
      title: "Roundtrip Song",
      file: { name: "r.wav", mimeType: "audio/wav", buffer: minimalWavBytes() },
    },
    headers: { "X-CSRFToken": csrf },
  });
  const track = (await trackRes.json()) as { id: number; file_hash?: string };

  csrf = await fetchCsrf(request);
  const plRes = await request.post(`${apiURL}/api/playlists/`, {
    data: { name: "Roundtrip PL" },
    headers: { "X-CSRFToken": csrf },
  });
  const pl = (await plRes.json()) as { id: number };

  csrf = await fetchCsrf(request);
  await request.post(`${apiURL}/api/playlist-items/`, {
    data: { playlist: pl.id, track: track.id, position: 0 },
    headers: { "X-CSRFToken": csrf },
  });

  const exportRes = await request.get(`${apiURL}/api/playlists/backup-export`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(exportRes.ok()).toBeTruthy();
  const backup = await exportRes.json();

  csrf = await fetchCsrf(request);
  const importRes = await request.post(`${apiURL}/api/playlists/backup-import`, {
    data: backup,
    headers: { "X-CSRFToken": csrf },
  });
  expect(importRes.ok()).toBeTruthy();
  const result = (await importRes.json()) as { created_playlists: number; created_items: number };
  expect(result.created_playlists).toBeGreaterThan(0);
  expect(result.created_items).toBeGreaterThan(0);
});
