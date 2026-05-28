import { test, expect, request as playwrightRequest } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { minimalWavBytes } from "./helpers/minimal-wav";
import { playbackWsWaitFor } from "./helpers/playback-ws";
import { dismissRoomOnboarding, waitForPlayerShell } from "./helpers/room";

test.describe("two-client playback sync", () => {
  test.describe.configure({ mode: "serial" });

  test("listener WebSocket receives play payload when owner starts playback", async ({ request }) => {
    const owner = uniqueUsername("sync_owner");
    const listener = uniqueUsername("sync_listener");
    const password = "pw12345678";
    const trackTitle = `E2E Sync ${Date.now()}`;

    await registerAndLogin(request, owner, password);
    let csrf = await fetchCsrf(request);
    const channelRes = await request.post(`${apiURL}/api/channels/`, {
      data: { name: `Sync Room ${Date.now()}` },
      headers: { "X-CSRFToken": csrf },
    });
    const channel = (await channelRes.json()) as { id: number };

    const trackRes = await request.post(`${apiURL}/api/tracks/`, {
      multipart: {
        title: trackTitle,
        file: { name: "sync.wav", mimeType: "audio/wav", buffer: minimalWavBytes() },
      },
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });
    const track = (await trackRes.json()) as { id: number };

    const listenerCtx = await playwrightRequest.newContext({ baseURL: apiURL });
    await registerAndLogin(listenerCtx, listener, password);
    csrf = await fetchCsrf(listenerCtx);
    const join = await listenerCtx.post(`${apiURL}/api/channels/${channel.id}/join`, {
      headers: { "X-CSRFToken": csrf },
    });
    expect(join.ok()).toBeTruthy();

    const playPromise = playbackWsWaitFor(
      listenerCtx,
      channel.id,
      (p) => {
        const action = String(p.action ?? p.type ?? "").toLowerCase();
        const title = p.track?.title ?? "";
        return (action === "play" || action === "initial_sync") && title.includes("E2E Sync");
      },
      30_000,
    );

    csrf = await fetchCsrf(request);
    await request.post(`${apiURL}/api/channels/${channel.id}/tracks/${track.id}/play`, {
      headers: { "X-CSRFToken": csrf },
    });
    await request.post(`${apiURL}/api/channels/${channel.id}/control`, {
      data: { action: "play", position: 0 },
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });

    const payload = await playPromise;
    expect(payload.track?.title).toContain("E2E Sync");
    await listenerCtx.dispose();
  });

  test("listener UI shows same track after owner shuffle + skip", async ({ browser, request, baseURL }) => {
    const owner = uniqueUsername("sync_ui_owner");
    const listener = uniqueUsername("sync_ui_listener");
    const password = "pw12345678";

    await registerAndLogin(request, owner, password);
    let csrf = await fetchCsrf(request);
    const channelRes = await request.post(`${apiURL}/api/channels/`, {
      data: { name: `Sync UI ${Date.now()}` },
      headers: { "X-CSRFToken": csrf },
    });
    const channel = (await channelRes.json()) as { id: number };

    const stamp = Date.now();
    const titleA = `Sync A ${stamp}`;
    const titleB = `Sync B ${stamp}`;
    for (const title of [titleA, titleB]) {
      await request.post(`${apiURL}/api/tracks/`, {
        multipart: {
          title,
          file: { name: `${title}.wav`, mimeType: "audio/wav", buffer: minimalWavBytes() },
        },
        headers: { "X-CSRFToken": await fetchCsrf(request) },
      });
    }

    csrf = await fetchCsrf(request);
    const shuffle = await request.post(`${apiURL}/api/channels/${channel.id}/playlists/shuffle`, {
      data: { limit: 2 },
      headers: { "X-CSRFToken": csrf },
    });
    expect(shuffle.ok()).toBeTruthy();
    const shuffleBody = (await shuffle.json()) as {
      playback?: { track?: { title?: string } };
      queue?: Array<{ track?: number }>;
    };
    const firstTitle = shuffleBody.playback?.track?.title ?? titleA;

    const listenerCtx = await playwrightRequest.newContext({ baseURL: apiURL });
    await registerAndLogin(listenerCtx, listener, password);
    csrf = await fetchCsrf(listenerCtx);
    await listenerCtx.post(`${apiURL}/api/channels/${channel.id}/join`, {
      headers: { "X-CSRFToken": csrf },
    });

    const ownerStorage = await request.storageState();
    const listenerStorage = await listenerCtx.storageState();

    const ownerBrowser = await browser.newContext({ storageState: ownerStorage, baseURL });
    const listenerBrowser = await browser.newContext({ storageState: listenerStorage, baseURL });
    const ownerPage = await ownerBrowser.newPage();
    const listenerPage = await listenerBrowser.newPage();

    await ownerPage.goto(`/channel/${channel.id}`, { waitUntil: "domcontentloaded" });
    await listenerPage.goto(`/channel/${channel.id}`, { waitUntil: "domcontentloaded" });
    await dismissRoomOnboarding(ownerPage);
    await dismissRoomOnboarding(listenerPage);
    await waitForPlayerShell(ownerPage);
    await waitForPlayerShell(listenerPage);

    const titleLocator = listenerPage.getByTestId("channel-now-playing-title");
    await expect(titleLocator).toContainText(firstTitle.slice(0, 10), { timeout: 45_000 });

    csrf = await fetchCsrf(request);
    const nextRes = await request.post(`${apiURL}/api/channels/${channel.id}/control`, {
      data: { action: "next" },
      headers: { "X-CSRFToken": csrf },
    });
    expect(nextRes.ok()).toBeTruthy();

    await expect
      .poll(
        async () => {
          const text = (await titleLocator.textContent()) ?? "";
          return text.includes(titleB.slice(0, 8)) || !text.includes(firstTitle.slice(0, 8));
        },
        { timeout: 45_000 },
      )
      .toBe(true);

    await ownerBrowser.close();
    await listenerBrowser.close();
    await listenerCtx.dispose();
  });
});
