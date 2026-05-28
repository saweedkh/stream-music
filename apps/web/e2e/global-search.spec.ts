import { test, expect } from "@playwright/test";
import { registerAndLogin, uniqueUsername } from "./helpers/auth";
import { apiURL } from "./helpers/auth";

test("global search returns users and shared_playlists keys", async ({ request }) => {
  const username = uniqueUsername("search");
  await registerAndLogin(request, username, "pw12345678");
  const res = await request.get(`${apiURL}/api/search/global?q=te`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { users: unknown[]; shared_playlists: unknown[] };
  expect(Array.isArray(body.users)).toBeTruthy();
  expect(Array.isArray(body.shared_playlists)).toBeTruthy();
});
