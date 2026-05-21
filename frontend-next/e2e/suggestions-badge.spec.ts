import { test, expect, request as playwrightRequest } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { minimalWavBytes } from "./helpers/minimal-wav";

test("pending suggestion count updates via API after submit", async ({ request }) => {
  const owner = uniqueUsername("sug_owner");
  const listener = uniqueUsername("sug_listener");
  const password = "pw12345678";

  await registerAndLogin(request, owner, password);
  let csrf = await fetchCsrf(request);
  const channelRes = await request.post(`${apiURL}/api/channels/`, {
    data: { name: `Suggestions ${Date.now()}`, description: "e2e" },
    headers: { "X-CSRFToken": csrf },
  });
  expect(channelRes.ok()).toBeTruthy();
  const channel = (await channelRes.json()) as { id: number };

  const trackRes = await request.post(`${apiURL}/api/tracks/`, {
    multipart: {
      title: "Suggest me",
      file: { name: "t.wav", mimeType: "audio/wav", buffer: minimalWavBytes() },
    },
    headers: { "X-CSRFToken": await fetchCsrf(request) },
  });
  const track = (await trackRes.json()) as { id: number };

  const listenerCtx = await playwrightRequest.newContext({ baseURL: apiURL });
  await registerAndLogin(listenerCtx, listener, password);
  csrf = await fetchCsrf(listenerCtx);
  await listenerCtx.post(`${apiURL}/api/channels/${channel.id}/join`, {
    headers: { "X-CSRFToken": csrf },
  });

  const pendingBefore = await request.get(`${apiURL}/api/channels/${channel.id}/suggestions?status=pending`, {
    headers: { cookie: (await request.storageState()).cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
  });
  expect(pendingBefore.ok()).toBeTruthy();

  csrf = await fetchCsrf(listenerCtx);
  const create = await listenerCtx.post(`${apiURL}/api/channels/${channel.id}/suggestions`, {
    data: { track_id: track.id, note: "e2e suggestion" },
    headers: { "X-CSRFToken": csrf },
  });
  expect(create.status()).toBe(201);

  const pendingAfter = await request.get(`${apiURL}/api/channels/${channel.id}/suggestions?status=pending`, {
    headers: { cookie: (await request.storageState()).cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
  });
  const body = (await pendingAfter.json()) as { results: unknown[] };
  expect(body.results.length).toBeGreaterThanOrEqual(1);

  await listenerCtx.dispose();
});
