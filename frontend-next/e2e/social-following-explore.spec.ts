import { test, expect } from "@playwright/test";
import { apiURL, registerAndLogin, uniqueUsername } from "./helpers/auth";
import {
  createChannel,
  followChannelApi,
  followUserApi,
  getExploreApi,
  getUserFollowApi,
  listFollowingChannelsApi,
  patchPublicProfile,
} from "./helpers/social";

test.describe("social: following, explore, user follow", () => {
  test.describe.configure({ mode: "serial" });

  test("API: follow public channel appears in following feed", async ({ playwright, request }) => {
    const owner = uniqueUsername("own");
    const follower = uniqueUsername("fol");
    const password = "pw12345678";
    await registerAndLogin(request, owner, password);

    const channel = await createChannel(request, {
      name: `FollowFeed ${Date.now()}`,
      description: "e2e public",
      privacy: "public",
    });

    const followerCtx = await playwright.request.newContext({ baseURL: apiURL });
    await registerAndLogin(followerCtx, follower, password);
    await followChannelApi(followerCtx, channel.id);

    const feed = await listFollowingChannelsApi(followerCtx);
    expect(feed.results.some((r) => r.channel.id === channel.id)).toBeTruthy();
    const row = feed.results.find((r) => r.channel.id === channel.id)!;
    expect(row.is_member).toBe(false);
    expect(row.notify_live).toBe(true);

    await followerCtx.dispose();
  });

  test("UI: dashboard following tab lists followed channel", async ({ browser, playwright, request }) => {
    const owner = uniqueUsername("own2");
    const follower = uniqueUsername("fol2");
    const password = "pw12345678";
    const channelName = `DashFollow ${Date.now()}`;

    await registerAndLogin(request, owner, password);
    const channel = await createChannel(request, {
      name: channelName,
      privacy: "public",
    });

    const followerCtx = await playwright.request.newContext({ baseURL: apiURL });
    await registerAndLogin(followerCtx, follower, password);
    await followChannelApi(followerCtx, channel.id);
    const storage = await followerCtx.storageState();

    const page = await browser.newContext({ storageState: storage }).then((c) => c.newPage());
    await page.goto("/dashboard?tab=following");
    await expect(page.getByRole("heading", { name: /following/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: channelName }).first()).toBeVisible({ timeout: 15_000 });
    await page.context().close();
    await followerCtx.dispose();
  });

  test("UI: explore follow public channel", async ({ browser, playwright, request }) => {
    const owner = uniqueUsername("expown");
    const follower = uniqueUsername("expfol");
    const password = "pw12345678";
    const channelName = `ExploreFollow ${Date.now()}`;

    await registerAndLogin(request, owner, password);
    await createChannel(request, { name: channelName, privacy: "public" });

    const followerCtx = await playwright.request.newContext({ baseURL: apiURL });
    await registerAndLogin(followerCtx, follower, password);
    const storage = await followerCtx.storageState();

    const page = await browser.newContext({ storageState: storage }).then((c) => c.newPage());
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: /^explore$/i })).toBeVisible({ timeout: 15_000 });

    const followBtn = page.getByRole("button", { name: /follow channel|دنبال کردن کانال/i }).first();
    await expect(followBtn).toBeVisible({ timeout: 15_000 });
    await followBtn.click();
    await expect(page.getByRole("button", { name: /following|دنبال می‌کنید/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    const feed = await listFollowingChannelsApi(followerCtx);
    expect(feed.results.some((r) => r.channel.name === channelName)).toBeTruthy();

    await page.context().close();
    await followerCtx.dispose();
  });

  test("API + UI: explore feed loads", async ({ browser, request }) => {
    const user = uniqueUsername("exp");
    await registerAndLogin(request, user);

    await createChannel(request, {
      name: `ExplorePub ${Date.now()}`,
      privacy: "public",
    });

    const explore = await getExploreApi(request);
    expect(Array.isArray(explore.live_channels)).toBeTruthy();
    expect(Array.isArray(explore.popular_channels)).toBeTruthy();
    expect(Array.isArray(explore.shared_playlists)).toBeTruthy();

    const storage = await request.storageState();
    const page = await browser.newContext({ storageState: storage }).then((c) => c.newPage());
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: /^explore$/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/live now|الان زنده/i)).toBeVisible();
    await page.context().close();
  });

  test("API + UI: follow public user profile", async ({ browser, playwright, request }) => {
    const target = uniqueUsername("pub");
    const viewer = uniqueUsername("view");
    const password = "pw12345678";

    await registerAndLogin(request, target, password);
    await patchPublicProfile(request, { is_public: true, bio: "E2E public bio" });

    const viewerCtx = await playwright.request.newContext({ baseURL: apiURL });
    await registerAndLogin(viewerCtx, viewer, password);
    await followUserApi(viewerCtx, target);

    const state = await getUserFollowApi(viewerCtx, target);
    expect(state.following).toBe(true);
    expect(state.follower_count).toBeGreaterThanOrEqual(1);

    const storage = await viewerCtx.storageState();
    const page = await browser.newContext({ storageState: storage }).then((c) => c.newPage());
    await page.goto(`/users/${target}`);
    await expect(page.getByText("E2E public bio")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^unfollow$/i })).toBeVisible();

    await page.context().close();
    await viewerCtx.dispose();
  });

  test("health: following and explore endpoints require auth", async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: apiURL });
    const feed = await anon.get(`${apiURL}/api/me/following-channels`);
    expect([401, 403]).toContain(feed.status());
    const explore = await anon.get(`${apiURL}/api/explore`);
    expect([401, 403]).toContain(explore.status());
    await anon.dispose();
  });
});
