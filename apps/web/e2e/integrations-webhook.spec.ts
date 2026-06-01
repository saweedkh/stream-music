import { test, expect } from "@playwright/test";

import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { createChannel } from "./helpers/social";

test("user can register outbound webhook subscription", async ({ request }) => {
  const username = uniqueUsername("wh");
  await registerAndLogin(request, username);
  const csrf = await fetchCsrf(request);

  const res = await request.post(`${apiURL}/api/me/webhooks`, {
    data: { url: "https://example.com/hook", events: ["channel.live"] },
    headers: { "X-CSRFToken": csrf },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id?: number; secret?: string };
  expect(body.id).toBeTruthy();
  expect(body.secret).toBeTruthy();

  const list = await request.get(`${apiURL}/api/me/webhooks`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(list.ok()).toBeTruthy();
});

test("public API token lists owned channels", async ({ request }) => {
  const username = uniqueUsername("api_token");
  await registerAndLogin(request, username);
  const channel = await createChannel(request, { name: `API ${Date.now()}`, privacy: "public" });
  const csrf = await fetchCsrf(request);

  const tokRes = await request.post(`${apiURL}/api/me/api-tokens`, {
    data: { name: "e2e", scopes: ["read:channels"] },
    headers: { "X-CSRFToken": csrf },
  });
  expect(tokRes.ok()).toBeTruthy();
  const { token } = (await tokRes.json()) as { token: string };

  const pub = await request.get(`${apiURL}/api/public/v1/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(pub.ok()).toBeTruthy();
  const data = (await pub.json()) as { results: Array<{ id: number }> };
  expect(data.results.some((r) => r.id === channel.id)).toBeTruthy();
});
