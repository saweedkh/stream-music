import { test, expect } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";

test("from-url queues async import with task_id", async ({ request }) => {
  const user = uniqueUsername("import");
  await registerAndLogin(request, user);
  const csrf = await fetchCsrf(request);

  const res = await request.post(`${apiURL}/api/tracks/upload/from-url`, {
    data: {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "E2E Import Queue",
      visibility: "private",
    },
    headers: { "X-CSRFToken": csrf },
  });
  expect(res.status()).toBe(202);
  const body = (await res.json()) as { status: string; task_id: string };
  expect(body.status).toBe("pending");
  expect(body.task_id).toBeTruthy();

  const poll = await request.get(`${apiURL}/api/tracks/import/${encodeURIComponent(body.task_id)}/status`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(poll.ok()).toBeTruthy();
  const status = (await poll.json()) as { status: string };
  expect(["pending", "success", "failed"]).toContain(status.status);
});

test("e2e mock import creates track without network", async ({ request }) => {
  const user = uniqueUsername("importmock");
  await registerAndLogin(request, user);
  const csrf = await fetchCsrf(request);

  const res = await request.post(`${apiURL}/api/e2e/track-import-mock`, {
    data: { url: "https://e2e.example/song", title: "Mock Import Track" },
    headers: { "X-CSRFToken": csrf },
  });
  expect(res.status()).toBe(201);
  const track = (await res.json()) as { id: number; title: string; import_source?: string };
  expect(track.title).toBe("Mock Import Track");
  expect(track.id).toBeGreaterThan(0);

  const list = await request.get(`${apiURL}/api/tracks/`, { headers: { "X-CSRFToken": csrf } });
  expect(list.ok()).toBeTruthy();
  const tracks = (await list.json()) as { results?: { title: string }[] } | { title: string }[];
  const rows = Array.isArray(tracks) ? tracks : (tracks.results ?? []);
  expect(rows.some((t) => t.title === "Mock Import Track")).toBeTruthy();
});
