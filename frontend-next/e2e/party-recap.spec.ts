import { test, expect } from "@playwright/test";
import { apiURL, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { createChannel } from "./helpers/social";

test("party recap includes heatmap buckets", async ({ request }) => {
  const username = uniqueUsername("party");
  await registerAndLogin(request, username, "pw12345678");
  const channel = await createChannel(request, { name: `Party ${Date.now()}`, privacy: "public" });
  const res = await request.get(`${apiURL}/api/channels/${channel.id}/party-recap`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { excitement_heatmap?: { buckets: unknown[] } };
  expect(body.excitement_heatmap).toBeDefined();
  expect(Array.isArray(body.excitement_heatmap?.buckets)).toBeTruthy();
});
