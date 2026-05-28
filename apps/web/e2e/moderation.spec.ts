import { test, expect, request as playwrightRequest } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";

test("chat report and temp ban API", async ({ request }) => {
  const owner = uniqueUsername("mod_owner");
  const member = uniqueUsername("mod_member");
  const password = "pw12345678";

  await registerAndLogin(request, owner, password);
  let csrf = await fetchCsrf(request);
  const channelRes = await request.post(`${apiURL}/api/channels/`, {
    data: { name: `Mod ${Date.now()}`, description: "e2e mod" },
    headers: { "X-CSRFToken": csrf },
  });
  const channel = (await channelRes.json()) as { id: number };

  const memberCtx = await playwrightRequest.newContext({ baseURL: apiURL });
  await registerAndLogin(memberCtx, member, password);
  csrf = await fetchCsrf(memberCtx);
  const join = await memberCtx.post(`${apiURL}/api/channels/${channel.id}/join`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(join.ok()).toBeTruthy();
  const me = await memberCtx.get(`${apiURL}/api/auth/me`);
  const memberUser = (await me.json()) as { user: { id: number } };

  csrf = await fetchCsrf(request);
  const chatPost = await request.post(`${apiURL}/api/channels/${channel.id}/chat`, {
    data: { body: "hello moderation e2e" },
    headers: { "X-CSRFToken": csrf },
  });
  expect(chatPost.ok()).toBeTruthy();
  const msg = (await chatPost.json()) as { id: number };

  csrf = await fetchCsrf(memberCtx);
  const report = await memberCtx.post(`${apiURL}/api/channels/${channel.id}/chat/report`, {
    data: { message_id: msg.id, reason: "spam test" },
    headers: { "X-CSRFToken": csrf },
  });
  expect(report.ok()).toBeTruthy();

  csrf = await fetchCsrf(request);
  const ban = await request.post(`${apiURL}/api/channels/${channel.id}/moderation/bans/${memberUser.user.id}`, {
    data: { hours: 1, reason: "e2e" },
    headers: { "X-CSRFToken": csrf },
  });
  expect(ban.ok()).toBeTruthy();

  const reports = await request.get(`${apiURL}/api/channels/${channel.id}/moderation/reports`, {
    headers: { "X-CSRFToken": await fetchCsrf(request) },
  });
  expect(reports.ok()).toBeTruthy();
  const list = (await reports.json()) as { results: Array<{ message_id: number }> };
  expect(list.results.some((r) => r.message_id === msg.id)).toBeTruthy();

  await memberCtx.dispose();
});
