import { test, expect, request as playwrightRequest } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";

test("private channel join request approve flow", async ({ request }) => {
  const owner = uniqueUsername("join_owner");
  const applicant = uniqueUsername("join_apply");
  const password = "pw12345678";

  await registerAndLogin(request, owner, password);
  let csrf = await fetchCsrf(request);
  const channelRes = await request.post(`${apiURL}/api/channels/`, {
    data: {
      name: `Private ${Date.now()}`,
      privacy: "private",
      join_requires_approval: true,
    },
    headers: { "X-CSRFToken": csrf },
  });
  expect(channelRes.ok()).toBeTruthy();
  const channel = (await channelRes.json()) as { id: number };

  const applicantCtx = await playwrightRequest.newContext({ baseURL: apiURL });
  await registerAndLogin(applicantCtx, applicant, password);
  csrf = await fetchCsrf(applicantCtx);
  const join = await applicantCtx.post(`${apiURL}/api/channels/${channel.id}/join`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(join.status()).toBe(202);

  csrf = await fetchCsrf(request);
  const list = await request.get(`${apiURL}/api/channels/${channel.id}/join-requests`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(list.ok()).toBeTruthy();
  const pending = (await list.json()) as { results: Array<{ id: number; status: string }> };
  expect(pending.results.length).toBeGreaterThanOrEqual(1);
  const reqId = pending.results[0]!.id;

  const approve = await request.post(
    `${apiURL}/api/channels/${channel.id}/join-requests/${reqId}/approve`,
    { headers: { "X-CSRFToken": csrf } },
  );
  expect(approve.ok()).toBeTruthy();

  await applicantCtx.dispose();
});
