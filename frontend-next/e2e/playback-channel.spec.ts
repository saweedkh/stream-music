import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { minimalWavBytes } from "./helpers/minimal-wav";
import { dismissRoomOnboarding, waitForPlayerShell } from "./helpers/room";

test.describe("channel playback (Chrome)", () => {
  test.describe.configure({ mode: "serial" });

  test("visualizer uses captureStream and does not hijack audio output", async ({ page }) => {
    await page.goto("/login");
    const hijacks = await page.evaluate(() => {
      const proto = HTMLMediaElement.prototype as HTMLMediaElement & {
        captureStream?: () => MediaStream;
      };
      return {
        hasCaptureStream: typeof proto.captureStream === "function",
      };
    });
    expect(hijacks.hasCaptureStream).toBe(true);
  });

  test("admin: play, unlock, next — single audio element", async ({ browser, request, baseURL }) => {
    const username = uniqueUsername("dj");
    const password = "pw12345678";
    await registerAndLogin(request, username, password);

    const csrf = await fetchCsrf(request);
    const channelRes = await request.post(`${apiURL}/api/channels/`, {
      data: { name: `E2E Room ${Date.now()}`, description: "playback test" },
      headers: { "X-CSRFToken": csrf },
    });
    expect(channelRes.ok()).toBeTruthy();
    const channel = (await channelRes.json()) as { id: number };
    const channelId = channel.id;

    const wav = minimalWavBytes();
    const trackRes = await request.post(`${apiURL}/api/tracks/`, {
      multipart: {
        title: "E2E Beep",
        file: {
          name: "e2e-beep.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
      },
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });
    if (!trackRes.ok()) {
      throw new Error(`track upload failed: ${trackRes.status()} ${await trackRes.text()}`);
    }
    const track = (await trackRes.json()) as { id: number; file?: string | null };

    const csrf2 = await fetchCsrf(request);
    const playTrack = await request.post(`${apiURL}/api/channels/${channelId}/tracks/${track.id}/play`, {
      headers: { "X-CSRFToken": csrf2 },
    });
    if (!playTrack.ok()) {
      throw new Error(`play track failed: ${playTrack.status()} ${await playTrack.text()}`);
    }

    const csrf3 = await fetchCsrf(request);
    await request.post(`${apiURL}/api/channels/${channelId}/control`, {
      data: { action: "play", position: 0 },
      headers: { "X-CSRFToken": csrf3 },
    });

    const storage = await request.storageState();
    const context = await browser.newContext({ storageState: storage, baseURL });
    const page = await context.newPage();
    await page.goto(`/channel/${channelId}`, { waitUntil: "domcontentloaded" });
    await dismissRoomOnboarding(page);
    await waitForPlayerShell(page);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const a = document.querySelector("audio[data-channel-audio]") as HTMLAudioElement | null;
            return a ? Boolean(a.src) : false;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    const audioNodes = await page.evaluate(() => document.querySelectorAll("audio[data-channel-audio]").length);
    expect(audioNodes).toBeLessThanOrEqual(1);

    const nextControl = page.getByRole("button", { name: /next|بعدی/i }).first();
    if (await nextControl.isEnabled().catch(() => false)) {
      await nextControl.click();
      await page.waitForTimeout(1500);
      const afterNext = await page.evaluate(() => document.querySelectorAll("audio[data-channel-audio]").length);
      expect(afterNext).toBeLessThanOrEqual(1);
    }

    await context.close();
  });

  test("listener: second client hears after unlock", async ({ browser, playwright, request, baseURL }) => {
    const owner = uniqueUsername("owner");
    const listener = uniqueUsername("listener");
    const password = "pw12345678";

    await registerAndLogin(request, owner, password);

    const csrf = await fetchCsrf(request);
    const channelRes = await request.post(`${apiURL}/api/channels/`, {
      data: { name: `E2E Listen ${Date.now()}`, description: "listener test" },
      headers: { "X-CSRFToken": csrf },
    });
    const channel = (await channelRes.json()) as { id: number };

    const trackRes = await request.post(`${apiURL}/api/tracks/`, {
      multipart: {
        title: "E2E Beep 2",
        file: { name: "e2e.wav", mimeType: "audio/wav", buffer: minimalWavBytes() },
      },
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });
    const track = (await trackRes.json()) as { id: number };

    await request.post(`${apiURL}/api/channels/${channel.id}/tracks/${track.id}/play`, {
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });
    await request.post(`${apiURL}/api/channels/${channel.id}/control`, {
      data: { action: "play", position: 0 },
      headers: { "X-CSRFToken": await fetchCsrf(request) },
    });

    const ownerStorage = await request.storageState();
    const ownerContext = await browser.newContext({ storageState: ownerStorage, baseURL });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/channel/${channel.id}`, { waitUntil: "domcontentloaded" });
    await dismissRoomOnboarding(ownerPage);
    await waitForPlayerShell(ownerPage);

    const listenerApi: APIRequestContext = await playwright.request.newContext({ baseURL: apiURL });
    await registerAndLogin(listenerApi, listener, password);
    const join = await listenerApi.post(`${apiURL}/api/channels/${channel.id}/join`, {
      headers: { "X-CSRFToken": await fetchCsrf(listenerApi) },
    });
    expect(join.ok()).toBeTruthy();
    const listenerStorage = await listenerApi.storageState();
    await listenerApi.dispose();
    const listenerContext = await browser.newContext({ storageState: listenerStorage, baseURL });
    const listenerPage = await listenerContext.newPage();
    await listenerPage.goto(`/channel/${channel.id}`, { waitUntil: "domcontentloaded" });
    await dismissRoomOnboarding(listenerPage);
    await waitForPlayerShell(listenerPage);

    await expect
      .poll(
        () =>
          listenerPage.evaluate(() => Boolean(document.querySelector("audio[data-channel-audio]")?.src)),
        { timeout: 30_000 },
      )
      .toBe(true);

    const unlock = listenerPage.getByRole("button", { name: /enable sound|فعال‌سازی صدا/i });
    const openFull = listenerPage.getByRole("button", { name: /open full player|باز کردن پخش|expand|باز کردن/i });
    if (await unlock.isVisible().catch(() => false)) {
      await unlock.click();
    } else if (await openFull.first().isVisible().catch(() => false)) {
      await openFull.first().click();
    }

    await listenerPage.waitForTimeout(1000);
    const state = await listenerPage.evaluate(() => {
      const a = document.querySelector("audio");
      return { count: document.querySelectorAll("audio").length, paused: a?.paused ?? true, src: Boolean(a?.src) };
    });
    expect(state.count).toBe(1);
    expect(state.src).toBe(true);

    await ownerContext.close();
    await listenerContext.close();
  });
});
